/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use std::convert::Infallible;
use std::pin::Pin;
use std::sync::Arc;

use async_stream::stream;
use axum::extract::State;
use axum::response::sse::Event;
use bytes::Buf;
use futures::{Stream, StreamExt};
use serde_json::{json, Value};

use crate::proxy::handlers::chat::stream_support::{openai_delta_chunk, take_next_frame};
use crate::proxy::server::AppState;

pub fn translate_cursor_stream(
    upstream: impl Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Send + 'static,
    _state: State<Arc<AppState>>,
    _session_key: String,
    is_sse: bool,
) -> Pin<Box<dyn Stream<Item = Result<Event, Infallible>> + Send + 'static>> {
    Box::pin(stream! {
        let mut input = Box::pin(upstream);

        if is_sse {
            let mut buffer = String::new();
            while let Some(chunk) = input.next().await {
                match chunk {
                    Ok(bytes) => {
                        buffer.push_str(String::from_utf8_lossy(&bytes).as_ref());
                        while let Some(frame) = take_next_frame(&mut buffer) {
                            let data_payload = frame
                                .lines()
                                .filter_map(|l| l.trim().strip_prefix("data:").map(str::trim))
                                .collect::<Vec<_>>()
                                .join("");

                            if data_payload == "[DONE]" {
                                yield Ok(Event::default().data("[DONE]"));
                                continue;
                            }

                            if !data_payload.is_empty() {
                                if let Ok(json_val) = serde_json::from_str::<Value>(&data_payload) {
                                    for t in translate_cursor_payload(json_val) {
                                        yield Ok(Event::default().data(t));
                                    }
                                }
                            }
                        }
                    }
                    Err(error) => {
                        yield Ok(Event::default().data(json!({ "error": format!("Upstream stream error: {}", error) }).to_string()));
                    }
                }
            }
        } else {
            let mut buffer = bytes::BytesMut::new();
            while let Some(chunk) = input.next().await {
                match chunk {
                    Ok(bytes) => {
                        buffer.extend_from_slice(&bytes);
                        while let Some((flags, payload)) = take_next_cursor_frame(&mut buffer) {
                            match serde_json::from_slice::<Value>(&payload) {
                                Ok(json_val) => {
                                    for openai_payload in translate_cursor_payload(json_val) {
                                        yield Ok(Event::default().data(openai_payload));
                                    }
                                }
                                Err(_) => {}
                            }

                            if flags != 0 {
                                yield Ok(Event::default().data("[DONE]"));
                            }
                        }
                    }
                    Err(error) => {
                        yield Ok(Event::default().data(json!({ "error": format!("Upstream stream error: {}", error) }).to_string()));
                    }
                }
            }
        }
    })
}

fn take_next_cursor_frame(buffer: &mut bytes::BytesMut) -> Option<(u8, Vec<u8>)> {
    if buffer.len() < 5 {
        return None;
    }
    let flags = buffer[0];
    let len = u32::from_be_bytes([buffer[1], buffer[2], buffer[3], buffer[4]]) as usize;
    if buffer.len() < 5 + len {
        return None;
    }
    buffer.advance(5);
    let payload = buffer.split_to(len).to_vec();
    Some((flags, payload))
}

pub(super) fn translate_cursor_payload(value: Value) -> Vec<String> {
    let mut chunks = Vec::new();

    if let Some(text) = value.get("text").and_then(Value::as_str) {
        if !text.is_empty() {
            chunks.push(openai_delta_chunk(json!({ "content": text }), None));
        }
    }

    if let Some(choices) = value.get("choices").and_then(Value::as_array) {
        for choice in choices {
            if let Some(delta) = choice.get("delta").and_then(Value::as_object) {
                let mut delta_obj = json!({});
                let mut has_delta = false;

                if let Some(content) = delta.get("content").and_then(Value::as_str) {
                    if !content.is_empty() {
                        delta_obj["content"] = Value::String(content.to_string());
                        has_delta = true;
                    }
                }

                if let Some(reasoning) = delta.get("reasoning_content").and_then(Value::as_str) {
                    if !reasoning.is_empty() {
                        delta_obj["reasoning_content"] = Value::String(reasoning.to_string());
                        has_delta = true;
                    }
                }

                if let Some(tool_calls) = delta.get("tool_calls").cloned() {
                    delta_obj["tool_calls"] = tool_calls;
                    has_delta = true;
                }

                if has_delta {
                    chunks.push(openai_delta_chunk(delta_obj, None));
                }
            }
        }
    }

    for key in ["thinking", "reasoning", "thought", "reasoning_content"] {
        if let Some(thought) = value.get(key).and_then(Value::as_str) {
            if !thought.is_empty() {
                chunks.push(openai_delta_chunk(
                    json!({ "reasoning_content": thought }),
                    None,
                ));
            }
        }
    }

    if let Some(tool_calls) = value.get("tool_calls").and_then(Value::as_array) {
        chunks.push(openai_delta_chunk(
            json!({ "tool_calls": tool_calls }),
            None,
        ));
    }

    if let Some(err) = value.get("error").and_then(Value::as_object) {
        if let Some(msg) = err.get("message").and_then(Value::as_str) {
            chunks.push(openai_delta_chunk(
                json!({ "content": format!("\n\n**Cursor Error:** {}\n", msg) }),
                None,
            ));
        } else if let Some(code) = err.get("code").and_then(Value::as_str) {
            chunks.push(openai_delta_chunk(
                json!({ "content": format!("\n\n**Cursor Error Code:** {}\n", code) }),
                None,
            ));
        }
    }

    if let Some(msg) = value.get("message").and_then(Value::as_str) {
        chunks.push(openai_delta_chunk(
            json!({ "content": format!("\n\n**Cursor Message:** {}\n", msg) }),
            None,
        ));
    }

    chunks
}
