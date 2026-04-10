use serde_json::{json, Value};

pub fn translate_response(provider: &str, upstream_response: Value) -> Value {
    match provider {
        "antigravity" => translate_gemini_response(upstream_response),
        "claude" => translate_claude_response(upstream_response),
        _ => upstream_response,
    }
}

fn translate_gemini_response(v: Value) -> Value {
    let gemini_response = unwrap_gemini_response(&v);
    let (content, reasoning, tool_calls) = extract_gemini_parts(gemini_response);
    let finish_reason = gemini_response["candidates"][0]["finishReason"]
        .as_str()
        .unwrap_or("stop")
        .to_lowercase();
    let prompt_tokens = gemini_response["usageMetadata"]["promptTokenCount"]
        .as_u64()
        .unwrap_or(0);
    let completion_tokens = gemini_response["usageMetadata"]["candidatesTokenCount"]
        .as_u64()
        .unwrap_or(0);
    let total_tokens = gemini_response["usageMetadata"]["totalTokenCount"]
        .as_u64()
        .unwrap_or(0);

    json!({
        "id": format!("gemini-{}", uuid::Uuid::new_v4()),
        "object": "chat.completion",
        "created": chrono::Utc::now().timestamp(),
        "model": gemini_response["modelVersion"].as_str().unwrap_or("gemini"),
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content,
                    "reasoning_content": reasoning,
                    "tool_calls": tool_calls
                },
                "finish_reason": finish_reason
            }
        ],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens
        }
    })
}

fn unwrap_gemini_response<'a>(value: &'a Value) -> &'a Value {
    value.get("response").unwrap_or(value)
}

fn translate_claude_response(v: Value) -> Value {
    let (content, reasoning, tool_calls) = extract_claude_content(&v);
    let prompt_tokens = v["usage"]["input_tokens"].as_u64().unwrap_or(0);
    let completion_tokens = v["usage"]["output_tokens"].as_u64().unwrap_or(0);
    let stop_reason = v["stop_reason"].as_str().unwrap_or("stop_sequence");

    let finish_reason = match stop_reason {
        "end_turn" => "stop",
        "max_tokens" => "length",
        "stop_sequence" => "stop",
        _ => "stop",
    };

    json!({
        "id": v["id"].as_str().unwrap_or_default(),
        "object": "chat.completion",
        "created": chrono::Utc::now().timestamp(),
        "model": v["model"].as_str().unwrap_or("claude"),
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content,
                    "reasoning_content": reasoning,
                    "tool_calls": tool_calls
                },
                "finish_reason": finish_reason
            }
        ],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens
        }
    })
}

fn extract_gemini_parts(v: &Value) -> (String, String, Value) {
    let mut content = String::new();
    let mut reasoning = String::new();
    let mut tool_calls = Vec::new();
    let parts = v["candidates"][0]["content"]["parts"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    for part in parts {
        if part.get("thought").and_then(Value::as_bool) == Some(true) {
            reasoning.push_str(part.get("text").and_then(Value::as_str).unwrap_or_default());
            continue;
        }
        if let Some(text) = part.get("text").and_then(Value::as_str) {
            content.push_str(text);
            continue;
        }
        if let Some(function_call) = part.get("functionCall") {
            tool_calls.push(json!({
                "id": format!("gemini-tool-{}", tool_calls.len()),
                "type": "function",
                "function": {
                    "name": function_call.get("name").and_then(Value::as_str).unwrap_or_default(),
                    "arguments": function_call.get("args").cloned().unwrap_or_else(|| json!({})).to_string()
                }
            }));
        }
    }
    if let Some(step) = v.get("step").and_then(Value::as_object) {
        let case = step.get("case").and_then(Value::as_str).unwrap_or_default();
        let value = step.get("value").unwrap_or(&Value::Null);
        if case == "plannerResponse" {
            if let Some(thinking) = value.get("thinking").and_then(Value::as_str) {
                reasoning.push_str(thinking);
            }
            if let Some(modified) = value.get("modifiedResponse").and_then(Value::as_str) {
                content.push_str(modified);
            }
            if let Some(step_tools) = value.get("toolCalls").and_then(Value::as_array) {
                for tool in step_tools {
                    tool_calls.push(json!({
                        "id": format!("gemini-tool-{}", tool_calls.len()),
                        "type": "function",
                        "function": {
                            "name": tool.get("name").and_then(Value::as_str).unwrap_or("tool"),
                            "arguments": tool.get("arguments").cloned().unwrap_or_else(|| json!({})).to_string()
                        }
                    }));
                }
            }
        }
    }
    let tool_calls = if tool_calls.is_empty() {
        Value::Null
    } else {
        Value::Array(tool_calls)
    };
    (content, reasoning, tool_calls)
}

fn extract_claude_content(v: &Value) -> (String, String, Value) {
    let mut content = String::new();
    let mut reasoning = String::new();
    let mut tool_calls = Vec::new();
    let blocks = v["content"].as_array().cloned().unwrap_or_default();
    for block in blocks {
        match block.get("type").and_then(Value::as_str).unwrap_or_default() {
            "text" => content.push_str(block.get("text").and_then(Value::as_str).unwrap_or_default()),
            "thinking" => reasoning.push_str(block.get("thinking").and_then(Value::as_str).unwrap_or_default()),
            "tool_use" => tool_calls.push(json!({
                "id": block.get("id").and_then(Value::as_str).unwrap_or_default(),
                "type": "function",
                "function": {
                    "name": block.get("name").and_then(Value::as_str).unwrap_or_default(),
                    "arguments": block.get("input").cloned().unwrap_or_else(|| json!({})).to_string()
                }
            })),
            _ => {}
        }
    }
    let tool_calls = if tool_calls.is_empty() {
        Value::Null
    } else {
        Value::Array(tool_calls)
    };
    (content, reasoning, tool_calls)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{translate_claude_response, translate_gemini_response};

    #[test]
    fn translates_claude_tool_use_blocks() {
        let value = json!({
            "id": "msg_1",
            "model": "claude-sonnet-4",
            "content": [
                { "type": "text", "text": "hello" },
                { "type": "tool_use", "id": "tool_1", "name": "search", "input": { "q": "x" } }
            ],
            "usage": { "input_tokens": 1, "output_tokens": 2 },
            "stop_reason": "end_turn"
        });
        let translated = translate_claude_response(value);
        assert_eq!(
            translated["choices"][0]["message"]["tool_calls"][0]["function"]["name"].as_str(),
            Some("search")
        );
    }

    #[test]
    fn translates_gemini_thoughts_as_reasoning() {
        let value = json!({
            "candidates": [{
                "content": {
                    "parts": [
                        { "text": "thinking", "thought": true },
                        { "text": "hello" }
                    ]
                },
                "finishReason": "STOP"
            }],
            "usageMetadata": {
                "promptTokenCount": 1,
                "candidatesTokenCount": 2,
                "totalTokenCount": 3
            }
        });
        let translated = translate_gemini_response(value);
        assert_eq!(
            translated["choices"][0]["message"]["reasoning_content"].as_str(),
            Some("thinking")
        );
    }

    #[test]
    fn translates_wrapped_antigravity_response() {
        let value = json!({
            "response": {
                "modelVersion": "gemini-3-flash",
                "candidates": [{
                    "content": {
                        "parts": [{ "text": "hello" }]
                    },
                    "finishReason": "STOP"
                }],
                "usageMetadata": {
                    "promptTokenCount": 1,
                    "candidatesTokenCount": 2,
                    "totalTokenCount": 3
                }
            }
        });
        let translated = translate_gemini_response(value);
        assert_eq!(
            translated["choices"][0]["message"]["content"].as_str(),
            Some("hello")
        );
        assert_eq!(translated["model"].as_str(), Some("gemini-3-flash"));
    }

    #[test]
    fn translates_antigravity_planner_response_payload() {
        let value = json!({
            "response": {
                "modelVersion": "gemini-3-flash",
                "step": {
                    "case": "plannerResponse",
                    "value": {
                        "thinking": "planning...",
                        "modifiedResponse": "final answer"
                    }
                },
                "usageMetadata": {
                    "promptTokenCount": 1,
                    "candidatesTokenCount": 2,
                    "totalTokenCount": 3
                }
            }
        });
        let translated = translate_gemini_response(value);
        assert_eq!(
            translated["choices"][0]["message"]["reasoning_content"].as_str(),
            Some("planning...")
        );
        assert_eq!(
            translated["choices"][0]["message"]["content"].as_str(),
            Some("final answer")
        );
    }
}
