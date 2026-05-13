/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use serde_json::{json, Map, Value};

use crate::proxy::types::ChatMessage;

pub(super) fn insert_optional_number(
    target: &mut Map<String, Value>,
    key: &str,
    value: Option<f64>,
) {
    if let Some(value) = value {
        target.insert(key.to_string(), Value::from(value));
    }
}

pub(super) fn insert_optional_vec(
    target: &mut Map<String, Value>,
    key: &str,
    value: Option<&Vec<String>>,
) {
    if let Some(value) = value {
        target.insert(
            key.to_string(),
            Value::Array(value.iter().cloned().map(Value::String).collect()),
        );
    }
}

pub(super) fn insert_optional_value(
    target: &mut Map<String, Value>,
    key: &str,
    value: Option<Value>,
) {
    if let Some(value) = value {
        target.insert(key.to_string(), value);
    }
}

pub(super) fn content_to_text(content: &Value) -> String {
    match content {
        Value::String(text) => text.clone(),
        Value::Array(parts) => parts
            .iter()
            .filter_map(extract_text_part)
            .collect::<Vec<_>>()
            .join(""),
        _ => String::new(),
    }
}

pub(super) fn extract_text_part(part: &Value) -> Option<String> {
    if let Some(text) = part.get("text").and_then(Value::as_str) {
        return Some(text.to_string());
    }
    if let Some(kind) = part.get("type").and_then(Value::as_str) {
        if kind == "text" || kind == "input_text" {
            return part.get("text").and_then(Value::as_str).map(str::to_string);
        }
    }
    None
}

pub(super) fn content_to_claude_blocks(message: &ChatMessage) -> Vec<Value> {
    match &message.content {
        Value::String(text) => vec![json!({ "type": "text", "text": text })],
        Value::Array(parts) => {
            let mut blocks = Vec::new();
            for part in parts {
                if let Some(text) = extract_text_part(part) {
                    blocks.push(json!({ "type": "text", "text": text }));
                    continue;
                }
                if let Some(image_url) = part
                    .get("image_url")
                    .and_then(|value| value.get("url"))
                    .and_then(Value::as_str)
                {
                    blocks.push(json!({
                        "type": "image",
                        "source": {
                            "type": "url",
                            "url": image_url
                        }
                    }));
                }
            }
            if blocks.is_empty() {
                blocks.push(json!({ "type": "text", "text": content_to_text(&message.content) }));
            }
            blocks
        }
        _ => vec![json!({ "type": "text", "text": content_to_text(&message.content) })],
    }
}
