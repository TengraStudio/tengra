use std::collections::HashMap;
use std::convert::Infallible;
use std::pin::Pin;

use async_stream::stream;
use axum::response::sse::Event;
use futures::{Stream, StreamExt};
use serde_json::{json, Value};

#[derive(Default)]
struct ClaudeStreamState {
    tool_calls: HashMap<i64, ClaudeToolCall>,
}

#[derive(Clone)]
struct ClaudeToolCall {
    id: String,
    name: String,
}

pub fn translate_stream(
    provider: &str,
    upstream: impl Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Send + 'static,
) -> Pin<Box<dyn Stream<Item = Result<Event, Infallible>> + Send>> {
    let provider = provider.to_string();
    Box::pin(stream! {
        let mut input = Box::pin(upstream);
        let mut buffer = String::new();
        let mut claude_state = ClaudeStreamState::default();

        while let Some(chunk) = input.next().await {
            match chunk {
                Ok(bytes) => {
                    buffer.push_str(String::from_utf8_lossy(&bytes).as_ref());
                    while let Some(frame) = take_next_frame(&mut buffer) {
                        for payload in translate_frame(provider.as_str(), frame.as_str(), &mut claude_state) {
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
            for payload in translate_frame(provider.as_str(), buffer.trim(), &mut claude_state) {
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
) -> Vec<String> {
    match provider {
        "claude" => translate_claude_frame(frame, claude_state),
        "antigravity" => translate_gemini_frame(frame),
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

fn translate_gemini_frame(frame: &str) -> Vec<String> {
    extract_data_payloads(frame)
        .into_iter()
        .filter_map(|payload| {
            if payload == "[DONE]" {
                return Some(payload);
            }
            serde_json::from_str::<Value>(&payload)
                .ok()
                .map(gemini_payload_to_openai_chunk)
        })
        .collect()
}

fn gemini_payload_to_openai_chunk(value: Value) -> String {
    let gemini_value = unwrap_gemini_stream_payload(&value);
    let parts = gemini_value["candidates"][0]["content"]["parts"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let mut content = String::new();
    let mut reasoning = String::new();
    let mut tool_calls = Vec::new();
    for part in parts {
        if part.get("thought").and_then(Value::as_bool) == Some(true) {
            reasoning.push_str(part.get("text").and_then(Value::as_str).unwrap_or_default());
            continue;
        }
        if let Some(text) = part.get("text").and_then(Value::as_str) {
            content.push_str(text);
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

    let finish_reason = normalize_finish_reason(
        gemini_value["candidates"][0]["finishReason"]
            .as_str()
            .unwrap_or_default(),
    );
    json!({
        "id": gemini_value
            .get("responseId")
            .and_then(Value::as_str)
            .unwrap_or("gemini-stream"),
        "object": "chat.completion.chunk",
        "model": gemini_value
            .get("modelVersion")
            .and_then(Value::as_str)
            .unwrap_or("gemini"),
        "choices": [{
            "index": 0,
            "delta": {
                "content": if content.is_empty() { Value::Null } else { Value::String(content) },
                "reasoning_content": if reasoning.is_empty() { Value::Null } else { Value::String(reasoning) },
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

fn translate_claude_frame(frame: &str, state: &mut ClaudeStreamState) -> Vec<String> {
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
        "content_block_start" => {
            remember_claude_tool_call(value, state);
            vec![]
        }
        "content_block_delta" => claude_delta_payloads(value, state),
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
        "end_turn" | "stop_sequence" | "STOP" => Some("stop"),
        "max_tokens" | "MAX_TOKENS" => Some("length"),
        "" => None,
        _ => Some("stop"),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        take_next_frame, translate_claude_frame, translate_gemini_frame, ClaudeStreamState,
    };

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
        let payloads = translate_claude_frame(
            "event: content_block_delta\ndata: {\"delta\":{\"type\":\"text_delta\",\"text\":\"hello\"}}\n\n",
            &mut state,
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"content\":\"hello\""));
    }

    #[test]
    fn translates_gemini_text_delta_to_openai_chunk() {
        let payloads = translate_gemini_frame(
            "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"hello\"}]},\"finishReason\":\"STOP\"}],\"modelVersion\":\"gemini-2.5-pro\"}\n\n",
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"content\":\"hello\""));
    }

    #[test]
    fn translates_wrapped_antigravity_stream_delta() {
        let payloads = translate_gemini_frame(
            "data: {\"response\":{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"hello\"}]},\"finishReason\":\"STOP\"}],\"modelVersion\":\"gemini-3-flash\"}}\n\n",
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"content\":\"hello\""));
        assert!(payloads[0].contains("\"model\":\"gemini-3-flash\""));
    }
}
