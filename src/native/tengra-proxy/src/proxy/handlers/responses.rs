/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Response,
    Json,
};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::proxy::handlers::chat::compat::requests::normalize_responses_request;
use crate::proxy::handlers::chat::execute_chat_completion_payload;
use crate::proxy::server::AppState;

pub async fn handle_responses(
    _state: State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<Response, (StatusCode, Json<Value>)> {
    let chat_payload = normalize_responses_request(&payload)
        .map_err(|error| (StatusCode::BAD_REQUEST, Json(json!({ "error": error }))))?;

    execute_chat_completion_payload(_state, _headers, chat_payload).await
}

#[cfg(test)]
mod tests {
    use crate::proxy::handlers::chat::compat::requests::normalize_responses_request;
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
            "reasoning": { "effort": "high" }
        });

        let request = normalize_responses_request(&payload).expect("normalized");
        assert_eq!(request.model, "gpt-5-codex");
        assert_eq!(request.messages.len(), 2);
        assert_eq!(request.reasoning_effort.as_deref(), Some("high"));
        assert_eq!(request.messages[1].role, "tool");
    }
}
