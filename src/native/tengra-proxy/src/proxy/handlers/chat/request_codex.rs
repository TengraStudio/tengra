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

use crate::proxy::handlers::chat::request_openai::image_size_from_metadata;
use crate::proxy::handlers::chat::request_support::{
    content_to_text, extract_text_part, insert_optional_value,
};
use crate::proxy::types::{ChatCompletionRequest, ChatMessage};

pub(super) fn translate_codex(payload: &ChatCompletionRequest) -> Value {
    let imagegen_request = is_codex_imagegen_model(&payload.model);
    let mut input = Vec::new();
    let mut instructions = Vec::new();
    for message in &payload.messages {
        if message.role == "system" {
            let text = content_to_text(&message.content);
            if !text.trim().is_empty() {
                instructions.push(text);
            }
            continue;
        }

        if message.role == "tool" {
            let call_id = message
                .tool_call_id
                .clone()
                .filter(|id| !id.is_empty())
                .unwrap_or_else(|| "tool-0".to_string());
            input.push(json!({
                "type": "function_call_output",
                "call_id": call_id,
                "output": content_to_text(&message.content),
            }));
            continue;
        }

        input.push(json!({
            "type": "message",
            "role": if message.role == "system" { "user" } else { message.role.as_str() },
            "content": content_to_codex_parts(message),
        }));
        if message.role == "assistant" {
            append_codex_tool_calls(message, &mut input);
        }
    }

    let mut body = Map::new();
    body.insert(
        "model".to_string(),
        Value::String(if imagegen_request {
            codex_imagegen_main_model(payload)
        } else {
            normalize_codex_model(&payload.model)
        }),
    );
    body.insert("stream".to_string(), Value::Bool(payload.stream));
    body.insert(
        "parallel_tool_calls".to_string(),
        Value::Bool(payload.parallel_tool_calls.unwrap_or(true)),
    );
    body.insert(
        "reasoning".to_string(),
        json!({ "effort": payload.reasoning_effort.clone().unwrap_or_else(|| "medium".to_string()) }),
    );
    body.insert(
        "reasoning.summary".to_string(),
        Value::String("auto".to_string()),
    );
    body.insert(
        "include".to_string(),
        Value::Array(vec![Value::String(
            "reasoning.encrypted_content".to_string(),
        )]),
    );
    body.insert(
        "instructions".to_string(),
        Value::String(instructions.join("\n\n")),
    );
    body.insert("input".to_string(), Value::Array(input));
    body.insert("store".to_string(), Value::Bool(false));
    if !imagegen_request {
        insert_optional_value(&mut body, "metadata", payload.metadata.clone());
    }
    insert_optional_value(
        &mut body,
        "text",
        payload
            .response_format
            .clone()
            .map(|format| json!({ "format": format })),
    );
    if imagegen_request {
        let mut tool = json!({ "type": "image_generation" });
        if let Some(size) = image_size_from_metadata(payload) {
            if let Some(tool_map) = tool.as_object_mut() {
                tool_map.insert("size".to_string(), Value::String(size));
            }
        }
        body.insert("tools".to_string(), Value::Array(vec![tool]));
    } else if let Some(tools) = payload.tools.as_ref() {
        body.insert(
            "tools".to_string(),
            Value::Array(normalize_codex_tools(tools)),
        );
    }
    Value::Object(normalize_object_keys(body))
}

fn normalize_codex_model(model: &str) -> String {
    match model.trim() {
        "codex-latest" | "codex-preview" => "gpt-5-codex".to_string(),
        "codex-stable" => "gpt-5-codex-mini".to_string(),
        other => other.to_string(),
    }
}

fn is_codex_imagegen_model(model: &str) -> bool {
    let normalized = model.trim().to_ascii_lowercase();
    matches!(
        normalized.as_str(),
        "$imagegen" | "imagegen" | "codex/$imagegen" | "codex/imagegen"
    )
}

fn codex_imagegen_main_model(payload: &ChatCompletionRequest) -> String {
    payload
        .metadata
        .as_ref()
        .and_then(|metadata| {
            metadata
                .get("main_model")
                .or_else(|| metadata.get("mainModel"))
                .or_else(|| metadata.get("codex_image_model"))
                .and_then(Value::as_str)
        })
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("gpt-5.4")
        .to_string()
}

fn content_to_codex_parts(message: &ChatMessage) -> Vec<Value> {
    match &message.content {
        Value::String(text) => vec![json!({
            "type": if message.role == "assistant" { "output_text" } else { "input_text" },
            "text": text
        })],
        Value::Array(parts) => {
            let mut converted = Vec::new();
            for part in parts {
                if let Some(text) = extract_text_part(part) {
                    converted.push(json!({
                        "type": if message.role == "assistant" { "output_text" } else { "input_text" },
                        "text": text
                    }));
                    continue;
                }
                if let Some(uri) = part
                    .get("image_url")
                    .and_then(|value| value.get("url"))
                    .and_then(Value::as_str)
                {
                    converted.push(json!({
                        "type": "input_image",
                        "image_url": uri
                    }));
                }
            }
            if converted.is_empty() {
                converted.push(json!({
                    "type": if message.role == "assistant" { "output_text" } else { "input_text" },
                    "text": content_to_text(&message.content)
                }));
            }
            converted
        }
        _ => vec![json!({
            "type": if message.role == "assistant" { "output_text" } else { "input_text" },
            "text": content_to_text(&message.content)
        })],
    }
}

fn append_codex_tool_calls(message: &ChatMessage, input: &mut Vec<Value>) {
    let tool_calls = message
        .tool_calls
        .as_ref()
        .cloned()
        .or_else(|| {
            message.content.as_array().map(|parts| {
                parts
                    .iter()
                    .filter(|part| part.get("type").and_then(Value::as_str) == Some("tool_call"))
                    .cloned()
                    .collect::<Vec<_>>()
            })
        })
        .unwrap_or_default();
    for (index, part) in tool_calls.iter().enumerate() {
        let function_name = part
            .get("function")
            .and_then(|value| value.get("name"))
            .and_then(Value::as_str)
            .unwrap_or_default();
        let call_id = part
            .get("id")
            .and_then(Value::as_str)
            .filter(|id| !id.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| {
                format!(
                    "{}-{}",
                    if function_name.is_empty() {
                        "tool"
                    } else {
                        function_name
                    },
                    index
                )
            });
        input.push(json!({
            "type": "function_call",
            "call_id": call_id,
            "name": function_name,
            "arguments": part
                .get("function")
                .and_then(|value| value.get("arguments"))
                .and_then(Value::as_str)
                .unwrap_or_default(),
        }));
    }
}

fn normalize_codex_tools(tools: &[Value]) -> Vec<Value> {
    tools
        .iter()
        .filter_map(|tool| {
            let tool_object = tool.as_object()?;
            let tool_type = tool_object
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or("function");
            let function_object = tool_object
                .get("function")
                .and_then(Value::as_object)
                .cloned()
                .or_else(|| Some(tool_object.clone()))?;
            let Some(name) = function_object.get("name").and_then(Value::as_str) else {
                if tool_type != "function" {
                    return Some(Value::Object(tool_object.clone()));
                }
                return None;
            };
            let mut normalized = Map::new();
            normalized.insert("type".to_string(), Value::String(tool_type.to_string()));
            normalized.insert("name".to_string(), Value::String(name.to_string()));
            if let Some(description) = function_object.get("description") {
                normalized.insert("description".to_string(), description.clone());
            }
            if let Some(parameters) = function_object.get("parameters") {
                normalized.insert("parameters".to_string(), parameters.clone());
            }
            Some(Value::Object(normalized))
        })
        .collect()
}

fn normalize_object_keys(mut body: Map<String, Value>) -> Map<String, Value> {
    if let Some(reasoning_summary) = body.remove("reasoning.summary") {
        let reasoning = body
            .entry("reasoning".to_string())
            .or_insert_with(|| Value::Object(Map::new()));
        if let Some(map) = reasoning.as_object_mut() {
            map.insert("summary".to_string(), reasoning_summary);
        }
    }
    body
}
