use async_stream::stream;
use axum::{
    body::to_bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{sse::Sse, IntoResponse, Response},
    Json,
};
use futures::{Stream, StreamExt};
use serde_json::{json, Value};
use std::sync::Arc;
use std::{convert::Infallible, pin::Pin};

use crate::proxy::handlers::chat::execute_chat_completion_payload;
use crate::proxy::server::AppState;
use crate::proxy::types::{ChatCompletionRequest, ChatMessage};

pub async fn handle_responses(
    _state: State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<Response, (StatusCode, Json<Value>)> {
    let chat_payload = normalize_responses_request(&payload)
        .map_err(|error| (StatusCode::BAD_REQUEST, Json(json!({ "error": error }))))?;
    if chat_payload.stream {
        let response = execute_chat_completion_payload(chat_payload).await?;
        return Ok(Sse::new(translate_responses_stream(
            response.into_body().into_data_stream(),
        ))
        .into_response());
    }

    let response = execute_chat_completion_payload(chat_payload).await?;
    let status = response.status();
    let body = to_bytes(response.into_body(), 2 * 1024 * 1024)
        .await
        .map_err(|error| {
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": error.to_string() })),
            )
        })?;
    let chat_response: Value = serde_json::from_slice(&body).map_err(|error| {
        (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": error.to_string() })),
        )
    })?;
    Ok((status, Json(openai_chat_to_responses(chat_response))).into_response())
}

fn translate_responses_stream(
    body: impl Stream<Item = Result<bytes::Bytes, axum::Error>> + Send + 'static,
) -> Pin<Box<dyn Stream<Item = Result<axum::response::sse::Event, Infallible>> + Send>> {
    Box::pin(stream! {
        let mut input = Box::pin(body);
        let mut buffer = String::new();
        let mut response_id = uuid::Uuid::new_v4().to_string();
        let mut response_created = false;

        while let Some(chunk) = input.next().await {
            match chunk {
                Ok(bytes) => {
                    buffer.push_str(String::from_utf8_lossy(&bytes).as_ref());
                    while let Some(frame) = take_next_frame(&mut buffer) {
                        for event in chat_frame_to_responses_events(frame.as_str(), &mut response_id, &mut response_created) {
                            yield Ok(axum::response::sse::Event::default().data(event));
                        }
                    }
                }
                Err(error) => {
                    yield Ok(axum::response::sse::Event::default().data(json!({
                        "type": "error",
                        "message": error.to_string()
                    }).to_string()));
                }
            }
        }

        if !buffer.trim().is_empty() {
            for event in chat_frame_to_responses_events(buffer.trim(), &mut response_id, &mut response_created) {
                yield Ok(axum::response::sse::Event::default().data(event));
            }
        }
    })
}

fn take_next_frame(buffer: &mut String) -> Option<String> {
    for delimiter in ["\r\n\r\n", "\n\n"] {
        if let Some(index) = buffer.find(delimiter) {
            let frame = buffer[..index].to_string();
            let remainder = buffer[index + delimiter.len()..].to_string();
            *buffer = remainder;
            return Some(frame);
        }
    }
    None
}

fn chat_frame_to_responses_events(
    frame: &str,
    response_id: &mut String,
    response_created: &mut bool,
) -> Vec<String> {
    let mut events = Vec::new();
    for payload in extract_chat_payloads(frame) {
        if payload == "[DONE]" {
            events.push(
                json!({
                    "type": "response.completed",
                    "response": {
                        "id": response_id,
                        "object": "response",
                        "status": "completed"
                    }
                })
                .to_string(),
            );
            continue;
        }

        let Ok(chunk) = serde_json::from_str::<Value>(&payload) else {
            continue;
        };
        if !*response_created {
            if let Some(chunk_id) = chunk.get("id").and_then(Value::as_str) {
                *response_id = chunk_id.to_string();
            }
            events.push(
                json!({
                    "type": "response.created",
                    "response": {
                        "id": response_id,
                        "object": "response",
                        "status": "in_progress",
                        "model": chunk.get("model").and_then(Value::as_str).unwrap_or_default()
                    }
                })
                .to_string(),
            );
            *response_created = true;
        }
        events.extend(openai_chunk_to_responses_events(
            &chunk,
            response_id.as_str(),
        ));
    }
    events
}

fn extract_chat_payloads(frame: &str) -> Vec<String> {
    frame
        .lines()
        .filter_map(|line| line.trim().strip_prefix("data:").map(str::trim))
        .filter(|payload| !payload.is_empty())
        .map(str::to_string)
        .collect()
}

fn openai_chunk_to_responses_events(chunk: &Value, response_id: &str) -> Vec<String> {
    let mut events = Vec::new();
    let Some(choice) = chunk
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
    else {
        return events;
    };
    let delta = choice.get("delta").cloned().unwrap_or_else(|| json!({}));

    if let Some(text) = delta.get("content").and_then(Value::as_str) {
        if !text.is_empty() {
            events.push(
                json!({
                    "type": "response.output_text.delta",
                    "response_id": response_id,
                    "delta": text
                })
                .to_string(),
            );
        }
    }

    if let Some(reasoning) = delta
        .get("reasoning_content")
        .or_else(|| delta.get("reasoning"))
        .and_then(Value::as_str)
    {
        if !reasoning.is_empty() {
            events.push(
                json!({
                    "type": "response.reasoning_summary_text.delta",
                    "response_id": response_id,
                    "delta": reasoning
                })
                .to_string(),
            );
        }
    }

    if let Some(tool_calls) = delta.get("tool_calls").and_then(Value::as_array) {
        for (index, tool_call) in tool_calls.iter().enumerate() {
            let arguments = tool_call
                .get("function")
                .and_then(|value| value.get("arguments"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            if arguments.is_empty() {
                continue;
            }
            let function_name = tool_call
                .get("function")
                .and_then(|value| value.get("name"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            let tool_call_id = tool_call
                .get("id")
                .and_then(Value::as_str)
                .filter(|id| !id.is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| format!("{}-{}", if function_name.is_empty() { "tool" } else { function_name }, index));
            events.push(
                json!({
                    "type": "response.function_call_arguments.delta",
                    "response_id": response_id,
                    "item_id": tool_call_id.clone(),
                    "call_id": tool_call_id,
                    "name": function_name,
                    "delta": arguments
                })
                .to_string(),
            );
        }
    }

    if let Some(usage) = chunk.get("usage") {
        events.push(
            json!({
                "type": "response.completed",
                "response": {
                    "id": response_id,
                    "object": "response",
                    "status": "completed",
                    "usage": usage
                }
            })
            .to_string(),
        );
    }

    events
}

fn openai_chat_to_responses(chat_response: Value) -> Value {
    let choice = chat_response
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .cloned()
        .unwrap_or_else(|| json!({}));
    let message = choice.get("message").cloned().unwrap_or_else(|| json!({}));
    let text = message
        .get("content")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let reasoning = message
        .get("reasoning_content")
        .or_else(|| message.get("reasoning"))
        .and_then(Value::as_str)
        .map(str::to_string);

    let mut output = vec![json!({
        "type": "message",
        "id": chat_response.get("id").and_then(Value::as_str).unwrap_or("resp_local"),
        "role": "assistant",
        "content": [{
            "type": "output_text",
            "text": text
        }]
    })];

    if let Some(tool_calls) = message.get("tool_calls").and_then(Value::as_array) {
        for (index, tool_call) in tool_calls.iter().enumerate() {
            let function_name = tool_call
                .get("function")
                .and_then(|value| value.get("name"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            let tool_call_id = tool_call
                .get("id")
                .and_then(Value::as_str)
                .filter(|id| !id.is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| format!("{}-{}", if function_name.is_empty() { "tool" } else { function_name }, index));
            output.push(json!({
                "type": "function_call",
                "id": tool_call_id.clone(),
                "call_id": tool_call_id,
                "name": function_name,
                "arguments": tool_call
                    .get("function")
                    .and_then(|value| value.get("arguments"))
                    .and_then(Value::as_str)
                    .unwrap_or_default(),
            }));
        }
    }

    if let Some(reasoning) = reasoning {
        output.insert(
            0,
            json!({
                "type": "reasoning",
                "summary": [{
                    "type": "summary_text",
                    "text": reasoning
                }]
            }),
        );
    }

    json!({
        "id": chat_response.get("id").and_then(Value::as_str).unwrap_or("resp_local"),
        "object": "response",
        "created_at": chat_response.get("created").and_then(Value::as_i64).unwrap_or_default(),
        "model": chat_response.get("model").and_then(Value::as_str).unwrap_or_default(),
        "status": "completed",
        "output_text": text,
        "output": output,
        "usage": chat_response.get("usage").cloned().unwrap_or_else(|| json!({}))
    })
}

fn normalize_responses_request(payload: &Value) -> Result<ChatCompletionRequest, &'static str> {
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
        top_p: payload
            .get("top_p")
            .and_then(Value::as_f64)
            .map(|value| value as f32),
        stop: payload.get("stop").and_then(string_vec_from_value),
        reasoning_effort,
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
    use serde_json::{json, Value};

    use super::{
        chat_frame_to_responses_events, normalize_responses_request, openai_chat_to_responses,
    };

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
            "reasoning": { "effort": "high" }
        });

        let request = normalize_responses_request(&payload).expect("normalized");
        assert_eq!(request.model, "gpt-5-codex");
        assert_eq!(request.messages.len(), 2);
        assert_eq!(request.reasoning_effort.as_deref(), Some("high"));
        assert_eq!(request.messages[1].role, "tool");
    }

    #[test]
    fn converts_chat_completion_to_responses_payload() {
        let payload = json!({
            "id": "chatcmpl_1",
            "created": 123,
            "model": "gpt-5-codex",
            "choices": [{
                "message": {
                    "content": "hello",
                    "reasoning_content": "thinking",
                    "tool_calls": [{
                        "id": "call_1",
                        "function": {
                            "name": "search",
                            "arguments": "{\"q\":\"x\"}"
                        }
                    }]
                }
            }],
            "usage": {
                "prompt_tokens": 1,
                "completion_tokens": 2,
                "total_tokens": 3
            }
        });

        let response = openai_chat_to_responses(payload);
        assert_eq!(
            response.get("object").and_then(Value::as_str),
            Some("response")
        );
        assert_eq!(
            response.get("output_text").and_then(Value::as_str),
            Some("hello")
        );
        assert_eq!(
            response
                .get("output")
                .and_then(Value::as_array)
                .map(|items| items.len()),
            Some(3)
        );
    }

    #[test]
    fn converts_chat_stream_frame_to_responses_events() {
        let mut response_id = "resp_1".to_string();
        let mut created = false;
        let events = chat_frame_to_responses_events(
            "data: {\"id\":\"chatcmpl_1\",\"model\":\"gpt-5-codex\",\"choices\":[{\"delta\":{\"content\":\"hello\"}}]}\n\n",
            &mut response_id,
            &mut created,
        );
        assert_eq!(events.len(), 2);
        assert!(events[0].contains("\"response.created\""));
        assert!(events[1].contains("\"response.output_text.delta\""));
    }
}
