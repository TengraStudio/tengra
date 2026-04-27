/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use std::collections::HashMap;
use std::convert::Infallible;
use std::pin::Pin;
use std::sync::Arc;

use async_stream::stream;
use axum::extract::State;
use axum::response::sse::Event;
use futures::{Stream, StreamExt};
use serde_json::{json, Value};

use crate::proxy::server::AppState;

#[derive(Default)]
struct ClaudeStreamState {
    tool_calls: HashMap<i64, ClaudeToolCall>,
}

#[derive(Default)]
struct GeminiStreamState {
    last_content: String,
    last_reasoning: String,
    tool_calls_sent: bool,
    sent_tool_call_ids: std::collections::HashSet<String>,
}

#[derive(Default)]
struct CopilotStreamState {
    encrypted_reasoning_placeholder_sent: bool,
}

#[derive(Clone)]
struct ClaudeToolCall {
    id: String,
    name: String,
}

pub fn translate_stream(
    provider: String,
    upstream: impl Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Send + 'static,
    state: State<Arc<AppState>>,
    session_key: String,
) -> Pin<Box<dyn Stream<Item = Result<Event, Infallible>> + Send + 'static>> {
    Box::pin(stream! {
        let mut input = Box::pin(upstream);
        let mut buffer = String::new();
        let mut claude_state = ClaudeStreamState::default();
        let mut gemini_state = GeminiStreamState::default();
        let mut copilot_state = CopilotStreamState::default();

        while let Some(chunk) = input.next().await {
            match chunk {
                Ok(bytes) => {
                    buffer.push_str(String::from_utf8_lossy(&bytes).as_ref());
                    while let Some(frame) = take_next_frame(&mut buffer) {
                        for payload in translate_frame(provider.as_str(), frame.as_str(), &mut claude_state, &mut gemini_state, &mut copilot_state, &state, &session_key) {
                            yield Ok(Event::default().data(payload));
                        }
                    }
                }
                Err(error) => {
                    yield Ok(Event::default().data(json!({ "error": format!("Upstream stream error: {}", error) }).to_string()));
                }
            }
        }

        if !buffer.trim().is_empty() {
            for payload in translate_frame(provider.as_str(), buffer.trim(), &mut claude_state, &mut gemini_state, &mut copilot_state, &state, &session_key) {
                yield Ok(Event::default().data(payload));
            }
        }
    })
}

fn take_next_frame(buffer: &mut String) -> Option<String> {
    for delimiter in ["\r\n\r\n", "\n\n"] {
        if let Some(index) = buffer.find(delimiter) {
            let frame = buffer[..index].to_string();
            let remainder = buffer[index + delimiter.len()..].to_string();
            *buffer = remainder;
            return Some(frame);
        }
    }
    None
}

fn translate_frame(
    provider: &str,
    frame: &str,
    claude_state: &mut ClaudeStreamState,
    gemini_state: &mut GeminiStreamState,
    copilot_state: &mut CopilotStreamState,
    state: &State<Arc<AppState>>,
    session_key: &str,
) -> Vec<String> {
    match provider {
        "claude" => translate_claude_frame(frame, claude_state, state, session_key),
        "antigravity" => translate_gemini_frame(frame, gemini_state),
        "copilot" => translate_copilot_frame(frame, copilot_state),
        _ => extract_data_payloads(frame),
    }
}

fn extract_data_payloads(frame: &str) -> Vec<String> {
    frame
        .lines()
        .filter_map(|line| line.trim().strip_prefix("data:").map(str::trim))
        .filter(|payload| !payload.is_empty())
        .map(str::to_string)
        .collect()
}

fn translate_gemini_frame(frame: &str, state: &mut GeminiStreamState) -> Vec<String> {
    extract_data_payloads(frame)
        .into_iter()
        .filter_map(|payload| {
            if payload == "[DONE]" {
                return Some(payload);
            }
            serde_json::from_str::<Value>(&payload)
                .ok()
                .map(|v| gemini_payload_to_openai_chunk(v, state))
        })
        .collect()
}

fn translate_copilot_frame(frame: &str, state: &mut CopilotStreamState) -> Vec<String> {
    extract_data_payloads(frame)
        .into_iter()
        .flat_map(|payload| translate_copilot_payload(payload, state))
        .collect()
}

fn translate_copilot_payload(payload: String, state: &mut CopilotStreamState) -> Vec<String> {
    if payload == "[DONE]" {
        return vec![payload];
    }

    let Ok(value) = serde_json::from_str::<Value>(&payload) else {
        return vec![payload];
    };

    if let Some(chunk) = copilot_session_event_to_openai_chunk(&value, state) {
        return vec![chunk];
    }
    if value
        .get("type")
        .and_then(Value::as_str)
        .map(|event_type| event_type.starts_with("assistant."))
        .unwrap_or(false)
    {
        return vec![];
    }

    if let Some(normalized) = normalize_copilot_openai_chunk(value, state) {
        return vec![normalized.to_string()];
    }

    vec![payload]
}

fn copilot_session_event_to_openai_chunk(
    value: &Value,
    state: &mut CopilotStreamState,
) -> Option<String> {
    let event_type = value.get("type").and_then(Value::as_str)?;
    match event_type {
        "assistant.reasoning_delta" => {
            let delta = value
                .get("data")
                .and_then(|data| data.get("deltaContent"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            if delta.is_empty() {
                return None;
            }
            Some(openai_delta_chunk(
                json!({ "reasoning_content": delta }),
                None,
            ))
        }
        "assistant.reasoning" => {
            let data = value.get("data")?;
            let content = data
                .get("content")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if !content.is_empty() {
                return Some(openai_delta_chunk(
                    json!({ "reasoning_content": content }),
                    None,
                ));
            }
            let reasoning_id = data
                .get("reasoningId")
                .and_then(Value::as_str)
                .unwrap_or_default();
            encrypted_copilot_reasoning_placeholder(reasoning_id, state).map(|placeholder| {
                openai_delta_chunk(json!({ "reasoning_content": placeholder }), None)
            })
        }
        "assistant.message_delta" => {
            let delta = value
                .get("data")
                .and_then(|data| data.get("deltaContent"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            if delta.is_empty() {
                return None;
            }
            Some(openai_delta_chunk(json!({ "content": delta }), None))
        }
        "assistant.message" => {
            let data = value.get("data")?;
            copilot_message_reasoning_placeholder(data, state).map(|placeholder| {
                openai_delta_chunk(json!({ "reasoning_content": placeholder }), None)
            })
        }
        _ => None,
    }
}

fn normalize_copilot_openai_chunk(
    mut value: Value,
    state: &mut CopilotStreamState,
) -> Option<Value> {
    let choices = value.get_mut("choices").and_then(Value::as_array_mut)?;
    for choice in choices {
        let Some(choice_object) = choice.as_object_mut() else {
            continue;
        };
        normalize_copilot_choice_reasoning(choice_object, state);
    }
    Some(value)
}

fn normalize_copilot_choice_reasoning(
    choice: &mut serde_json::Map<String, Value>,
    state: &mut CopilotStreamState,
) {
    if let Some(delta) = choice.get_mut("delta").and_then(Value::as_object_mut) {
        normalize_copilot_reasoning_fields(delta, state);
    }
    if let Some(message) = choice.get_mut("message").and_then(Value::as_object_mut) {
        normalize_copilot_reasoning_fields(message, state);
    }
}

fn normalize_copilot_reasoning_fields(
    object: &mut serde_json::Map<String, Value>,
    state: &mut CopilotStreamState,
) {
    if object
        .get("reasoning_content")
        .and_then(Value::as_str)
        .map(|value| !value.is_empty())
        .unwrap_or(false)
    {
        return;
    }

    if let Some(reasoning) = take_first_string_field(
        object,
        &[
            "reasoning",
            "reasoning_text",
            "reasoningText",
            "deltaContent",
        ],
    ) {
        object.insert("reasoning_content".to_string(), Value::String(reasoning));
        return;
    }

    if let Some(placeholder) = copilot_object_encrypted_reasoning_placeholder(object, state) {
        object.insert("reasoning_content".to_string(), Value::String(placeholder));
    }
}

fn take_first_string_field(
    object: &mut serde_json::Map<String, Value>,
    keys: &[&str],
) -> Option<String> {
    for key in keys {
        let Some(value) = object.get(*key).and_then(Value::as_str) else {
            continue;
        };
        if !value.is_empty() {
            return Some(value.to_string());
        }
    }
    None
}

fn copilot_message_reasoning_placeholder(
    data: &Value,
    state: &mut CopilotStreamState,
) -> Option<String> {
    if let Some(content) = data.get("reasoningText").and_then(Value::as_str) {
        if !content.is_empty() {
            return Some(content.to_string());
        }
    }
    let marker = data
        .get("reasoningOpaque")
        .or_else(|| data.get("encryptedContent"))
        .and_then(Value::as_str)
        .unwrap_or_default();
    encrypted_copilot_reasoning_placeholder(marker, state)
}

fn copilot_object_encrypted_reasoning_placeholder(
    object: &serde_json::Map<String, Value>,
    state: &mut CopilotStreamState,
) -> Option<String> {
    let marker = object
        .get("reasoning_opaque")
        .or_else(|| object.get("reasoningOpaque"))
        .or_else(|| object.get("encrypted_content"))
        .or_else(|| object.get("encryptedContent"))
        .and_then(Value::as_str)
        .unwrap_or_default();
    encrypted_copilot_reasoning_placeholder(marker, state)
}

fn encrypted_copilot_reasoning_placeholder(
    marker: &str,
    state: &mut CopilotStreamState,
) -> Option<String> {
    if marker.is_empty() || state.encrypted_reasoning_placeholder_sent {
        return None;
    }
    state.encrypted_reasoning_placeholder_sent = true;
    Some("Copilot reasoning is encrypted for this turn.".to_string())
}

fn gemini_payload_to_openai_chunk(value: Value, state: &mut GeminiStreamState) -> String {
    let gemini_value = unwrap_gemini_stream_payload(&value);
    let parts = gemini_value["candidates"][0]["content"]["parts"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let mut full_content = String::new();
    let mut full_reasoning = String::new();
    let mut tool_calls = Vec::new();
    let mut images = Vec::new();

    // 1. Process standard Gemini parts (Text, Thoughts, FunctionCalls, Images)
    for (index, part) in parts.iter().enumerate() {
        let is_thought_flag = part.get("thought").and_then(Value::as_bool) == Some(true)
            || part.get("thinking").and_then(Value::as_bool) == Some(true);

        if is_thought_flag {
            full_reasoning.push_str(part.get("text").and_then(Value::as_str).unwrap_or_default());
            continue;
        }

        if let Some(thought_text) = part.get("thought").and_then(Value::as_str) {
            full_reasoning.push_str(thought_text);
            continue;
        }
        if let Some(thinking_text) = part.get("thinking").and_then(Value::as_str) {
            full_reasoning.push_str(thinking_text);
            continue;
        }

        if let Some(text) = part.get("text").and_then(Value::as_str) {
            full_content.push_str(text);
            continue;
        }

        if let Some(inline_data) = part.get("inlineData") {
            let mime_type = inline_data
                .get("mimeType")
                .and_then(Value::as_str)
                .unwrap_or("image/png");
            let data = inline_data
                .get("data")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if !data.is_empty() {
                images.push(json!({
                    "type": "image_url",
                    "image_url": {
                        "url": format!("data:{};base64,{}", mime_type, data)
                    }
                }));
            }
            continue;
        }

        if let Some(function_call) = part.get("functionCall") {
            let call_id = format!("gemini-call-{}", index);
            if !state.sent_tool_call_ids.contains(&call_id) {
                let name = function_call.get("name").and_then(Value::as_str).unwrap_or_default();
                let args = function_call.get("args").cloned().unwrap_or_else(|| json!({}));
                let thought_signature = function_call.get("thought_signature").and_then(Value::as_str);

                let mut fc_obj = json!({
                    "name": name,
                    "arguments": args.to_string()
                });

                if let Some(ts) = thought_signature {
                    fc_obj.as_object_mut().unwrap().insert("thought_signature".to_string(), Value::String(ts.to_string()));
                }

                tool_calls.push(json!({
                    "index": index,
                    "id": call_id.clone(),
                    "type": "function",
                    "function": fc_obj
                }));
                state.sent_tool_call_ids.insert(call_id);
            }
        }
    }

    // 2. Handle structured Step-based payloads
    if let Some(step) = gemini_value.get("step").and_then(Value::as_object) {
        let case = step.get("case").and_then(Value::as_str).unwrap_or_default();
        let val = step.get("value").unwrap_or(&Value::Null);

        if case == "plannerResponse" {
            if let Some(thinking) = val.get("thinking").and_then(Value::as_str) {
                if !full_reasoning.contains(thinking) {
                    full_reasoning.push_str(thinking);
                }
            }
            if let Some(modified) = val.get("modifiedResponse").and_then(Value::as_str) {
                if !full_content.contains(modified) {
                    full_content.push_str(modified);
                }
            }
            if let Some(step_tools) = val.get("toolCalls").and_then(Value::as_array) {
                for tool in step_tools {
                    let name = tool.get("name").and_then(Value::as_str).unwrap_or("tool");
                    let args = tool.get("arguments").cloned().unwrap_or_else(|| json!({}));
                    tool_calls.push(json!({
                        "index": tool_calls.len(),
                        "id": format!("step-call-{}", tool_calls.len()),
                        "type": "function",
                        "function": {
                            "name": name,
                            "arguments": args.to_string()
                        }
                    }));
                }
            }
        }
    }

    // Calculate deltas to avoid spamming
    let delta_content = if full_content.starts_with(&state.last_content) {
        full_content[state.last_content.len()..].to_string()
    } else {
        full_content.clone()
    };

    let delta_reasoning = if full_reasoning.starts_with(&state.last_reasoning) {
        full_reasoning[state.last_reasoning.len()..].to_string()
    } else {
        full_reasoning.clone()
    };

    state.last_content = full_content;
    state.last_reasoning = full_reasoning;

    let mut finish_reason = normalize_finish_reason(
        gemini_value["candidates"][0]["finishReason"]
            .as_str()
            .unwrap_or_default(),
    );

    // Force tool_calls finish reason once if tools are present
    if !tool_calls.is_empty() && !state.tool_calls_sent {
        finish_reason = Some("tool_calls");
        state.tool_calls_sent = true;
    }

    json!({
        "id": gemini_value.get("responseId").and_then(Value::as_str).unwrap_or("gemini-stream"),
        "object": "chat.completion.chunk",
        "model": gemini_value.get("modelVersion").and_then(Value::as_str).unwrap_or("gemini"),
        "choices": [{
            "index": 0,
            "delta": {
                "content": if delta_content.is_empty() { Value::Null } else { Value::String(delta_content) },
                "reasoning_content": if delta_reasoning.is_empty() { Value::Null } else { Value::String(delta_reasoning) },
                "tool_calls": if tool_calls.is_empty() { Value::Null } else { Value::Array(tool_calls) },
                "images": if images.is_empty() { Value::Null } else { Value::Array(images) }
            },
            "finish_reason": finish_reason
        }]
    })
    .to_string()
}

fn unwrap_gemini_stream_payload(value: &Value) -> &Value {
    value.get("response").unwrap_or(value)
}

fn translate_claude_frame(
    frame: &str,
    claude_state: &mut ClaudeStreamState,
    state: &axum::extract::State<std::sync::Arc<crate::proxy::server::AppState>>,
    session_key: &str,
) -> Vec<String> {
    let event_type = frame
        .lines()
        .find_map(|line| line.trim().strip_prefix("event:").map(str::trim))
        .unwrap_or_default();
    let payload = frame
        .lines()
        .filter_map(|line| line.trim().strip_prefix("data:").map(str::trim))
        .collect::<Vec<_>>()
        .join("\n");
    if payload.is_empty() || payload == "[DONE]" {
        return if payload.is_empty() {
            vec![]
        } else {
            vec!["[DONE]".to_string()]
        };
    }

    let Ok(value) = serde_json::from_str::<Value>(&payload) else {
        return vec![];
    };

    match event_type {
        "message_start" => {
            if let Some(sig) = value
                .get("message")
                .and_then(|m| m.get("signature"))
                .and_then(Value::as_str)
            {
                let state_inner = state.0.clone();
                let key = session_key.to_string();
                let sig_str = sig.to_string();
                tokio::spawn(async move {
                    let mut cache = state_inner.signature_cache.lock().await;
                    cache.insert(key, sig_str);
                });
            }
            vec![]
        }
        "content_block_start" => {
            remember_claude_tool_call(value, claude_state);
            vec![]
        }
        "content_block_delta" => claude_delta_payloads(value, claude_state),
        "message_delta" => claude_message_delta_payloads(value),
        "message_stop" => vec!["[DONE]".to_string()],
        _ => vec![],
    }
}

fn remember_claude_tool_call(value: Value, state: &mut ClaudeStreamState) {
    let Some(index) = value.get("index").and_then(Value::as_i64) else {
        return;
    };
    let Some(block) = value.get("content_block") else {
        return;
    };
    if block.get("type").and_then(Value::as_str) != Some("tool_use") {
        return;
    }
    let tool_call = ClaudeToolCall {
        id: block
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        name: block
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
    };
    state.tool_calls.insert(index, tool_call);
}

fn claude_delta_payloads(value: Value, state: &ClaudeStreamState) -> Vec<String> {
    let delta_type = value["delta"]["type"].as_str().unwrap_or_default();
    match delta_type {
        "text_delta" => vec![openai_delta_chunk(
            json!({ "content": value["delta"]["text"].as_str().unwrap_or_default() }),
            None,
        )],
        "thinking_delta" => vec![openai_delta_chunk(
            json!({ "reasoning_content": value["delta"]["thinking"].as_str().unwrap_or_default() }),
            None,
        )],
        "input_json_delta" => {
            let index = value
                .get("index")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            let Some(tool_call) = state.tool_calls.get(&index) else {
                return vec![];
            };
            vec![openai_delta_chunk(
                json!({
                    "tool_calls": [{
                        "index": index,
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_call.name,
                            "arguments": value["delta"]["partial_json"].as_str().unwrap_or_default()
                        }
                    }]
                }),
                None,
            )]
        }
        _ => vec![],
    }
}

fn claude_message_delta_payloads(value: Value) -> Vec<String> {
    let finish_reason =
        normalize_finish_reason(value["delta"]["stop_reason"].as_str().unwrap_or_default());
    if finish_reason.is_none() {
        return vec![];
    }
    vec![openai_delta_chunk(json!({}), finish_reason)]
}

fn openai_delta_chunk(delta: Value, finish_reason: Option<&'static str>) -> String {
    json!({
        "object": "chat.completion.chunk",
        "choices": [{
            "index": 0,
            "delta": delta,
            "finish_reason": finish_reason
        }]
    })
    .to_string()
}

fn normalize_finish_reason(reason: &str) -> Option<&'static str> {
    match reason {
        "end_turn" | "stop_sequence" | "STOP" | "stop" => Some("stop"),
        "max_tokens" | "MAX_TOKENS" => Some("length"),
        "tool_use" | "TOOL_USE" => Some("tool_calls"),
        "" => None,
        _ => Some("stop"),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use axum::extract::State;
    use tokio::sync::Mutex;

    use super::{
        take_next_frame, translate_claude_frame, translate_copilot_frame, translate_gemini_frame,
        ClaudeStreamState, CopilotStreamState, GeminiStreamState,
    };

    fn sample_app_state() -> State<Arc<crate::proxy::server::AppState>> {
        State(Arc::new(crate::proxy::server::AppState {
            signature_cache: Mutex::new(std::collections::HashMap::new()),
            session_id_cache: Mutex::new(std::collections::HashMap::new()),
            terminal_manager: crate::terminal::TerminalManager::new(),
            lsp_manager: crate::analysis::lsp_manager::LspManager::new(),
        }))
    }

    #[test]
    fn splits_sse_frames() {
        let mut buffer = "data: one\n\ndata: two\n\n".to_string();
        assert_eq!(take_next_frame(&mut buffer), Some("data: one".to_string()));
        assert_eq!(take_next_frame(&mut buffer), Some("data: two".to_string()));
        assert!(buffer.is_empty());
    }

    #[test]
    fn translates_claude_text_delta_to_openai_chunk() {
        let mut state = ClaudeStreamState::default();
        let app_state = sample_app_state();
        let payloads = translate_claude_frame(
            "event: content_block_delta\ndata: {\"delta\":{\"type\":\"text_delta\",\"text\":\"hello\"}}\n\n",
            &mut state,
            &app_state,
            "test-session",
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"content\":\"hello\""));
    }

    #[test]
    fn translates_gemini_text_delta_to_openai_chunk() {
        let mut state = GeminiStreamState::default();
        let payloads = translate_gemini_frame(
            "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"hello\"}]},\"finishReason\":\"STOP\"}],\"modelVersion\":\"gemini-2.5-pro\"}\n\n",
            &mut state
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"content\":\"hello\""));
    }

    #[test]
    fn translates_wrapped_antigravity_stream_delta() {
        let mut state = GeminiStreamState::default();
        let payloads = translate_gemini_frame(
            "data: {\"response\":{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"hello\"}]},\"finishReason\":\"STOP\"}],\"modelVersion\":\"gemini-3-flash\"}}\n\n",
            &mut state
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"content\":\"hello\""));
        assert!(payloads[0].contains("\"model\":\"gemini-3-flash\""));
    }

    #[test]
    fn translates_gemini_thought_part_to_reasoning() {
        let mut state = GeminiStreamState::default();
        let payloads = translate_gemini_frame(
            "data: {\"candidates\":[{\"content\":{\"parts\":[{\"thought\":true,\"text\":\"thinking...\"},{\"text\":\"hello\"}]},\"finishReason\":\"STOP\"}],\"modelVersion\":\"gemini-2.5-pro\"}\n\n",
            &mut state
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"reasoning_content\":\"thinking...\""));
        assert!(payloads[0].contains("\"content\":\"hello\""));
    }

    #[test]
    fn translates_antigravity_string_thought_to_reasoning() {
        let mut state = GeminiStreamState::default();
        let payloads = translate_gemini_frame(
            "data: {\"response\":{\"candidates\":[{\"content\":{\"parts\":[{\"thought\":\"string-thought\"},{\"text\":\"hello\"}]},\"finishReason\":\"STOP\"}],\"modelVersion\":\"gemini-3-flash\"}}\n\n",
            &mut state
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"reasoning_content\":\"string-thought\""));
        assert!(payloads[0].contains("\"content\":\"hello\""));
    }

    #[test]
    fn translates_antigravity_thinking_field_to_reasoning() {
        let mut state = GeminiStreamState::default();
        let payloads = translate_gemini_frame(
            "data: {\"response\":{\"candidates\":[{\"content\":{\"parts\":[{\"thinking\":\"checking logic\"},{\"text\":\"result\"}]},\"finishReason\":\"STOP\"}],\"modelVersion\":\"gemini-3-pro\"}}\n\n",
            &mut state
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"reasoning_content\":\"checking logic\""));
        assert!(payloads[0].contains("\"content\":\"result\""));
    }

    #[test]
    fn translates_antigravity_step_payload_to_openai_chunk() {
        let mut state = GeminiStreamState::default();
        let payloads = translate_gemini_frame(
            "data: {\"response\":{\"step\":{\"case\":\"plannerResponse\",\"value\":{\"thinking\":\"planning...\",\"modifiedResponse\":\"here is the web app code\"}},\"modelVersion\":\"gemini-3-flash\"}}\n\n",
            &mut state
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"reasoning_content\":\"planning...\""));
        assert!(payloads[0].contains("\"content\":\"here is the web app code\""));
    }

    #[test]
    fn calculates_deltas_correctly_for_cumulative_payloads() {
        let mut state = GeminiStreamState::default();

        // Frame 1: Partial text
        let p1 = "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Hello\"}]}}]}\n\n";
        let res1 = translate_gemini_frame(p1, &mut state);
        assert!(res1[0].contains("\"content\":\"Hello\""));

        // Frame 2: Cumulative text
        let p2 =
            "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Hello World\"}]}}]}\n\n";
        let res2 = translate_gemini_frame(p2, &mut state);
        assert!(res2[0].contains("\"content\":\" World\"")); // Should only be the delta

        // Frame 3: Cumulative reasoning
        let p3 = "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Hello World\"},{\"thinking\":\"thinking...\"}]}}]}\n\n";
        let res3 = translate_gemini_frame(p3, &mut state);
        assert!(res3[0].contains("\"reasoning_content\":\"thinking...\""));
        assert!(res3[0].contains("\"content\":null")); // No new text

        // Frame 4: Cumulative reasoning update
        let p4 = "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Hello World\"},{\"thinking\":\"thinking... more!\"}]}}]}\n\n";
        let res4 = translate_gemini_frame(p4, &mut state);
        assert!(res4[0].contains("\"reasoning_content\":\" more!\""));
    }

    #[test]
    fn translates_copilot_reasoning_delta_event() {
        let mut state = CopilotStreamState::default();
        let payloads = translate_copilot_frame(
            "data: {\"type\":\"assistant.reasoning_delta\",\"data\":{\"reasoningId\":\"r1\",\"deltaContent\":\"thinking...\"}}\n\n",
            &mut state,
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"reasoning_content\":\"thinking...\""));
    }

    #[test]
    fn translates_copilot_encrypted_reasoning_to_single_placeholder() {
        let mut state = CopilotStreamState::default();
        let frame = "data: {\"type\":\"assistant.message\",\"data\":{\"messageId\":\"m1\",\"content\":\"done\",\"reasoningOpaque\":\"opaque-token\",\"encryptedContent\":\"encrypted-token\"}}\n\n";
        let first = translate_copilot_frame(frame, &mut state);
        let second = translate_copilot_frame(frame, &mut state);
        assert_eq!(first.len(), 1);
        assert!(first[0]
            .contains("\"reasoning_content\":\"Copilot reasoning is encrypted for this turn.\""));
        assert!(second.is_empty());
    }

    #[test]
    fn normalizes_copilot_openai_style_reasoning_text() {
        let mut state = CopilotStreamState::default();
        let payloads = translate_copilot_frame(
            "data: {\"choices\":[{\"index\":0,\"delta\":{\"reasoning_text\":\"thinking...\"},\"finish_reason\":null}]}\n\n",
            &mut state,
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"reasoning_content\":\"thinking...\""));
    }

    #[test]
    fn normalizes_copilot_openai_style_encrypted_reasoning() {
        let mut state = CopilotStreamState::default();
        let payloads = translate_copilot_frame(
            "data: {\"choices\":[{\"index\":0,\"delta\":{\"encrypted_content\":\"secret\"},\"finish_reason\":null}]}\n\n",
            &mut state,
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0]
            .contains("\"reasoning_content\":\"Copilot reasoning is encrypted for this turn.\""));
    }
}
