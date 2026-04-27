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
use serde_json::Value;
use std::sync::{Arc, OnceLock};

use crate::proxy::model_catalog::resolve_provider;
use crate::proxy::server::AppState;

static EMBEDDINGS_HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

pub async fn handle_embeddings(
    _state: State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<Response, (StatusCode, String)> {
    let model = payload
        .get("model")
        .and_then(Value::as_str)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Missing model".to_string()))?;
    if payload.get("input").is_none() {
        return Err((StatusCode::BAD_REQUEST, "Missing input".to_string()));
    }

    let provider = payload
        .get("provider")
        .and_then(Value::as_str)
        .or_else(|| resolve_provider(model))
        .unwrap_or("codex");
    if !matches!(provider, "codex" | "openai" | "nvidia") {
        return Err((
            StatusCode::BAD_REQUEST,
            format!("Embeddings are not supported for provider {}", provider),
        ));
    }

    let accounts = crate::db::get_provider_accounts(provider)
        .await
        .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    let active_account = select_active_account(&accounts).ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            format!("No active account for provider {}", provider),
        )
    })?;

    let raw_token = active_account
        .get("access_token")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let auth_token = decrypt_if_needed(raw_token)
        .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;

    let response = embeddings_http_client()
        .post(embeddings_upstream_url(provider))
        .header("Authorization", format!("Bearer {}", auth_token))
        .json(&strip_provider_hint(payload))
        .send()
        .await
        .map_err(|error| (StatusCode::BAD_GATEWAY, error.to_string()))?;

    let status = response.status();
    let body = response
        .json::<Value>()
        .await
        .map_err(|error| (StatusCode::BAD_GATEWAY, error.to_string()))?;

    if !status.is_success() {
        return Err((status, body.to_string()));
    }

    Ok((status, Json(body)).into_response())
}

fn select_active_account(accounts: &[Value]) -> Option<&Value> {
    accounts
        .iter()
        .find(|row| {
            row.get("is_active")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .or_else(|| accounts.first())
}

fn decrypt_if_needed(token: &str) -> anyhow::Result<String> {
    if !token.starts_with("Tengra:v1:") {
        return Ok(token.to_string());
    }
    let master_key = crate::security::load_master_key()?;
    crate::security::decrypt_token(token, &master_key)
}

fn embeddings_upstream_url(provider: &str) -> &'static str {
    match provider {
        "nvidia" => "https://integrate.api.nvidia.com/v1/embeddings",
        _ => "https://api.openai.com/v1/embeddings",
    }
}

fn strip_provider_hint(payload: Value) -> Value {
    match payload {
        Value::Object(mut map) => {
            map.remove("provider");
            Value::Object(map)
        }
        other => other,
    }
}

fn embeddings_http_client() -> &'static Client {
    EMBEDDINGS_HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::strip_provider_hint;

    #[test]
    fn strips_provider_from_embedding_payload() {
        let payload = json!({
            "model": "text-embedding-3-small",
            "input": "hello",
            "provider": "codex"
        });
        let stripped = strip_provider_hint(payload);
        assert!(stripped.get("provider").is_none());
    }
}
