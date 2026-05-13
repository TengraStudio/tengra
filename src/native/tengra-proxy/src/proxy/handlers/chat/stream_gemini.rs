/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use std::collections::HashSet;

use serde_json::{json, Value};

use crate::proxy::handlers::chat::stream_support::{
    extract_data_payloads, normalize_finish_reason,
};

#[derive(Default)]
pub(super) struct GeminiStreamState {
    last_content: String,
    last_reasoning: String,
    tool_calls_sent: bool,
    sent_tool_call_ids: HashSet<String>,
}

pub(super) fn translate_gemini_frame(frame: &str, state: &mut GeminiStreamState) -> Vec<String> {
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
    let mut images = Vec::new();

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
                let name = function_call
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                let args = function_call
                    .get("args")
                    .cloned()
                    .unwrap_or_else(|| json!({}));
                let thought_signature = function_call
                    .get("thought_signature")
                    .and_then(Value::as_str);

                let mut fc_obj = json!({
                    "name": name,
                    "arguments": args.to_string()
                });

                if let Some(ts) = thought_signature {
                    fc_obj
                        .as_object_mut()
                        .expect("function call object")
                        .insert(
                            "thought_signature".to_string(),
                            Value::String(ts.to_string()),
                        );
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
