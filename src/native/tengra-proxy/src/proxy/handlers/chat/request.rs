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
use crate::proxy::types::{ChatCompletionRequest, ChatMessage};

const GEMINI_FLASH_LEVELS: &[&str] = &["minimal", "low", "medium", "high"];
const GEMINI_PRO_LEVELS: &[&str] = &["low", "high"];

pub fn translate_request(provider: &str, payload: &ChatCompletionRequest) -> Value {
    match provider {
        "claude" => translate_claude(payload),
        "antigravity" => translate_antigravity(payload),
        "copilot" => translate_copilot(payload),
        "codex" => translate_codex(payload),
        "openai" if is_openai_image_model(&payload.model) => {
            translate_openai_image_generation(payload)
        }
        "nvidia" | "openai" => translate_openai_compatible(payload),
        _ => translate_openai_compatible(payload),
    }
}

fn translate_openai_compatible(payload: &ChatCompletionRequest) -> Value {
    let mut body = json!(payload);
    remove_provider_hint(&mut body);
    body
}

fn translate_openai_image_generation(payload: &ChatCompletionRequest) -> Value {
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

fn translate_codex(payload: &ChatCompletionRequest) -> Value {
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
    body.insert("reasoning".to_string(), json!({ "effort": payload.reasoning_effort.clone().unwrap_or_else(|| "medium".to_string()) }));
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

fn translate_claude(payload: &ChatCompletionRequest) -> Value {
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

fn translate_gemini(payload: &ChatCompletionRequest) -> Value {
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

fn translate_antigravity(payload: &ChatCompletionRequest) -> Value {
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

fn translate_copilot(payload: &ChatCompletionRequest) -> Value {
    let raw_model = payload.model.replace("copilot-", "").replace("github-", "");

    let mut body = translate_openai_compatible(payload);
    if let Some(map) = body.as_object_mut() {
        map.insert("model".to_string(), Value::String(raw_model));
        if payload.stream {
            map.insert(
                "stream_options".to_string(),
                json!({ "include_usage": true }),
            );
        }
    }
    body
}

fn remove_provider_hint(body: &mut Value) {
    if let Some(map) = body.as_object_mut() {
        map.remove("provider");
    }
}

fn normalize_codex_model(model: &str) -> String {
    match model.trim() {
        "codex-latest" | "codex-preview" => "gpt-5-codex".to_string(),
        "codex-stable" => "gpt-5-codex-mini".to_string(),
        other => other.to_string(),
    }
}

fn is_openai_image_model(model: &str) -> bool {
    let normalized = normalize_openai_image_model(model).to_ascii_lowercase();
    normalized.starts_with("gpt-image")
        || normalized == "chatgpt-image-latest"
        || normalized.starts_with("dall-e")
}

fn normalize_openai_image_model(model: &str) -> String {
    model
        .trim()
        .strip_prefix("openai/")
        .unwrap_or_else(|| model.trim())
        .to_string()
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

fn image_prompt_from_messages(payload: &ChatCompletionRequest) -> String {
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

fn image_size_from_metadata(payload: &ChatCompletionRequest) -> Option<String> {
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

fn normalize_claude_role(role: &str) -> &str {
    match role {
        "assistant" => "assistant",
        _ => "user",
    }
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

fn insert_optional_number(target: &mut Map<String, Value>, key: &str, value: Option<f64>) {
    if let Some(value) = value {
        target.insert(key.to_string(), Value::from(value));
    }
}

fn insert_optional_vec(target: &mut Map<String, Value>, key: &str, value: Option<&Vec<String>>) {
    if let Some(value) = value {
        target.insert(
            key.to_string(),
            Value::Array(value.iter().cloned().map(Value::String).collect()),
        );
    }
}

fn insert_optional_value(target: &mut Map<String, Value>, key: &str, value: Option<Value>) {
    if let Some(value) = value {
        target.insert(key.to_string(), value);
    }
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
        if kind == "text" {
            return part.get("text").and_then(Value::as_str).map(str::to_string);
        }
        if kind == "input_text" {
            return part.get("text").and_then(Value::as_str).map(str::to_string);
        }
    }
    None
}

fn content_to_claude_blocks(message: &ChatMessage) -> Vec<Value> {
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
            fc.as_object_mut().unwrap().insert(
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

fn resolve_gemini_thinking_level(payload: &ChatCompletionRequest) -> Option<String> {
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

fn resolve_gemini_thinking_budget(payload: &ChatCompletionRequest) -> Option<i64> {
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

fn is_gemini_3_model(model: &str) -> bool {
    let normalized = model.trim().to_lowercase().replace('_', "-");
    normalized.starts_with("gemini-3-") || normalized.starts_with("gemini-3.")
}

fn gemini_level_for_model(model: &str, effort: &str) -> String {
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

fn gemini_budget_for_effort(effort: &str) -> i64 {
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

#[cfg(test)]
mod tests {
    use serde_json::{json, Value};

    use super::{
        gemini_budget_for_effort, gemini_level_for_model, is_gemini_3_model,
        resolve_gemini_thinking_budget, resolve_gemini_thinking_level, translate_request,
    };
    use crate::proxy::types::{ChatCompletionRequest, ChatMessage};

    fn sample_request(model: &str, reasoning_effort: Option<&str>) -> ChatCompletionRequest {
        ChatCompletionRequest {
            model: model.to_string(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: json!([{ "type": "text", "text": "hello" }]),
                name: None,
                tool_calls: None,
                tool_call_id: None,
                refusal: None,
            }],
            stream: false,
            temperature: None,
            max_tokens: Some(128),
            max_completion_tokens: None,
            n: None,
            top_p: None,
            stop: None,
            reasoning_effort: reasoning_effort.map(str::to_string),
            thinking_level: None,
            thinking_budget: None,
            provider: Some("antigravity".to_string()),
            tools: None,
            tool_choice: None,
            response_format: None,
            metadata: None,
            parallel_tool_calls: None,
            user: None,
        }
    }

    #[test]
    fn detects_gemini_3_models() {
        assert!(is_gemini_3_model("gemini-3-flash-preview"));
        assert!(is_gemini_3_model("GEMINI_3_PRO_PREVIEW"));
        assert!(!is_gemini_3_model("gemini-2.5-pro"));
    }

    #[test]
    fn maps_reasoning_effort_to_gemini_budget() {
        assert_eq!(gemini_budget_for_effort("minimal"), 512);
        assert_eq!(gemini_budget_for_effort("medium"), 8192);
        assert_eq!(gemini_budget_for_effort("auto"), -1);
    }

    #[test]
    fn maps_gemini_3_reasoning_to_levels() {
        assert_eq!(
            gemini_level_for_model("gemini-3-flash-preview", "medium"),
            "medium"
        );
        assert_eq!(
            gemini_level_for_model("gemini-3-pro-preview", "minimal"),
            "low"
        );
        assert_eq!(
            gemini_level_for_model("gemini-3-pro-preview", "high"),
            "high"
        );
    }

    #[test]
    fn translates_gemini_reasoning_for_gemini_three() {
        let body = translate_request(
            "antigravity",
            &sample_request("gemini-3-flash-preview", Some("medium")),
        );
        assert_eq!(
            body.get("request")
                .and_then(|value| value.get("generationConfig"))
                .and_then(|value| value.get("thinkingConfig"))
                .and_then(|value| value.get("thinkingLevel"))
                .and_then(Value::as_str),
            Some("medium")
        );
    }

    #[test]
    fn translates_codex_imagegen_to_builtin_image_tool() {
        let body = translate_request("codex", &sample_request("$imagegen", None));
        assert_eq!(body.get("model").and_then(Value::as_str), Some("gpt-5.4"));
        assert_eq!(
            body.get("tools")
                .and_then(Value::as_array)
                .and_then(|tools| tools.first())
                .and_then(|tool| tool.get("type"))
                .and_then(Value::as_str),
            Some("image_generation")
        );
        assert!(body.get("metadata").is_none());
    }

    #[test]
    fn translates_codex_imagegen_resolution_into_tool_size() {
        let mut payload = sample_request("$imagegen", None);
        payload.metadata = Some(json!({ "width": 1536, "height": 1024 }));

        let body = translate_request("codex", &payload);
        assert_eq!(
            body.get("tools")
                .and_then(Value::as_array)
                .and_then(|tools| tools.first())
                .and_then(|tool| tool.get("size"))
                .and_then(Value::as_str),
            Some("1536x1024")
        );
    }

    #[test]
    fn translates_openai_image_model_to_images_api_body() {
        let mut payload = sample_request("openai/gpt-image-1", None);
        payload.metadata = Some(json!({ "width": 1536, "height": 1024 }));
        payload.n = Some(3);

        let body = translate_request("openai", &payload);
        assert_eq!(
            body.get("model").and_then(Value::as_str),
            Some("gpt-image-1")
        );
        assert_eq!(body.get("prompt").and_then(Value::as_str), Some("hello"));
        assert_eq!(body.get("n").and_then(Value::as_u64), Some(3));
        assert_eq!(body.get("size").and_then(Value::as_str), Some("1536x1024"));
    }

    #[test]
    fn prefers_explicit_thinking_level_for_gemini_three() {
        let mut payload = sample_request("gemini-3-flash-preview", None);
        payload.thinking_level = Some("high".to_string());
        assert_eq!(
            resolve_gemini_thinking_level(&payload),
            Some("high".to_string())
        );
    }

    #[test]
    fn preserves_explicit_thinking_budget_for_gemini_twenty_five() {
        let mut payload = sample_request("gemini-2.5-pro", None);
        payload.thinking_budget = Some(4096);
        assert_eq!(resolve_gemini_thinking_budget(&payload), Some(4096));
    }

    #[test]
    fn translates_gemini_tools_and_function_responses() {
        let payload = ChatCompletionRequest {
            model: "gemini-3-flash-preview".to_string(),
            messages: vec![
                ChatMessage {
                    role: "assistant".to_string(),
                    content: json!(""),
                    name: None,
                    tool_calls: Some(vec![json!({
                        "id": "call_1",
                        "type": "function",
                        "function": {
                            "name": "list_directory",
                            "arguments": "{\"path\":\"C:/Users/agnes/Desktop\"}"
                        }
                    })]),
                    tool_call_id: None,
                    refusal: None,
                },
                ChatMessage {
                    role: "tool".to_string(),
                    content: json!({
                        "name": "list_directory",
                        "result": [{ "name": "file.txt", "isDirectory": false }]
                    }),
                    name: None,
                    tool_calls: None,
                    tool_call_id: Some("call_1".to_string()),
                    refusal: None,
                },
            ],
            stream: false,
            temperature: None,
            max_tokens: Some(128),
            max_completion_tokens: None,
            n: None,
            top_p: None,
            stop: None,
            reasoning_effort: None,
            thinking_level: None,
            thinking_budget: None,
            provider: Some("antigravity".to_string()),
            tools: Some(vec![json!({
                "type": "function",
                "function": {
                    "name": "list_directory",
                    "description": "List files in a directory.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": { "type": "string" }
                        }
                    }
                }
            })]),
            tool_choice: None,
            response_format: None,
            metadata: None,
            parallel_tool_calls: None,
            user: None,
        };

        let body = translate_request("antigravity", &payload);
        let request = body.get("request").expect("wrapped request");
        assert_eq!(
            request
                .get("tools")
                .and_then(Value::as_array)
                .and_then(|tools| tools.first())
                .and_then(|tool| tool.get("functionDeclarations"))
                .and_then(Value::as_array)
                .and_then(|tools| tools.first())
                .and_then(|tool| tool.get("name"))
                .and_then(Value::as_str),
            Some("list_directory")
        );
        assert_eq!(
            request
                .get("contents")
                .and_then(Value::as_array)
                .and_then(|contents| contents.first())
                .and_then(|content| content.get("parts"))
                .and_then(Value::as_array)
                .and_then(|parts| parts.iter().find(|part| part.get("functionCall").is_some()))
                .and_then(|part| part.get("functionCall"))
                .and_then(|call| call.get("name"))
                .and_then(Value::as_str),
            Some("list_directory")
        );
        assert_eq!(
            request
                .get("contents")
                .and_then(Value::as_array)
                .and_then(|contents| contents.get(1))
                .and_then(|content| content.get("parts"))
                .and_then(Value::as_array)
                .and_then(|parts| parts.first())
                .and_then(|part| part.get("functionResponse"))
                .and_then(|response| response.get("name"))
                .and_then(Value::as_str),
            Some("list_directory")
        );
        assert_eq!(
            request
                .get("contents")
                .and_then(Value::as_array)
                .and_then(|contents| contents.get(1))
                .and_then(|content| content.get("parts"))
                .and_then(Value::as_array)
                .and_then(|parts| parts.first())
                .and_then(|part| part.get("functionResponse"))
                .and_then(|response| response.get("id"))
                .and_then(Value::as_str),
            Some("call_1")
        );
    }

    #[test]
    fn wraps_antigravity_request_for_cloudcode() {
        let mut payload = sample_request("gemini-3-flash-preview", None);
        payload.metadata = Some(json!({ "project_id": "demo-project" }));
        let body = translate_request("antigravity", &payload);
        assert_eq!(
            body.get("model").and_then(Value::as_str),
            Some("gemini-3-flash")
        );
        assert_eq!(
            body.get("project").and_then(Value::as_str),
            Some("demo-project")
        );
        assert!(body
            .get("request")
            .and_then(|value| value.get("contents"))
            .is_some());
        assert!(body.get("contents").is_none());
        assert!(body.get("requestId").is_some());
        assert!(body
            .get("request")
            .and_then(|value| value.get("sessionId"))
            .is_some());
        assert!(body
            .get("request")
            .and_then(|value| value.get("generationConfig"))
            .and_then(|value| value.get("maxOutputTokens"))
            .is_none());
    }

    #[test]
    fn preserves_openai_style_payload_for_codex() {
        let body = translate_request("codex", &sample_request("codex-latest", None));
        assert_eq!(
            body.get("model").and_then(Value::as_str),
            Some("gpt-5-codex")
        );
        assert!(body.get("provider").is_none());
    }

    #[test]
    fn maps_system_messages_to_codex_instructions() {
        let mut payload = sample_request("codex-latest", None);
        payload.messages.insert(
            0,
            ChatMessage {
                role: "system".to_string(),
                content: json!("Be concise."),
                name: None,
                tool_calls: None,
                tool_call_id: None,
                refusal: None,
            },
        );
        let body = translate_request("codex", &payload);
        assert_eq!(
            body.get("instructions").and_then(Value::as_str),
            Some("Be concise.")
        );
        assert_eq!(
            body.get("input")
                .and_then(Value::as_array)
                .map(|items| items.len()),
            Some(1)
        );
    }

    #[test]
    fn flattens_codex_tools_to_responses_shape() {
        let mut payload = sample_request("codex-latest", None);
        payload.tools = Some(vec![json!({
            "type": "function",
            "function": {
                "name": "list_directory",
                "description": "List files in a directory.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    }
                }
            }
        })]);

        let body = translate_request("codex", &payload);
        assert_eq!(
            body.get("tools")
                .and_then(Value::as_array)
                .and_then(|tools| tools.first())
                .and_then(|tool| tool.get("name"))
                .and_then(Value::as_str),
            Some("list_directory")
        );
        assert!(body
            .get("tools")
            .and_then(Value::as_array)
            .and_then(|tools| tools.first())
            .and_then(|tool| tool.get("function"))
            .is_none());
    }
}
