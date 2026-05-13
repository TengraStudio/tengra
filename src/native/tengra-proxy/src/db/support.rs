/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use serde_json::{Map, Value};
pub(super) fn normalize_provider(provider: &str) -> &str {
    match provider {
        "codex" => "codex",
        "antigravity" => "antigravity",
        "copilot" => "copilot",
        "anthropic" => "claude",
        "google" => "gemini",
        "github" => "copilot",
        "kimi" | "moonshot" => "kimi",
        "nvidia_key" | "nim" | "nim_openai" => "nvidia",
        "opencode" => "opencode",
        _ => provider,
    }
}

pub(super) fn provider_matches(row_provider: &str, requested_provider: &str) -> bool {
    normalize_provider(row_provider) == normalize_provider(requested_provider)
}

pub(super) fn metadata_string(row: &Value, keys: &[&str]) -> Option<String> {
    let metadata = parse_metadata_object(row);
    for key in keys {
        if let Some(value) = metadata.get(*key).and_then(Value::as_str) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_ascii_lowercase());
            }
        }
    }
    None
}

pub(super) fn is_api_key_account(row: &Value) -> bool {
    metadata_string(row, &["auth_type", "authType", "type"])
        .map(|value| value == "api_key")
        .unwrap_or(false)
}

pub(super) fn provider_hint(row: &Value) -> Option<String> {
    metadata_string(row, &["provider_hint", "providerHint", "provider"])
}

pub(super) fn account_matches_provider(row: &Value, requested_provider: &str) -> bool {
    let row_provider = row
        .get("provider")
        .and_then(Value::as_str)
        .unwrap_or_default();

    if provider_matches(row_provider, requested_provider) {
        if normalize_provider(requested_provider) == "codex"
            && is_api_key_account(row)
            && provider_hint(row).as_deref() == Some("openai")
        {
            return false;
        }
        return true;
    }

    normalize_provider(requested_provider) == "openai"
        && normalize_provider(row_provider) == "codex"
        && is_api_key_account(row)
        && provider_hint(row).as_deref() == Some("openai")
}

pub(super) fn canonical_account_id(provider: &str, account_id: &str) -> String {
    if account_id == "default" {
        return format!("{}_default", normalize_provider(provider));
    }

    account_id.to_string()
}

pub(super) fn parse_metadata_object(row: &Value) -> Map<String, Value> {
    match row.get("metadata") {
        Some(Value::Object(map)) => map.clone(),
        Some(Value::String(text)) => serde_json::from_str::<Value>(text)
            .ok()
            .and_then(|value| value.as_object().cloned())
            .unwrap_or_default(),
        _ => Map::new(),
    }
}

pub(super) fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub(super) fn normalize_openai_metadata_map(row: &Value) -> Option<Map<String, Value>> {
    let mut metadata = parse_metadata_object(row);
    let token_object = metadata.get("token").and_then(Value::as_object).cloned();
    let mut changed = false;

    let token = token_object?;

    for key in [
        "access_token",
        "refresh_token",
        "session_token",
        "expires_at",
        "expires_in",
    ] {
        if !metadata.contains_key(key) {
            if let Some(value) = token.get(key).cloned() {
                metadata.insert(key.to_string(), value);
                changed = true;
            }
        }
    }

    if metadata
        .get("oauth_provider")
        .and_then(Value::as_str)
        .is_none()
    {
        metadata.insert(
            "oauth_provider".to_string(),
            Value::String("openai".to_string()),
        );
        changed = true;
    }

    if let Some(existing_org) = token
        .get("organization")
        .or_else(|| token.get("org"))
        .cloned()
    {
        if !metadata.contains_key("organization") {
            metadata.insert("organization".to_string(), existing_org);
            changed = true;
        }
    }

    if metadata
        .get("migrated_by")
        .and_then(Value::as_str)
        .is_none()
    {
        metadata.insert(
            "migrated_by".to_string(),
            Value::String("oauth-bridge-openai-metadata-v1".to_string()),
        );
        changed = true;
    }

    if metadata
        .get("migration_ts")
        .and_then(Value::as_i64)
        .is_none()
    {
        metadata.insert("migration_ts".to_string(), Value::from(now_ms()));
        changed = true;
    }

    changed.then_some(metadata)
}

pub(super) fn is_sensitive_metadata_key(key: &str) -> bool {
    matches!(
        key.to_ascii_lowercase().as_str(),
        "access_token"
            | "accesstoken"
            | "refresh_token"
            | "refreshtoken"
            | "session_token"
            | "sessiontoken"
            | "id_token"
            | "idtoken"
            | "authorization"
            | "code"
            | "token"
    )
}

pub(super) fn sanitize_token_metadata_value(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut sanitized = Map::new();
            for (key, entry) in map {
                if is_sensitive_metadata_key(key) {
                    continue;
                }
                sanitized.insert(key.clone(), sanitize_token_metadata_value(entry));
            }
            Value::Object(sanitized)
        }
        Value::Array(items) => Value::Array(
            items
                .iter()
                .map(sanitize_token_metadata_value)
                .collect::<Vec<_>>(),
        ),
        _ => value.clone(),
    }
}

pub(super) fn sanitize_token_metadata(token_data: &Value) -> Value {
    sanitize_token_metadata_value(token_data)
}

const CALLBACK_DB_WRITE_RETRY_BACKOFF_MS: u64 = 250;

pub(super) fn callback_retry_backoff_ms(attempt: u32) -> u64 {
    CALLBACK_DB_WRITE_RETRY_BACKOFF_MS.saturating_mul(attempt as u64)
}
