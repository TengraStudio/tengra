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

pub fn normalize_generic_chat_response(mut value: Value) -> Value {
    ensure_chat_completion_object(&mut value);

    if let Some(choices) = value.get_mut("choices").and_then(Value::as_array_mut) {
        for choice in choices {
            if let Some(message) = choice.get_mut("message").and_then(Value::as_object_mut) {
                lift_reasoning_fields(message);
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

    value
}

pub fn ensure_chat_completion_object(value: &mut Value) {
    if value.get("object").is_none() {
        if let Some(obj) = value.as_object_mut() {
            obj.insert("object".to_string(), json!("chat.completion"));
        }
    }
}

pub fn ensure_chat_completion_chunk_object(value: &mut Value) {
    if value.get("object").is_none() {
        if let Some(obj) = value.as_object_mut() {
            obj.insert("object".to_string(), json!("chat.completion.chunk"));
        }
    }
}

pub fn lift_reasoning_fields(object: &mut Map<String, Value>) {
    if object.contains_key("reasoning_content") {
        return;
    }

    for key in ["reasoning", "thinking", "thought", "reasoning_text"] {
        if let Some(reasoning) = object.remove(key) {
            if !reasoning.is_null() {
                object.insert("reasoning_content".to_string(), reasoning);
                break;
            }
        }
    }
}

pub fn build_chat_completion(
    id: &str,
    created: i64,
    model: &str,
    content: Value,
    reasoning: Value,
    tool_calls: Value,
    images: Value,
    finish_reason: &str,
    usage: Value,
) -> Value {
    json!({
        "id": id,
        "object": "chat.completion",
        "created": created,
        "model": model,
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": content,
                "reasoning_content": reasoning,
                "tool_calls": tool_calls,
                "images": images
            },
            "finish_reason": finish_reason
        }],
        "usage": usage
    })
}

pub fn build_chat_completion_chunk(delta: Value, finish_reason: Option<&str>) -> String {
    json!({
        "object": "chat.completion.chunk",
        "choices": [{
            "index": 0,
            "delta": delta,
            "finish_reason": finish_reason
        }]
    })
    .to_string()
}

pub fn nullable_string(text: String) -> Value {
    if text.is_empty() {
        Value::Null
    } else {
        Value::String(text)
    }
}

pub fn nullable_array(items: Vec<Value>) -> Value {
    if items.is_empty() {
        Value::Null
    } else {
        Value::Array(items)
    }
}

pub fn normalize_responses_usage(usage: Option<&Value>) -> Value {
    let Some(usage) = usage else {
        return json!({});
    };
    if usage.get("prompt_tokens").is_some() {
        return usage.clone();
    }
    json!({
        "prompt_tokens": usage.get("input_tokens").and_then(Value::as_u64).unwrap_or(0),
        "completion_tokens": usage.get("output_tokens").and_then(Value::as_u64).unwrap_or(0),
        "total_tokens": usage.get("total_tokens").and_then(Value::as_u64).unwrap_or(0)
    })
}

#[cfg(test)]
mod tests {
    use super::{
        build_chat_completion, build_chat_completion_chunk, ensure_chat_completion_object,
        lift_reasoning_fields, normalize_generic_chat_response,
    };
    use serde_json::{json, Value};

    #[test]
    fn lifts_reasoning_into_reasoning_content() {
        let mut object = serde_json::Map::new();
        object.insert("reasoning".to_string(), json!("thinking"));
        lift_reasoning_fields(&mut object);
        assert_eq!(
            object.get("reasoning_content").and_then(|v| v.as_str()),
            Some("thinking")
        );
    }

    #[test]
    fn ensures_chat_completion_object() {
        let mut value = json!({"choices":[]});
        ensure_chat_completion_object(&mut value);
        assert_eq!(
            value.get("object").and_then(|v| v.as_str()),
            Some("chat.completion")
        );
    }

    #[test]
    fn builds_openai_compatible_chunk() {
        let chunk = build_chat_completion_chunk(json!({"content":"hi"}), None);
        assert!(chunk.contains("\"chat.completion.chunk\""));
    }

    #[test]
    fn normalizes_generic_response_shape() {
        let value = normalize_generic_chat_response(json!({
            "choices": [{
                "message": { "reasoning": "thought", "content": "ok" }
            }]
        }));
        assert_eq!(
            value["choices"][0]["message"]["reasoning_content"].as_str(),
            Some("thought")
        );
    }

    #[test]
    fn builds_chat_completion_response() {
        let value = build_chat_completion(
            "id",
            1,
            "model",
            json!("hi"),
            Value::Null,
            Value::Null,
            Value::Null,
            "stop",
            json!({}),
        );
        assert_eq!(value["object"].as_str(), Some("chat.completion"));
    }
}
