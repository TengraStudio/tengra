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

use crate::proxy::handlers::chat::request_support::{
    content_to_claude_blocks, insert_optional_number, insert_optional_value, insert_optional_vec,
};
use crate::proxy::types::ChatCompletionRequest;

pub(super) fn translate_claude(payload: &ChatCompletionRequest) -> Value {
    let mut system_blocks = Vec::new();
    let mut messages = Vec::new();
    for msg in &payload.messages {
        if msg.role == "system" {
            system_blocks.extend(content_to_claude_blocks(msg));
            continue;
        }
        messages.push(json!({
            "role": normalize_claude_role(&msg.role),
            "content": content_to_claude_blocks(msg),
        }));
    }

    let mut body = Map::new();
    body.insert("model".to_string(), Value::String(payload.model.clone()));
    body.insert("messages".to_string(), Value::Array(messages));
    body.insert(
        "max_tokens".to_string(),
        Value::from(
            payload
                .max_completion_tokens
                .or(payload.max_tokens)
                .unwrap_or(4096),
        ),
    );
    body.insert("stream".to_string(), Value::Bool(payload.stream));
    if !system_blocks.is_empty() {
        body.insert("system".to_string(), Value::Array(system_blocks));
    }
    insert_optional_number(&mut body, "temperature", payload.temperature.map(f64::from));
    insert_optional_number(&mut body, "top_p", payload.top_p.map(f64::from));
    insert_optional_vec(&mut body, "stop_sequences", payload.stop.as_ref());
    insert_optional_value(&mut body, "tools", payload.tools.clone().map(Value::Array));
    insert_optional_value(&mut body, "tool_choice", payload.tool_choice.clone());
    Value::Object(body)
}

fn normalize_claude_role(role: &str) -> &str {
    match role {
        "assistant" => "assistant",
        _ => "user",
    }
}
