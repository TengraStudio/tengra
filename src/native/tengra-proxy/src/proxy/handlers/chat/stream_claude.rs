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
use std::sync::Arc;

use axum::extract::State;
use serde_json::{json, Value};

use crate::proxy::handlers::chat::stream_support::{normalize_finish_reason, openai_delta_chunk};
use crate::proxy::server::AppState;

#[derive(Default)]
pub(super) struct ClaudeStreamState {
    tool_calls: HashMap<i64, ClaudeToolCall>,
}

#[derive(Clone)]
struct ClaudeToolCall {
    id: String,
    name: String,
}

pub(super) fn translate_claude_frame(
    frame: &str,
    claude_state: &mut ClaudeStreamState,
    state: &State<Arc<AppState>>,
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
