use serde_json::{json, Value};

fn normalize_generic_openai_response(mut v: Value) -> Value {
    // 1. Ensure object type is set
    if v.get("object").is_none() {
        if let Some(obj) = v.as_object_mut() {
            obj.insert("object".to_string(), json!("chat.completion"));
        }
    }

    // 2. Handle reasoning and content mapping in choices
    if let Some(choices) = v.get_mut("choices").and_then(Value::as_array_mut) {
        for choice in choices {
            if let Some(message) = choice.get_mut("message").and_then(Value::as_object_mut) {
                // Map various reasoning fields to reasoning_content
                if !message.contains_key("reasoning_content") {
                    for key in ["reasoning", "thinking", "thought", "reasoning_text"] {
                        if let Some(reasoning) = message.remove(key) {
                            if !reasoning.is_null() {
                                message.insert("reasoning_content".to_string(), reasoning);
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Normalize usage if found in non-standard places
    if v.get("usage").is_none() {
        let usage_keys = ["x_groq", "x_nvidia", "metadata"];
        let mut usage_to_insert = None;
        for key in usage_keys {
            if let Some(nested) = v.get(key).and_then(|v| v.get("usage")) {
                usage_to_insert = Some(nested.clone());
                break;
            }
        }
        if let Some(usage) = usage_to_insert {
            if let Some(obj) = v.as_object_mut() {
                obj.insert("usage".to_string(), usage);
            }
        }
    }

    v
}

fn main() {
    let nvidia_mock_response = json!({
        "id": "mock-123",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Hello! I am Nemotron.",
                    "reasoning": "The user said 'Hi', so I should greet them."
                },
                "finish_reason": "stop"
            }
        ],
        "x_nvidia": {
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 20,
                "total_tokens": 30
            }
        }
    });

    println!("--- Original NVIDIA-style Response ---");
    println!("{}", serde_json::to_string_pretty(&nvidia_mock_response).unwrap());

    let normalized = normalize_generic_openai_response(nvidia_mock_response);

    println!("\n--- Normalized OpenAI Response ---");
    println!("{}", serde_json::to_string_pretty(&normalized).unwrap());
}
