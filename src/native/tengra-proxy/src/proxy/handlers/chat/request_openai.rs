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

use crate::proxy::types::ChatCompletionRequest;

pub(super) fn translate_standard_openai(payload: &ChatCompletionRequest, provider: &str) -> Value {
    let mut body = translate_openai_compatible(payload);
    if let Some(map) = body.as_object_mut() {
        if let Some(Value::String(model)) = map.get("model") {
            let mut stripped = model.as_str();

            if !["nvidia", "groq", "mistral", "opencode"].contains(&provider) {
                let prefixes = ["deepseek/", "xai/", "openrouter/"];
                for prefix in prefixes {
                    if let Some(s) = stripped.strip_prefix(prefix) {
                        stripped = s;
                        break;
                    }
                }
            }

            map.insert("model".to_string(), Value::String(stripped.to_string()));
        }
    }
    body
}

pub(super) fn translate_openai_compatible(payload: &ChatCompletionRequest) -> Value {
    let mut body = Map::new();
    body.insert("model".to_string(), Value::String(payload.model.clone()));
    body.insert("messages".to_string(), Value::Array(messages_to_openai(&payload.messages)));
    body.insert("stream".to_string(), Value::Bool(payload.stream));

    if payload.stream {
        // Modern OpenAI-compatible providers support include_usage for streaming token counts
        body.insert("stream_options".to_string(), json!({ "include_usage": true }));
    }

    if let Some(temperature) = payload.temperature {
        body.insert("temperature".to_string(), Value::from(temperature as f64));
    }
    if let Some(max_tokens) = payload.max_tokens {
        body.insert("max_tokens".to_string(), Value::from(max_tokens));
    }
    if let Some(max_completion_tokens) = payload.max_completion_tokens {
        body.insert(
            "max_completion_tokens".to_string(),
            Value::from(max_completion_tokens),
        );
    }
    if let Some(n) = payload.n {
        body.insert("n".to_string(), Value::from(n));
    }
    if let Some(top_p) = payload.top_p {
        body.insert("top_p".to_string(), Value::from(top_p as f64));
    }
    if let Some(stop) = payload.stop.as_ref() {
        body.insert(
            "stop".to_string(),
            Value::Array(stop.iter().cloned().map(Value::String).collect()),
        );
    }
    if let Some(tools) = payload.tools.as_ref() {
        body.insert("tools".to_string(), Value::Array(tools.clone()));
    }
    if let Some(tool_choice) = payload.tool_choice.as_ref() {
        body.insert("tool_choice".to_string(), tool_choice.clone());
    }
    if let Some(response_format) = payload.response_format.as_ref() {
        body.insert("response_format".to_string(), response_format.clone());
    }
    if let Some(parallel_tool_calls) = payload.parallel_tool_calls {
        body.insert(
            "parallel_tool_calls".to_string(),
            Value::Bool(parallel_tool_calls),
        );
    }
    if let Some(user) = payload.user.as_ref() {
        if !user.trim().is_empty() {
            body.insert("user".to_string(), Value::String(user.clone()));
        }
    }

    Value::Object(body)
}

pub(super) fn translate_openai_image_generation(payload: &ChatCompletionRequest) -> Value {
    let model = normalize_openai_image_model(&payload.model);
    let mut body = Map::new();
    body.insert("model".to_string(), Value::String(model.clone()));
    body.insert(
        "prompt".to_string(),
        Value::String(image_prompt_from_messages(payload)),
    );
    body.insert(
        "n".to_string(),
        Value::from(payload.n.unwrap_or(1).clamp(1, 8)),
    );
    body.insert(
        "size".to_string(),
        Value::String(image_size_from_metadata(payload).unwrap_or_else(|| "1024x1024".to_string())),
    );

    if model.starts_with("gpt-image") || model == "chatgpt-image-latest" {
        body.insert("quality".to_string(), Value::String("auto".to_string()));
        body.insert(
            "output_format".to_string(),
            Value::String("png".to_string()),
        );
    } else if model.starts_with("dall-e") {
        body.insert(
            "response_format".to_string(),
            Value::String("b64_json".to_string()),
        );
    }

    Value::Object(body)
}

pub(super) fn is_openai_image_model(model: &str) -> bool {
    let normalized = normalize_openai_image_model(model).to_ascii_lowercase();
    normalized.starts_with("gpt-image")
        || normalized == "chatgpt-image-latest"
        || normalized.starts_with("dall-e")
}

pub(super) fn normalize_openai_image_model(model: &str) -> String {
    model
        .trim()
        .strip_prefix("openai/")
        .unwrap_or_else(|| model.trim())
        .to_string()
}

pub(super) fn image_prompt_from_messages(payload: &ChatCompletionRequest) -> String {
    let user_text = payload
        .messages
        .iter()
        .rev()
        .find(|message| message.role == "user")
        .map(|message| content_to_text(&message.content))
        .unwrap_or_else(|| {
            payload
                .messages
                .iter()
                .map(|message| content_to_text(&message.content))
                .collect::<Vec<_>>()
                .join("\n")
        });

    user_text.trim().to_string()
}

pub(super) fn image_size_from_metadata(payload: &ChatCompletionRequest) -> Option<String> {
    let metadata = payload.metadata.as_ref()?;
    if let Some(size) = metadata.get("size").and_then(Value::as_str) {
        let trimmed = size.trim();
        if matches!(trimmed, "1024x1024" | "1024x1536" | "1536x1024" | "auto") {
            return Some(trimmed.to_string());
        }
    }

    let width = metadata
        .get("width")
        .and_then(Value::as_u64)
        .unwrap_or(1024);
    let height = metadata
        .get("height")
        .and_then(Value::as_u64)
        .unwrap_or(1024);
    if width > height {
        return Some("1536x1024".to_string());
    }
    if height > width {
        return Some("1024x1536".to_string());
    }
    Some("1024x1024".to_string())
}

fn messages_to_openai(messages: &[crate::proxy::types::ChatMessage]) -> Vec<Value> {
    messages
        .iter()
        .map(|message| {
            let mut out = Map::new();
            out.insert("role".to_string(), Value::String(message.role.clone()));
            out.insert("content".to_string(), message.content.clone());

            if let Some(name) = message.name.as_ref() {
                if !name.trim().is_empty() {
                    out.insert("name".to_string(), Value::String(name.clone()));
                }
            }
            if let Some(tool_calls) = message.tool_calls.as_ref() {
                if !tool_calls.is_empty() {
                    out.insert("tool_calls".to_string(), Value::Array(tool_calls.clone()));
                }
            }
            if let Some(tool_call_id) = message.tool_call_id.as_ref() {
                if !tool_call_id.trim().is_empty() {
                    out.insert("tool_call_id".to_string(), Value::String(tool_call_id.clone()));
                }
            }
            if let Some(refusal) = message.refusal.as_ref() {
                if !refusal.trim().is_empty() {
                    out.insert("refusal".to_string(), Value::String(refusal.clone()));
                }
            }

            Value::Object(out)
        })
        .collect()
}

fn content_to_text(content: &Value) -> String {
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

fn extract_text_part(part: &Value) -> Option<String> {
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
