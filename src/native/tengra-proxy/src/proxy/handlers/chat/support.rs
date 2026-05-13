/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::proxy::types::ChatCompletionRequest;
use axum::{http::StatusCode, Json};
use reqwest::Client;
use serde_json::{Map, Value};
use std::sync::OnceLock;

static UPSTREAM_HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

pub fn upstream_http_client() -> &'static Client {
    UPSTREAM_HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(std::time::Duration::from_secs(600))
            .connect_timeout(std::time::Duration::from_secs(15))
            .pool_max_idle_per_host(8)
            .tcp_keepalive(std::time::Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

pub fn generate_session_key(row: &Value, payload: &ChatCompletionRequest) -> String {
    let account_id = row
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("anon")
        .to_string();
    let conversation_id = payload
        .metadata
        .as_ref()
        .and_then(|m| {
            m.get("conversation_id")
                .or_else(|| m.get("conversationId"))
                .and_then(Value::as_str)
        })
        .unwrap_or("default")
        .to_string();
    format!("{}:{}", account_id, conversation_id)
}

pub fn parse_metadata_map(value: &Value) -> Option<Map<String, Value>> {
    match value {
        Value::Object(map) => Some(map.clone()),
        Value::String(text) => serde_json::from_str::<Value>(text)
            .ok()
            .and_then(|parsed| parsed.as_object().cloned()),
        _ => None,
    }
}

pub fn decrypt_if_needed(token: &str) -> Result<String, (StatusCode, Json<Value>)> {
    if !token.starts_with("Tengra:v1:") {
        return Ok(token.to_string());
    }
    let master_key = crate::security::load_master_key().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": e.to_string()})),
        )
    })?;
    crate::security::decrypt_token(token, &master_key).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": e.to_string()})),
        )
    })
}

pub fn is_quota_exhausted(row: &Value) -> bool {
    row.get("metadata")
        .and_then(|m| m.as_str())
        .and_then(|s| serde_json::from_str::<Value>(s).ok())
        .and_then(|v| {
            v.get("quota")
                .and_then(|q| q.get("remaining"))
                .and_then(|remaining| remaining.as_f64())
                .map(|remaining| remaining <= 0.0)
        })
        .unwrap_or(false)
}

pub fn get_upstream_url(
    provider: &str,
    payload: &ChatCompletionRequest,
    active_key_row: &Value,
    base_url_override: Option<&str>,
) -> String {
    match provider {
        "claude" => "https://api.anthropic.com/v1/messages".to_string(),
        "antigravity" => {
            let base = base_url_override
                .map(str::to_string)
                .unwrap_or_else(|| antigravity_base_url(active_key_row));
            if payload.stream {
                format!("{}/v1internal:streamGenerateContent?alt=sse", base)
            } else {
                format!("{}/v1internal:generateContent", base)
            }
        }
        "codex" => "https://chatgpt.com/backend-api/codex/responses".to_string(),
        "copilot" => "https://api.githubcopilot.com/chat/completions".to_string(),
        "cursor" => "https://api2.cursor.sh/aiserver.v1.AiService/StreamChat".to_string(),
        "deepseek" => "https://api.deepseek.com/chat/completions".to_string(),
        "groq" => "https://api.groq.com/openai/v1/chat/completions".to_string(),
        "mistral" => "https://api.mistral.ai/v1/chat/completions".to_string(),
        "kimi" => "https://api.moonshot.ai/v1/chat/completions".to_string(),
        "openrouter" => "https://openrouter.ai/api/v1/chat/completions".to_string(),
        "xai" => "https://api.x.ai/v1/chat/completions".to_string(),
        "nvidia" => "https://integrate.api.nvidia.com/v1/chat/completions".to_string(),
        "opencode" => "https://opencode.ai/zen/v1/responses".to_string(),
        _ => {
            let metadata = active_key_row
                .get("metadata")
                .and_then(parse_metadata_map)
                .unwrap_or_default();
            let base_url = metadata
                .get("base_url")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .map(|v| v.trim_end_matches('/').to_string())
                .unwrap_or_else(|| "https://api.openai.com/v1".to_string());
            format!("{}/chat/completions", base_url)
        }
    }
}

pub fn extract_model_from_row(row: &Value) -> Option<String> {
    row.get("metadata")
        .and_then(parse_metadata_map)
        .and_then(|m| m.get("model").and_then(Value::as_str).map(str::to_string))
}

pub fn antigravity_base_url(active_key_row: &Value) -> String {
    let metadata = active_key_row
        .get("metadata")
        .and_then(parse_metadata_map)
        .unwrap_or_default();
    metadata
        .get("base_url")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.trim_end_matches('/').to_string())
        .unwrap_or_else(|| "https://daily-cloudcode-pa.googleapis.com".to_string())
}

pub fn requested_account_id(payload: &ChatCompletionRequest) -> Option<String> {
    payload
        .metadata
        .as_ref()
        .and_then(|metadata| metadata.get("account_id").and_then(Value::as_str))
        .or_else(|| {
            payload
                .metadata
                .as_ref()
                .and_then(|metadata| metadata.get("accountId").and_then(Value::as_str))
        })
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}
