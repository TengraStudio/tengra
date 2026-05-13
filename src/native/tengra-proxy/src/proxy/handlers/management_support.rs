/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};

use crate::auth::antigravity::client::AntigravityClient;
use crate::auth::claude::client::ClaudeClient;
use crate::auth::codex::client::CodexClient;
use crate::proxy::server::AppState;


pub(super) async fn build_quota_snapshot(state: Arc<AppState>) -> anyhow::Result<Value> {
    let accounts = crate::db::get_all_linked_accounts().await?;
    let tasks = accounts.into_iter().filter_map(|account| {
        let provider_raw = account
            .get("provider")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim()
            .to_ascii_lowercase();
        if provider_raw.is_empty() {
            return None;
        }
        if !matches!(
            provider_raw.as_str(),
            "antigravity"
                | "google"
                | "codex"
                | "openai"
                | "claude"
                | "anthropic"
                | "copilot"
                | "cursor"
        ) {
            return None;
        }

        let access_token = account
            .get("access_token")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or("")
            .to_string();
        if access_token.is_empty() {
            return None;
        }

        let account_id = account
            .get("id")
            .and_then(Value::as_str)
            .map(str::to_string);
        let email = account
            .get("email")
            .and_then(Value::as_str)
            .map(str::to_string);
        let is_active = parse_is_active(&account);

        Some(async move {
            let token = match decrypt_access_token(access_token.as_str()) {
                Ok(value) => value,
                Err(error) => {
                    return json!({
                        "provider": provider_raw,
                        "account_id": account_id,
                        "email": email,
                        "is_active": is_active,
                        "success": false,
                        "error": format!("token_decrypt_failed: {}", error)
                    });
                }
            };

            match tokio::time::timeout(
                Duration::from_millis(10000),
                crate::quota::check_quota(provider_raw.as_str(), token.as_str()),
            )
            .await
            {
                Ok(Ok(mut quota_res)) => {
                    if let Some(q) = &mut quota_res.quota {
                        q.sanitize();
                    }
                    if let Some(models) = &mut quota_res.models {
                        for m in models {
                            m.sanitize();
                        }
                    }

                    let mut res = json!({
                        "provider": provider_raw,
                        "account_id": account_id,
                        "email": email,
                        "is_active": is_active,
                        "success": true,
                    });
                    res["quota"] = json!(quota_res.quota);
                    res["models"] = json!(quota_res.models);
                    res["error"] = json!(quota_res.error);
                    res
                }
                Ok(Err(error)) => json!({
                    "provider": provider_raw,
                    "account_id": account_id,
                    "email": email,
                    "is_active": is_active,
                    "success": false,
                    "error": error.to_string()
                }),
                Err(_) => json!({
                    "provider": provider_raw,
                    "account_id": account_id,
                    "email": email,
                    "is_active": is_active,
                    "success": false,
                    "error": "quota_check_timeout"
                }),
            }
        })
    });

    let results: Vec<Value> = futures::future::join_all(tasks).await;

    let mut merged_results = Vec::new();
    let usage_cache = state.copilot_usage_cache.lock().await;

    for mut res in results {
        if let Some(account_id) = res.get("account_id").and_then(Value::as_str) {
            if let Some(usage) = usage_cache.get(account_id) {
                if let Some(quota) = res.get_mut("quota") {
                    if let Some(limits) = usage.get("session_limits") {
                        quota["session_limits"] = limits.clone();
                    }
                    if let Some(session_usage) = usage.get("session_usage") {
                        quota["session_usage"] = session_usage.clone();
                    }
                }
            }
        }
        merged_results.push(res);
    }

    Ok(json!({
        "timestamp_ms": chrono::Utc::now().timestamp_millis(),
        "accounts": merged_results
    }))
}

pub(super) fn parse_is_active(account: &Value) -> bool {
    match account.get("is_active") {
        Some(Value::Bool(value)) => *value,
        Some(Value::Number(value)) => value.as_i64().unwrap_or(0) != 0,
        Some(Value::String(value)) => matches!(value.as_str(), "1" | "true" | "TRUE"),
        _ => true,
    }
}

pub(super) fn decrypt_access_token(access_token: &str) -> anyhow::Result<String> {
    if !access_token.starts_with("Tengra:v1:") {
        return Ok(access_token.to_string());
    }
    let master_key = crate::security::load_master_key()?;
    let token = crate::security::decrypt_token(access_token, &master_key)?;
    Ok(token)
}

pub(super) fn get_cursor_machine_ids() -> (String, String) {
    let machine_id = std::env::var("TENGRA_CURSOR_MACHINE_ID")
        .unwrap_or_else(|_| uuid::Uuid::new_v4().to_string().replace("-", ""));

    let mac_machine_id = std::env::var("TENGRA_CURSOR_MAC_MACHINE_ID").unwrap_or_else(|_| {
        use sha2::{Digest, Sha256};
        let raw_mac = uuid::Uuid::new_v4().to_string();
        let mut hasher = Sha256::new();
        hasher.update(raw_mac.as_bytes());
        hex::encode(hasher.finalize())
    });

    (machine_id, mac_machine_id)
}

pub(super) async fn build_auth_url(
    provider: &str,
    state: &str,
    verifier: Option<&str>,
    _account_id: Option<&str>,
) -> anyhow::Result<String> {
    match provider {
        "codex" => {
            let pkce = verifier
                .map(|code_verifier| crate::auth::codex::pkce::PKCECodes {
                    code_verifier: code_verifier.to_string(),
                    code_challenge: crate::auth::codex::pkce::generate_challenge(code_verifier),
                })
                .ok_or_else(|| anyhow::anyhow!("Missing PKCE verifier for codex auth"))?;
            Ok(CodexClient::new().await?.generate_auth_url(state, &pkce))
        }
        "claude" => {
            let pkce = verifier
                .map(|code_verifier| crate::auth::codex::pkce::PKCECodes {
                    code_verifier: code_verifier.to_string(),
                    code_challenge: crate::auth::codex::pkce::generate_challenge(code_verifier),
                })
                .ok_or_else(|| anyhow::anyhow!("Missing PKCE verifier for claude auth"))?;
            Ok(ClaudeClient::new().await?.generate_auth_url(state, &pkce))
        }
        "antigravity" => Ok(AntigravityClient::new(None).await?.generate_auth_url(state)),
        _ => Err(anyhow::anyhow!("Unsupported auth provider: {}", provider)),
    }
}
