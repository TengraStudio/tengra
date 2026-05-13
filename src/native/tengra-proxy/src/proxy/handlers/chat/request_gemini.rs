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

use crate::proxy::antigravity::{upstream_model_name, DEFAULT_USER_AGENT};
use crate::proxy::handlers::chat::request_support::{
    content_to_text, extract_text_part, insert_optional_number, insert_optional_vec,
};
use crate::proxy::types::{ChatCompletionRequest, ChatMessage};

const GEMINI_FLASH_LEVELS: &[&str] = &["minimal", "low", "medium", "high"];
const GEMINI_PRO_LEVELS: &[&str] = &["low", "high"];

pub(super) fn translate_gemini(payload: &ChatCompletionRequest) -> Value {
    let mut contents = Vec::new();
    let mut system_parts = Vec::new();
    for msg in &payload.messages {
        if msg.role == "system" {
            system_parts.extend(content_to_gemini_parts(&msg.content));
            continue;
        }
        if msg.role == "tool" {
            let tool_response_parts = content_to_gemini_tool_response_parts(msg);
            if !tool_response_parts.is_empty() {
                contents.push(json!({
                    "role": "user",
                    "parts": tool_response_parts,
                }));
            }
            continue;
        }
        contents.push(json!({
            "role": normalize_gemini_role(&msg.role),
            "parts": content_to_gemini_message_parts(msg),
        }));
    }

    let mut generation_config = Map::new();
    insert_optional_number(
        &mut generation_config,
        "temperature",
        payload.temperature.map(f64::from),
    );
    insert_optional_number(
        &mut generation_config,
        "maxOutputTokens",
        payload
            .max_completion_tokens
            .or(payload.max_tokens)
            .map(|value| value as f64),
    );
    insert_optional_number(&mut generation_config, "topP", payload.top_p.map(f64::from));
    insert_optional_vec(
        &mut generation_config,
        "stopSequences",
        payload.stop.as_ref(),
    );
    apply_gemini_reasoning(payload, &mut generation_config);

    let mut body = Map::new();
    body.insert("contents".to_string(), Value::Array(contents));
    body.insert(
        "generationConfig".to_string(),
        Value::Object(generation_config),
    );
    if !system_parts.is_empty() {
        body.insert(
            "systemInstruction".to_string(),
            json!({ "parts": system_parts }),
        );
    }
    if let Some(tools) = payload.tools.as_ref() {
        let function_declarations = normalize_gemini_tools(tools);
        if !function_declarations.is_empty() {
            body.insert(
                "tools".to_string(),
                Value::Array(vec![
                    json!({ "functionDeclarations": function_declarations }),
                ]),
            );
        }
    }
    Value::Object(body)
}

pub(super) fn translate_antigravity(payload: &ChatCompletionRequest) -> Value {
    let mut request = translate_gemini(payload);
    let upstream_model = upstream_model_name(&payload.model);
    let is_gemini_three =
        upstream_model.contains("gemini-3-") || upstream_model.contains("gemini-3.");
    let is_claude_model = upstream_model.contains("claude");
    if let Some(request_map) = request.as_object_mut() {
        request_map.remove("safetySettings");
        if let Some(generation_config) = request_map.get_mut("generationConfig") {
            if let Some(config_map) = generation_config.as_object_mut() {
                config_map.remove("topK");
                if !is_claude_model {
                    config_map.remove("maxOutputTokens");
                }
            }
        }
        let has_tools = request_map
            .get("tools")
            .and_then(Value::as_array)
            .map(|tools| !tools.is_empty())
            .unwrap_or(false);
        if !has_tools {
            request_map.remove("toolConfig");
        } else if !is_gemini_three {
            request_map.insert(
                "toolConfig".to_string(),
                json!({ "functionCallingConfig": { "mode": "VALIDATED" } }),
            );
        }
        request_map.insert(
            "sessionId".to_string(),
            Value::String(uuid::Uuid::new_v4().to_string()),
        );
    }
    json!({
        "model": upstream_model,
        "project": antigravity_project_id(payload),
        "userAgent": antigravity_user_agent(payload),
        "requestId": format!("agent-{}", uuid::Uuid::new_v4()),
        "request": request,
    })
}

fn normalize_gemini_role(role: &str) -> &str {
    match role {
        "assistant" => "model",
        _ => "user",
    }
}

fn antigravity_project_id(payload: &ChatCompletionRequest) -> String {
    payload
        .metadata
        .as_ref()
        .and_then(|metadata| metadata.get("project_id").and_then(Value::as_str))
        .or_else(|| {
            payload
                .metadata
                .as_ref()
                .and_then(|metadata| metadata.get("projectId").and_then(Value::as_str))
        })
        .or_else(|| {
            payload
                .metadata
                .as_ref()
                .and_then(|metadata| metadata.get("project").and_then(Value::as_str))
        })
        .unwrap_or("auto")
        .to_string()
}

fn antigravity_user_agent(payload: &ChatCompletionRequest) -> String {
    payload
        .metadata
        .as_ref()
        .and_then(|metadata| metadata.get("user_agent").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(DEFAULT_USER_AGENT)
        .to_string()
}

fn content_to_gemini_parts(content: &Value) -> Vec<Value> {
    match content {
        Value::String(text) => vec![json!({ "text": text })],
        Value::Array(parts) => {
            let mut converted = Vec::new();
            for part in parts {
                if let Some(text) = extract_text_part(part) {
                    converted.push(json!({ "text": text }));
                    continue;
                }
                if let Some(uri) = part
                    .get("image_url")
                    .and_then(|value| value.get("url"))
                    .and_then(Value::as_str)
                {
                    converted.push(json!({
                        "file_data": {
                            "mime_type": "image/*",
                            "file_uri": uri
                        }
                    }));
                }
            }
            if converted.is_empty() {
                converted.push(json!({ "text": content_to_text(content) }));
            }
            converted
        }
        _ => vec![json!({ "text": content_to_text(content) })],
    }
}

fn content_to_gemini_message_parts(message: &ChatMessage) -> Vec<Value> {
    let mut parts = content_to_gemini_parts(&message.content);
    if message.role != "assistant" {
        return parts;
    }

    let tool_calls = message
        .tool_calls
        .as_ref()
        .cloned()
        .or_else(|| {
            message.content.as_array().map(|content_parts| {
                content_parts
                    .iter()
                    .filter(|part| part.get("type").and_then(Value::as_str) == Some("tool_call"))
                    .cloned()
                    .collect::<Vec<_>>()
            })
        })
        .unwrap_or_default();
    for part in tool_calls {
        let function = part.get("function");
        let name = function
            .and_then(|value| value.get("name"))
            .and_then(Value::as_str)
            .unwrap_or_default();
        if name.is_empty() {
            continue;
        }
        let arguments = function
            .and_then(|value| value.get("arguments"))
            .cloned()
            .unwrap_or_else(|| Value::Object(Map::new()));
        let parsed_arguments = parse_json_string_value(arguments);

        let mut fc = json!({
            "name": name,
            "args": parsed_arguments
        });

        if let Some(ts) = function
            .and_then(|f| f.get("thought_signature"))
            .and_then(Value::as_str)
        {
            fc.as_object_mut()
                .expect("function call should be an object")
                .insert(
                    "thought_signature".to_string(),
                    Value::String(ts.to_string()),
                );
        }

        parts.push(json!({
            "functionCall": fc
        }));
    }
    parts
}

fn content_to_gemini_tool_response_parts(message: &ChatMessage) -> Vec<Value> {
    let tool_response = parse_json_string_value(message.content.clone());
    let function_name = tool_response
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("tool_result")
        .to_string();
    let mut function_response = Map::new();
    function_response.insert("name".to_string(), Value::String(function_name));
    if let Some(tool_call_id) = message.tool_call_id.as_ref().filter(|id| !id.is_empty()) {
        function_response.insert("id".to_string(), Value::String(tool_call_id.clone()));
    }
    function_response.insert(
        "response".to_string(),
        json!({
            "result": tool_response
        }),
    );
    vec![json!({ "functionResponse": Value::Object(function_response) })]
}

fn normalize_gemini_tools(tools: &[Value]) -> Vec<Value> {
    tools
        .iter()
        .filter_map(|tool| {
            let tool_object = tool.as_object()?;
            let function_object = tool_object
                .get("function")
                .and_then(Value::as_object)
                .cloned()
                .or_else(|| Some(tool_object.clone()))?;
            let name = function_object.get("name").and_then(Value::as_str)?;
            let mut declaration = Map::new();
            declaration.insert("name".to_string(), Value::String(name.to_string()));
            if let Some(description) = function_object.get("description") {
                declaration.insert("description".to_string(), description.clone());
            }
            if let Some(parameters) = function_object.get("parameters") {
                declaration.insert("parametersJsonSchema".to_string(), parameters.clone());
            }
            Some(Value::Object(declaration))
        })
        .collect()
}

fn parse_json_string_value(value: Value) -> Value {
    match value {
        Value::String(text) => serde_json::from_str::<Value>(&text).unwrap_or(Value::String(text)),
        other => other,
    }
}

fn apply_gemini_reasoning(
    payload: &ChatCompletionRequest,
    generation_config: &mut Map<String, Value>,
) {
    if is_gemini_3_model(&payload.model) {
        let Some(level) = resolve_gemini_thinking_level(payload) else {
            return;
        };
        generation_config.insert(
            "thinkingConfig".to_string(),
            json!({
                "thinkingLevel": level,
                "includeThoughts": true
            }),
        );
        return;
    }

    let Some(budget) = resolve_gemini_thinking_budget(payload) else {
        return;
    };
    generation_config.insert(
        "thinkingConfig".to_string(),
        json!({
            "thinkingBudget": budget,
            "include_thoughts": true
        }),
    );
}

fn normalize_reasoning_effort(value: &str) -> String {
    value.trim().to_lowercase()
}

pub(super) fn resolve_gemini_thinking_level(payload: &ChatCompletionRequest) -> Option<String> {
    if let Some(level) = payload
        .thinking_level
        .as_deref()
        .map(normalize_reasoning_effort)
    {
        if level != "none" && !level.is_empty() {
            return Some(level);
        }
        return None;
    }

    let effort = payload
        .reasoning_effort
        .as_deref()
        .map(normalize_reasoning_effort)?;
    if effort == "none" {
        return None;
    }
    Some(gemini_level_for_model(&payload.model, &effort))
}

pub(super) fn resolve_gemini_thinking_budget(payload: &ChatCompletionRequest) -> Option<i64> {
    if let Some(budget) = payload.thinking_budget {
        if budget > 0 || budget == -1 {
            return Some(budget);
        }
        return None;
    }

    let effort = payload
        .reasoning_effort
        .as_deref()
        .map(normalize_reasoning_effort)?;
    if effort == "none" {
        return None;
    }
    Some(gemini_budget_for_effort(&effort))
}

pub(super) fn is_gemini_3_model(model: &str) -> bool {
    let normalized = model.trim().to_lowercase().replace('_', "-");
    normalized.starts_with("gemini-3-") || normalized.starts_with("gemini-3.")
}

pub(super) fn gemini_level_for_model(model: &str, effort: &str) -> String {
    if model.to_lowercase().contains("flash") {
        return match effort {
            "minimal" => "minimal".to_string(),
            "low" => "low".to_string(),
            "medium" => "medium".to_string(),
            "high" | "xhigh" | "auto" => "high".to_string(),
            _ => GEMINI_FLASH_LEVELS.last().unwrap_or(&"high").to_string(),
        };
    }

    match effort {
        "high" | "xhigh" | "auto" => "high".to_string(),
        _ => GEMINI_PRO_LEVELS.first().unwrap_or(&"low").to_string(),
    }
}

pub(super) fn gemini_budget_for_effort(effort: &str) -> i64 {
    match effort {
        "minimal" => 512,
        "low" => 1024,
        "medium" => 8192,
        "high" => 24576,
        "xhigh" => 32768,
        "auto" => -1,
        _ => 1024,
    }
}
