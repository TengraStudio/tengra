/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::proxy::types::{ChatCompletionRequest, ChatMessage};
use serde_json::{json, Value};

pub fn normalize_responses_request(payload: &Value) -> Result<ChatCompletionRequest, &'static str> {
    let model = payload
        .get("model")
        .and_then(Value::as_str)
        .ok_or("Missing model")?;

    let messages = if let Some(input) = payload.get("input") {
        normalize_responses_input(input)
    } else if let Some(messages) = payload.get("messages").and_then(Value::as_array) {
        messages
            .iter()
            .map(normalize_openai_message)
            .collect::<Vec<_>>()
    } else {
        return Err("Missing input");
    };

    let reasoning_effort = payload
        .get("reasoning")
        .and_then(|value| value.get("effort"))
        .and_then(Value::as_str)
        .or_else(|| payload.get("reasoning_effort").and_then(Value::as_str))
        .map(str::to_string);

    let response_format = payload
        .get("text")
        .and_then(|value| value.get("format"))
        .cloned()
        .or_else(|| payload.get("response_format").cloned());

    Ok(ChatCompletionRequest {
        model: model.to_string(),
        messages,
        stream: payload
            .get("stream")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        temperature: payload
            .get("temperature")
            .and_then(Value::as_f64)
            .map(|value| value as f32),
        max_tokens: payload
            .get("max_output_tokens")
            .or_else(|| payload.get("max_tokens"))
            .and_then(Value::as_u64)
            .map(|value| value as u32),
        max_completion_tokens: payload
            .get("max_completion_tokens")
            .and_then(Value::as_u64)
            .map(|value| value as u32),
        n: payload
            .get("n")
            .and_then(Value::as_u64)
            .map(|value| value as u32),
        top_p: payload
            .get("top_p")
            .and_then(Value::as_f64)
            .map(|value| value as f32),
        stop: payload.get("stop").and_then(string_vec_from_value),
        reasoning_effort,
        thinking_level: payload
            .get("thinking_level")
            .or_else(|| payload.get("thinkingLevel"))
            .and_then(Value::as_str)
            .map(str::to_string),
        thinking_budget: payload
            .get("thinking_budget")
            .or_else(|| payload.get("thinkingBudget"))
            .and_then(Value::as_i64),
        provider: payload
            .get("provider")
            .and_then(Value::as_str)
            .map(str::to_string),
        tools: payload.get("tools").and_then(Value::as_array).cloned(),
        tool_choice: payload.get("tool_choice").cloned(),
        response_format,
        metadata: payload.get("metadata").cloned(),
        parallel_tool_calls: payload.get("parallel_tool_calls").and_then(Value::as_bool),
        user: payload
            .get("user")
            .and_then(Value::as_str)
            .map(str::to_string),
    })
}

fn normalize_responses_input(input: &Value) -> Vec<ChatMessage> {
    match input {
        Value::String(text) => vec![text_message("user", text)],
        Value::Array(items) => items
            .iter()
            .flat_map(normalize_response_input_item)
            .collect(),
        _ => vec![text_message("user", &input.to_string())],
    }
}

fn normalize_response_input_item(item: &Value) -> Vec<ChatMessage> {
    let item_type = item.get("type").and_then(Value::as_str).unwrap_or_default();
    match item_type {
        "message" => vec![ChatMessage {
            role: item
                .get("role")
                .and_then(Value::as_str)
                .unwrap_or("user")
                .to_string(),
            content: item
                .get("content")
                .cloned()
                .unwrap_or_else(|| Value::String(String::new())),
            name: None,
            tool_calls: item.get("tool_calls").and_then(Value::as_array).cloned(),
            tool_call_id: None,
            refusal: None,
        }],
        "function_call_output" => vec![ChatMessage {
            role: "tool".to_string(),
            content: Value::String(
                item.get("output")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
            ),
            name: None,
            tool_calls: None,
            tool_call_id: item
                .get("call_id")
                .and_then(Value::as_str)
                .map(str::to_string),
            refusal: None,
        }],
        "function_call" => vec![ChatMessage {
            role: "assistant".to_string(),
            content: Value::String(String::new()),
            name: None,
            tool_calls: Some(vec![json!({
                "id": item.get("call_id").and_then(Value::as_str).unwrap_or_default(),
                "type": "function",
                "function": {
                    "name": item.get("name").and_then(Value::as_str).unwrap_or_default(),
                    "arguments": item.get("arguments").and_then(Value::as_str).unwrap_or_default(),
                }
            })]),
            tool_call_id: None,
            refusal: None,
        }],
        _ => vec![ChatMessage {
            role: item
                .get("role")
                .and_then(Value::as_str)
                .unwrap_or("user")
                .to_string(),
            content: item
                .get("content")
                .cloned()
                .unwrap_or_else(|| Value::String(item.to_string())),
            name: None,
            tool_calls: item.get("tool_calls").and_then(Value::as_array).cloned(),
            tool_call_id: None,
            refusal: None,
        }],
    }
}

fn normalize_openai_message(item: &Value) -> ChatMessage {
    ChatMessage {
        role: item
            .get("role")
            .and_then(Value::as_str)
            .unwrap_or("user")
            .to_string(),
        content: item
            .get("content")
            .cloned()
            .unwrap_or_else(|| Value::String(String::new())),
        name: item.get("name").and_then(Value::as_str).map(str::to_string),
        tool_calls: item.get("tool_calls").and_then(Value::as_array).cloned(),
        tool_call_id: item
            .get("tool_call_id")
            .and_then(Value::as_str)
            .map(str::to_string),
        refusal: item
            .get("refusal")
            .and_then(Value::as_str)
            .map(str::to_string),
    }
}

fn text_message(role: &str, text: &str) -> ChatMessage {
    ChatMessage {
        role: role.to_string(),
        content: Value::String(text.to_string()),
        name: None,
        tool_calls: None,
        tool_call_id: None,
        refusal: None,
    }
}

fn string_vec_from_value(value: &Value) -> Option<Vec<String>> {
    value.as_array().map(|items| {
        items
            .iter()
            .filter_map(|item| item.as_str().map(str::to_string))
            .collect()
    })
}

#[cfg(test)]
mod tests {
    use super::normalize_responses_request;
    use serde_json::json;

    #[test]
    fn normalizes_responses_input_to_chat_payload() {
        let payload = json!({
            "model": "gpt-5-codex",
            "input": [
                {
                    "type": "message",
                    "role": "user",
                    "content": [{ "type": "input_text", "text": "hello" }]
                },
                {
                    "type": "function_call_output",
                    "call_id": "call_1",
                    "output": "ok"
                }
            ],
            "reasoning": { "effort": "medium" },
            "text": { "format": { "type": "json_schema" } }
        });

        let request = normalize_responses_request(&payload).expect("normalized");
        assert_eq!(request.model, "gpt-5-codex");
        assert_eq!(request.messages.len(), 2);
        assert_eq!(request.reasoning_effort.as_deref(), Some("medium"));
        assert!(request.response_format.is_some());
    }
}
