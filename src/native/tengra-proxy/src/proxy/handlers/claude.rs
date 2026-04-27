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
    response::{IntoResponse, Response},
    Json,
};
use reqwest::Client;
use serde_json::{json, Value};
use std::sync::{Arc, OnceLock};

use crate::proxy::server::AppState;

static CLAUDE_HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

pub async fn handle_messages(
    _state: State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<Response, (StatusCode, Json<Value>)> {
    let payload = crate::proxy::handlers::chat::compact::compact_claude_messages_payload(payload);
    forward_claude_request(payload, "https://api.anthropic.com/v1/messages").await
}

pub async fn handle_count_tokens(
    _state: State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<Response, (StatusCode, Json<Value>)> {
    forward_claude_request(
        payload,
        "https://api.anthropic.com/v1/messages/count_tokens",
    )
    .await
}

async fn forward_claude_request(
    payload: Value,
    endpoint: &str,
) -> Result<Response, (StatusCode, Json<Value>)> {
    let accounts = crate::db::get_provider_accounts("claude")
        .await
        .map_err(internal_error)?;
    let active_account = accounts
        .iter()
        .find(|row| {
            row.get("is_active")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .or_else(|| accounts.first())
        .ok_or_else(|| unauthorized_error("No active Claude account"))?;
    let auth_token = decrypt_account_token(active_account).map_err(internal_error)?;

    let response = claude_http_client()
        .post(endpoint)
        .header("X-Api-Key", auth_token)
        .header("Anthropic-Version", "2023-06-01")
        .header("Anthropic-Beta", "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14")
        .header("Anthropic-Dangerous-Direct-Browser-Access", "true")
        .header("User-Agent", "claude-cli/1.0.83 (external, cli)")
        .header("X-App", "claude-code")
        .header("X-Stainless-Runtime", "node")
        .header("X-Stainless-Lang", "js")
        .json(&payload)
        .send()
        .await
        .map_err(bad_gateway_error)?;

    let status = response.status();
    let body = response.json::<Value>().await.map_err(bad_gateway_error)?;
    if !status.is_success() {
        return Err((status, Json(body)));
    }

    Ok((status, Json(body)).into_response())
}

fn decrypt_account_token(account: &Value) -> anyhow::Result<String> {
    let token = account
        .get("access_token")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow::anyhow!("Missing Claude access token"))?;
    if !token.starts_with("Tengra:v1:") {
        return Ok(token.to_string());
    }
    let master_key = crate::security::load_master_key()?;
    crate::security::decrypt_token(token, &master_key)
}

fn claude_http_client() -> &'static Client {
    CLAUDE_HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .pool_max_idle_per_host(4)
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

fn internal_error(error: anyhow::Error) -> (StatusCode, Json<Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": error.to_string() })),
    )
}

fn unauthorized_error(message: &str) -> (StatusCode, Json<Value>) {
    (StatusCode::UNAUTHORIZED, Json(json!({ "error": message })))
}

fn bad_gateway_error<E: ToString>(error: E) -> (StatusCode, Json<Value>) {
    (
        StatusCode::BAD_GATEWAY,
        Json(json!({ "error": error.to_string() })),
    )
}
