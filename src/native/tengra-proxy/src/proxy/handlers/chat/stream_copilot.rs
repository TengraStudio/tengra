/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use std::sync::Arc;

use axum::extract::State;
use serde_json::{json, Value};

use crate::proxy::handlers::chat::compat::openai::ensure_chat_completion_chunk_object;
use crate::proxy::handlers::chat::stream_support::{
    extract_data_payloads, openai_delta_chunk, usage_chunk_from_totals,
};
use crate::proxy::server::AppState;

#[derive(Default)]
pub(super) struct CopilotStreamState {
    encrypted_reasoning_placeholder_sent: bool,
}

pub(super) fn translate_copilot_frame(
    frame: &str,
    state: &mut CopilotStreamState,
    app_state: &State<Arc<AppState>>,
    session_key: &str,
) -> Vec<String> {
    extract_data_payloads(frame)
        .into_iter()
        .flat_map(|payload| translate_copilot_payload(payload, state, app_state, session_key))
        .collect()
}

fn translate_copilot_payload(
    payload: String,
    state: &mut CopilotStreamState,
    app_state: &State<Arc<AppState>>,
    session_key: &str,
) -> Vec<String> {
    if payload == "[DONE]" {
        return vec![payload];
    }

    let Ok(value) = serde_json::from_str::<Value>(&payload) else {
        return vec![payload];
    };

    intercept_copilot_usage(&value, app_state, session_key);

    if let Some(event_type) = value.get("type").and_then(Value::as_str) {
        if event_type == "assistant.usage" {
            if let Some(data) = value.get("data") {
                return vec![usage_chunk_from_totals(
                    data.get("input_tokens")
                        .and_then(Value::as_u64)
                        .unwrap_or(0),
                    data.get("output_tokens")
                        .and_then(Value::as_u64)
                        .unwrap_or(0),
                    data.get("total_tokens")
                        .and_then(Value::as_u64)
                        .unwrap_or(0),
                )];
            }
        }
    }

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

fn intercept_copilot_usage(value: &Value, app_state: &State<Arc<AppState>>, session_key: &str) {
    let Some(event_type) = value.get("type").and_then(Value::as_str) else {
        return;
    };

    let is_session_info = event_type == "session.usage_info";
    let is_assistant_usage = event_type == "assistant.usage";

    if !is_session_info && !is_assistant_usage {
        return;
    }

    let account_id = session_key.split(':').next().unwrap_or("anon").to_string();
    let app_state = app_state.0.clone();
    let value = value.clone();

    tokio::spawn(async move {
        let mut cache = app_state.copilot_usage_cache.lock().await;
        let entry = cache.entry(account_id).or_insert_with(|| json!({}));

        if is_session_info {
            if let Some(data) = value.get("data") {
                entry["session_limits"] = data.clone();
            }
        } else if is_assistant_usage {
            if let Some(data) = value.get("data") {
                entry["session_usage"] = data.clone();
            }
        }
    });
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
    ensure_chat_completion_chunk_object(&mut value);

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
