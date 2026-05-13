/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use super::accounts::{get_linked_account, invalidate_linked_accounts_cache};
use super::client::{execute_query, QueryRequest};
use super::support::{
    callback_retry_backoff_ms, canonical_account_id, is_sensitive_metadata_key, now_ms,
    parse_metadata_object, sanitize_token_metadata, sanitize_token_metadata_value,
};
use anyhow::{anyhow, Result};
use serde_json::Value;
use tokio::time::Duration;

pub async fn save_token(token_data: Value, account_id: &str, provider: &str) -> Result<()> {
    let canonical_id = canonical_account_id(provider, account_id);

    let mut access_token = extract_field(&token_data, "access_token");
    let mut refresh_token = extract_field(&token_data, "refresh_token");
    let mut session_token = extract_field(&token_data, "session_token");
    let scope = extract_field(&token_data, "scope");

    let expires_at = token_data
        .get("expires_at")
        .and_then(|v| v.as_i64())
        .or_else(|| {
            token_data
                .get("token")
                .and_then(|t| t.get("expires_at"))
                .and_then(|v| v.as_i64())
        })
        .or_else(|| {
            let expires_in = token_data
                .get("expires_in")
                .and_then(|v| v.as_i64())
                .or_else(|| {
                    token_data
                        .get("token")
                        .and_then(|t| t.get("expires_in"))
                        .and_then(|v| v.as_i64())
                });
            expires_in.map(|seconds| now_ms() + (seconds * 1000))
        });

    let sanitized_metadata = sanitize_token_metadata(&token_data);
    let metadata_json =
        serde_json::to_string(&sanitized_metadata).unwrap_or_else(|_| "{}".to_string());

    // --- ENCRYPTION ---
    if let Ok(master_key) = crate::security::load_master_key() {
        encrypt_if_needed(&mut access_token, &master_key);
        encrypt_if_needed(&mut refresh_token, &master_key);
        encrypt_if_needed(&mut session_token, &master_key);
    }

    let email = token_data
        .get("email")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let display_name = token_data
        .get("display_name")
        .or_else(|| token_data.get("displayName"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let avatar_url = token_data
        .get("avatar_url")
        .or_else(|| token_data.get("avatarUrl"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let now = now_ms();
    let sql = "INSERT INTO linked_accounts (id, provider, email, display_name, avatar_url, access_token, refresh_token, session_token, expires_at, scope, metadata, is_active, created_at, updated_at) \
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, $12, $13) \
               ON CONFLICT(id) DO UPDATE SET provider = EXCLUDED.provider, email = EXCLUDED.email, display_name = EXCLUDED.display_name, avatar_url = EXCLUDED.avatar_url, access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, session_token = EXCLUDED.session_token, expires_at = EXCLUDED.expires_at, scope = EXCLUDED.scope, metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at";

    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![
            Value::String(canonical_id.clone()),
            Value::String(provider.to_string()),
            email.map(Value::String).unwrap_or(Value::Null),
            display_name.map(Value::String).unwrap_or(Value::Null),
            avatar_url.map(Value::String).unwrap_or(Value::Null),
            Value::String(access_token),
            Value::String(refresh_token),
            if session_token.is_empty() {
                Value::Null
            } else {
                Value::String(session_token)
            },
            expires_at.map(Value::from).unwrap_or(Value::Null),
            Value::String(scope),
            Value::String(metadata_json),
            Value::from(now),
            Value::from(now),
        ],
    };

    let res = execute_query(&payload).await?;
    if res.status().is_success() {
        invalidate_linked_accounts_cache().await;
        emit_auth_update(provider, &canonical_id, &token_data);
        Ok(())
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(anyhow!("Failed to save token to DB: {}", err_text))
    }
}

pub async fn save_token_with_retry(
    token_data: Value,
    account_id: &str,
    provider: &str,
    max_attempts: u32,
) -> Result<()> {
    let attempts = max_attempts.max(1);
    let mut last_error = String::new();

    for attempt in 1..=attempts {
        match save_token(token_data.clone(), account_id, provider).await {
            Ok(()) => return Ok(()),
            Err(error) => {
                last_error = error.to_string();
                if attempt < attempts {
                    tokio::time::sleep(Duration::from_millis(callback_retry_backoff_ms(attempt)))
                        .await;
                }
            }
        }
    }

    Err(anyhow!(
        "OAuth callback DB write failed after {} attempts for {} ({}): {}",
        attempts,
        provider,
        account_id,
        last_error
    ))
}

pub async fn update_token_data(account_id: &str, provider: &str, token_data: Value) -> Result<()> {
    let canonical_id = canonical_account_id(provider, account_id);
    let mut access_token = extract_field(&token_data, "access_token");
    let mut refresh_token = extract_field(&token_data, "refresh_token");
    let mut session_token = extract_field(&token_data, "session_token");

    let expires_at = token_data
        .get("expires_at")
        .and_then(|v| v.as_i64())
        .or_else(|| {
            token_data
                .get("token")
                .and_then(|t| t.get("expires_at"))
                .and_then(|v| v.as_i64())
        })
        .or_else(|| {
            let expires_in = token_data
                .get("expires_in")
                .and_then(|v| v.as_i64())
                .or_else(|| {
                    token_data
                        .get("token")
                        .and_then(|t| t.get("expires_in"))
                        .and_then(|v| v.as_i64())
                });
            expires_in.map(|seconds| now_ms() + (seconds * 1000))
        });

    let mut merged_metadata = get_linked_account(provider, account_id)
        .await?
        .map(|row| parse_metadata_object(&row))
        .unwrap_or_default();

    if let Some(token_map) = token_data.as_object() {
        for (key, value) in token_map {
            if is_sensitive_metadata_key(key) {
                continue;
            }
            merged_metadata.insert(key.clone(), sanitize_token_metadata_value(value));
        }
    }
    let metadata_json = Value::Object(merged_metadata).to_string();

    // --- ENCRYPTION ---
    if let Ok(master_key) = crate::security::load_master_key() {
        encrypt_if_needed(&mut access_token, &master_key);
        encrypt_if_needed(&mut refresh_token, &master_key);
        encrypt_if_needed(&mut session_token, &master_key);
    }

    let sql = "UPDATE linked_accounts SET access_token = $1, refresh_token = $2, session_token = $3, expires_at = $4, metadata = $5, updated_at = $6 WHERE id = $7 AND provider = $8";
    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![
            Value::String(access_token),
            Value::String(refresh_token),
            if session_token.is_empty() {
                Value::Null
            } else {
                Value::String(session_token)
            },
            expires_at.map(Value::from).unwrap_or(Value::Null),
            Value::String(metadata_json),
            Value::from(now_ms()),
            Value::String(canonical_id),
            Value::String(provider.to_string()),
        ],
    };

    let res = execute_query(&payload).await?;
    if res.status().is_success() {
        invalidate_linked_accounts_cache().await;
        Ok(())
    } else {
        Err(anyhow!(
            "Failed to update token_data in DB: {}",
            res.status()
        ))
    }
}

pub async fn clear_account_tokens(account_id: &str, provider: &str) -> Result<()> {
    let canonical_id = canonical_account_id(provider, account_id);
    let sql = "UPDATE linked_accounts SET access_token = NULL, refresh_token = NULL, session_token = NULL, expires_at = NULL, updated_at = $1 WHERE id = $2 AND provider = $3";
    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![
            Value::from(now_ms()),
            Value::String(canonical_id),
            Value::String(provider.to_string()),
        ],
    };
    let res = execute_query(&payload).await?;
    if res.status().is_success() {
        invalidate_linked_accounts_cache().await;
        Ok(())
    } else {
        Err(anyhow!("Failed to clear account tokens: {}", res.status()))
    }
}

pub async fn save_api_key(provider: &str, api_key: &str, account_id: &str) -> Result<()> {
    let canonical_id = canonical_account_id(provider, account_id);
    let mut encrypted_key = api_key.to_string();

    if let Ok(master_key) = crate::security::load_master_key() {
        encrypt_if_needed(&mut encrypted_key, &master_key);
    }

    let metadata = serde_json::json!({ "type": "api_key" }).to_string();
    let now = now_ms();
    let sql = "INSERT INTO linked_accounts (id, provider, access_token, metadata, is_active, created_at, updated_at) \
               VALUES ($1, $2, $3, $4, 1, $5, $6) \
               ON CONFLICT(id) DO UPDATE SET access_token = EXCLUDED.access_token, metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at";

    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![
            Value::String(canonical_id),
            Value::String(provider.to_string()),
            Value::String(encrypted_key),
            Value::String(metadata),
            Value::from(now),
            Value::from(now),
        ],
    };

    let res = execute_query(&payload).await?;
    if res.status().is_success() {
        invalidate_linked_accounts_cache().await;
        Ok(())
    } else {
        Err(anyhow!("Failed to save API key: {}", res.status()))
    }
}

pub async fn get_api_keys(provider: &str) -> Result<Vec<Value>> {
    let sql = "SELECT * FROM linked_accounts WHERE provider = $1 AND is_active = 1 AND (metadata LIKE '%\"type\":\"api_key\"%' OR metadata LIKE '%\"auth_type\":\"api_key\"%' OR metadata LIKE '%\"authType\":\"api_key\"%')";
    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![Value::String(provider.to_string())],
    };
    let res = execute_query(&payload).await?;
    if res.status().is_success() {
        let rows: Vec<Value> = res.json().await?;
        Ok(rows)
    } else {
        Err(anyhow!("Failed to get API keys: {}", res.status()))
    }
}

fn extract_field(data: &Value, field: &str) -> String {
    data.get(field)
        .and_then(|v| v.as_str())
        .or_else(|| {
            data.get("token")
                .and_then(|t| t.get(field))
                .and_then(|v| v.as_str())
        })
        .unwrap_or("")
        .to_string()
}

fn encrypt_if_needed(token: &mut String, master_key: &[u8]) {
    if !token.is_empty() && !token.starts_with("Tengra:v1:") {
        if let Ok(enc) = crate::security::encrypt_token(token, master_key) {
            *token = enc;
        }
    }
}

fn emit_auth_update(provider: &str, account_id: &str, token_data: &Value) {
    let payload = serde_json::json!({
        "provider": provider,
        "accountId": account_id,
        "tokenData": token_data,
    });
    println!("__TENGRA_AUTH_UPDATE__:{}", payload);
}
