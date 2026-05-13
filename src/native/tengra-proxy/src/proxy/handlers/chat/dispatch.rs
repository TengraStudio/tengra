/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::proxy::handlers::chat::{
    cursor, rate_limit,
    execute_upstream_request,
};
use crate::proxy::server::AppState;
use crate::proxy::types::ChatCompletionRequest;
use axum::{
    extract::State,
    http::HeaderMap,
    response::Response,
    Json,
};
use serde_json::Value;
use std::sync::Arc;

pub async fn dispatch_provider_request(
    state: State<Arc<AppState>>,
    headers: HeaderMap,
    provider: &str,
    payload: ChatCompletionRequest,
    auth_token: &str,
    active_key_row: &Value,
    cursor_token: Option<&str>,
) -> Result<Response, (axum::http::StatusCode, Json<Value>)> {
    if provider == "cursor" {
        let final_token = cursor_token.unwrap_or(auth_token);
        return cursor::handle_cursor_completions(
            state,
            headers,
            payload,
            final_token,
            active_key_row,
        )
        .await;
    }

    if provider == "copilot" {
        let state_clone = state.clone();
        let payload_clone = payload.clone();
        let provider_clone = provider.to_string();
        let auth_token_clone = auth_token.to_string();
        let active_key_row_clone = active_key_row.clone();
        return rate_limit::execute_copilot_rate_limited(move || async move {
            execute_upstream_request(
                state_clone,
                payload_clone,
                &provider_clone,
                &auth_token_clone,
                &active_key_row_clone,
            )
            .await
        })
        .await;
    }

    if provider == "antigravity" {
        let state_clone = state.clone();
        let payload_clone = payload.clone();
        let provider_clone = provider.to_string();
        let auth_token_clone = auth_token.to_string();
        let active_key_row_clone = active_key_row.clone();
        return rate_limit::execute_antigravity_rate_limited(move || async move {
            execute_upstream_request(
                state_clone,
                payload_clone,
                &provider_clone,
                &auth_token_clone,
                &active_key_row_clone,
            )
            .await
        })
        .await;
    }

    execute_upstream_request(state, payload, provider, auth_token, active_key_row).await
}
