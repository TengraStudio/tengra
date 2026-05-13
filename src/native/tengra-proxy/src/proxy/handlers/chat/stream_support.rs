/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use serde_json::{json, Value};

use crate::proxy::handlers::chat::compat::openai::{
    build_chat_completion_chunk, ensure_chat_completion_chunk_object, lift_reasoning_fields,
};

pub(super) fn take_next_frame(buffer: &mut String) -> Option<String> {
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

pub(super) fn extract_data_payloads(frame: &str) -> Vec<String> {
    frame
        .lines()
        .filter_map(|line| line.trim().strip_prefix("data:").map(str::trim))
        .filter(|payload| !payload.is_empty())
        .map(str::to_string)
        .collect()
}

pub(super) fn normalize_generic_openai_frame(frame: &str) -> Vec<String> {
    extract_data_payloads(frame)
        .into_iter()
        .map(|payload| {
            if payload == "[DONE]" {
                return payload;
            }
            let Ok(mut value) = serde_json::from_str::<Value>(&payload) else {
                return payload;
            };

            ensure_chat_completion_chunk_object(&mut value);

            if let Some(choices) = value.get_mut("choices").and_then(Value::as_array_mut) {
                for choice in choices {
                    if let Some(delta) = choice.get_mut("delta").and_then(Value::as_object_mut) {
                        lift_reasoning_fields(delta);
                    }
                }
            }

            if value.get("usage").is_none() {
                let usage_keys = ["x_groq", "x_nvidia", "metadata"];
                let mut usage_to_insert = None;
                for key in usage_keys {
                    if let Some(nested) = value.get(key).and_then(|v| v.get("usage")) {
                        usage_to_insert = Some(nested.clone());
                        break;
                    }
                }
                if let Some(usage) = usage_to_insert {
                    if let Some(obj) = value.as_object_mut() {
                        obj.insert("usage".to_string(), usage);
                    }
                }
            }

            value.to_string()
        })
        .collect()
}

pub(super) fn openai_delta_chunk(delta: Value, finish_reason: Option<&'static str>) -> String {
    build_chat_completion_chunk(delta, finish_reason)
}

pub(super) fn normalize_finish_reason(reason: &str) -> Option<&'static str> {
    match reason {
        "end_turn" | "stop_sequence" | "STOP" | "stop" => Some("stop"),
        "max_tokens" | "MAX_TOKENS" | "length" => Some("length"),
        "tool_use" | "TOOL_USE" => Some("tool_calls"),
        "" => None,
        _ => Some("stop"),
    }
}

pub(super) fn usage_chunk_from_totals(prompt: u64, completion: u64, total: u64) -> String {
    json!({
        "object": "chat.completion.chunk",
        "id": format!("chatcmpl-{}", uuid::Uuid::new_v4().simple()),
        "choices": [],
        "usage": {
            "prompt_tokens": prompt,
            "completion_tokens": completion,
            "total_tokens": total
        }
    })
    .to_string()
}
