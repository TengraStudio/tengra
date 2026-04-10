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

        while let Some(chunk) = input.next().await {
            match chunk {
                Ok(bytes) => {
                    buffer.push_str(String::from_utf8_lossy(&bytes).as_ref());
                    while let Some(frame) = take_next_frame(&mut buffer) {
                        for payload in translate_frame(provider.as_str(), frame.as_str(), &mut claude_state, &mut gemini_state, &state, &session_key) {
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
            for payload in translate_frame(provider.as_str(), buffer.trim(), &mut claude_state, &mut gemini_state, &state, &session_key) {
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
    state: &State<Arc<AppState>>,
    session_key: &str,
) -> Vec<String> {
    match provider {
        "claude" => translate_claude_frame(frame, claude_state, state, session_key),
        "antigravity" => translate_gemini_frame(frame, gemini_state),
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

fn gemini_payload_to_openai_chunk(value: Value, state: &mut GeminiStreamState) -> String {
    let gemini_value = unwrap_gemini_stream_payload(&value);
    let parts = gemini_value["candidates"][0]["content"]["parts"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let mut full_content = String::new();
    let mut full_reasoning = String::new();
    let mut tool_calls = Vec::new();

    // 1. Process standard Gemini parts (Text, Thoughts, FunctionCalls)
    for part in parts {
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

        if let Some(function_call) = part.get("functionCall") {
            tool_calls.push(json!({
                "index": tool_calls.len(),
                "id": format!("gemini-call-{}", tool_calls.len()),
                "type": "function",
                "function": {
                    "name": function_call.get("name").and_then(Value::as_str).unwrap_or_default(),
                    "arguments": function_call.get("args").cloned().unwrap_or_else(|| json!({})).to_string()
                }
            }));
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
                "tool_calls": if tool_calls.is_empty() { Value::Null } else { Value::Array(tool_calls) }
            },
            "finish_reason": finish_reason
        }]
    })
    .to_string()
}

fn unwrap_gemini_stream_payload<'a>(value: &'a Value) -> &'a Value {
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
        take_next_frame, translate_claude_frame, translate_gemini_frame, ClaudeStreamState,
        GeminiStreamState,
    };

    fn sample_app_state() -> State<Arc<crate::proxy::server::AppState>> {
        State(Arc::new(crate::proxy::server::AppState {
            signature_cache: Mutex::new(std::collections::HashMap::new()),
            session_id_cache: Mutex::new(std::collections::HashMap::new()),
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
}
