/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
pub mod refresh;

use crate::db;
use crate::static_config;
use refresh::{execute_refresh, AuthToken};
use std::time::Duration;
use tokio::time::sleep;

const REFRESH_SCAN_INTERVAL_SECS: u64 = 60;
const REFRESH_THRESHOLD_MS: i64 = 30 * 60 * 1000;
const COPILOT_REFRESH_THRESHOLD_MS: i64 = 2 * 60 * 1000;
const REFRESH_MAX_RETRIES: usize = 3;

pub async fn background_refresh_loop() {
    eprintln!("[LOG] Token Background refresh loop started.");

    let client = reqwest::Client::new();

    loop {
        if let Err(error) = refresh_due_tokens_once(&client).await {
            eprintln!("[ERROR] Token loop: {}", error);
        }
        sleep(Duration::from_secs(REFRESH_SCAN_INTERVAL_SECS)).await;
    }
}

pub async fn refresh_account_token(
    account: &serde_json::Value,
) -> Result<Option<AuthToken>, String> {
    let Some((account_id, provider, token)) = refresh_candidate_for_account(account) else {
        return Ok(None);
    };
    let client = reqwest::Client::new();
    refresh_token_with_retries(&client, &account_id, &provider, token).await
}

async fn refresh_due_tokens_once(client: &reqwest::Client) -> Result<(), String> {
    let accounts = db::get_all_linked_accounts()
        .await
        .map_err(|error| format!("DB'den hesap çekilemedi: {}", error))?;
    let mut tokens_to_refresh = Vec::new();
    let now = chrono::Utc::now().timestamp_millis();

    for account in accounts {
        let Some((account_id, provider, token)) = refresh_candidate_for_account(&account) else {
            continue;
        };
        let ttl = token.expires_at.unwrap_or_default() - now;
        if ttl < refresh_threshold_ms(&provider) {
            tokens_to_refresh.push((account_id, provider, token));
        }
    }

    if !tokens_to_refresh.is_empty() {
        eprintln!("[DEBUG] Tokens to refresh: {}", tokens_to_refresh.len());
    }

    for (account_id, provider, token) in tokens_to_refresh {
        let _ = refresh_token_with_retries(client, &account_id, &provider, token).await?;
    }

    Ok(())
}

fn refresh_candidate_for_account(
    account: &serde_json::Value,
) -> Option<(String, String, AuthToken)> {
    let id = account
        .get("id")
        .and_then(|value| value.as_str())?
        .to_string();
    let provider = account
        .get("provider")
        .and_then(|value| value.as_str())?
        .to_string();
    if id.is_empty() || provider.is_empty() || !provider_supports_background_refresh(&provider) {
        return None;
    }
    let token = build_refresh_candidate(account, &id, &provider)?;
    Some((id, provider, token))
}

async fn refresh_token_with_retries(
    client: &reqwest::Client,
    account_id: &str,
    provider: &str,
    token: AuthToken,
) -> Result<Option<AuthToken>, String> {
    eprintln!("[DEBUG] Refreshing token for {} ({})", account_id, provider);
    let (client_id, client_secret_opt) = load_provider_client_config(provider).await;

    for attempt in 1..=REFRESH_MAX_RETRIES {
        let response = execute_refresh(
            client,
            token.clone(),
            client_id.clone(),
            client_secret_opt.clone(),
        )
        .await;
        if response.success {
            return persist_refresh_response(account_id, provider, response.token).await;
        }
        handle_refresh_failure(account_id, provider, attempt, &response).await?;
    }

    Ok(None)
}

async fn persist_refresh_response(
    account_id: &str,
    provider: &str,
    token: Option<AuthToken>,
) -> Result<Option<AuthToken>, String> {
    let Some(new_token) = token else {
        return Ok(None);
    };
    let json_val = serde_json::to_value(&new_token)
        .map_err(|error| format!("Refresh token serialization failed: {}", error))?;
    db::update_token_data(account_id, provider, json_val)
        .await
        .map_err(|error| format!("Refresh DB save failed: {}", error))?;
    eprintln!(
        "[DEBUG] Refresh successful for {} ({})",
        account_id, provider
    );
    Ok(Some(new_token))
}

async fn handle_refresh_failure(
    account_id: &str,
    provider: &str,
    attempt: usize,
    response: &refresh::RefreshResponse,
) -> Result<(), String> {
    eprintln!(
        "[WARN] Failed to refresh {} ({}, attempt {}/{}): {:?}",
        account_id, provider, attempt, REFRESH_MAX_RETRIES, response.error
    );
    if response.invalidate_account {
        db::clear_account_tokens(account_id, provider)
            .await
            .map_err(|error| {
                format!(
                    "Failed to invalidate {} ({}): {}",
                    account_id, provider, error
                )
            })?;
        eprintln!(
            "[WARN] Invalidated stored tokens for {} ({}) after refresh auth failure",
            account_id, provider
        );
        return Err("Stored OAuth token was invalidated".to_string());
    }
    if attempt < REFRESH_MAX_RETRIES {
        sleep(Duration::from_secs(5 * attempt as u64)).await;
    }
    Ok(())
}

fn provider_supports_background_refresh(provider: &str) -> bool {
    matches!(
        provider,
        value if value.contains("copilot")
            || value.contains("codex")
            || value.contains("openai")
            || value.contains("claude")
            || value.contains("anthropic")
            || value.contains("antigravity")
            || value.contains("google")
    )
}

fn refresh_threshold_ms(provider: &str) -> i64 {
    if provider.contains("copilot") {
        return COPILOT_REFRESH_THRESHOLD_MS;
    }

    REFRESH_THRESHOLD_MS
}

fn build_refresh_candidate(
    account: &serde_json::Value,
    id: &str,
    provider: &str,
) -> Option<AuthToken> {
    let master_key = crate::security::load_master_key().ok();
    build_refresh_candidate_with_master_key(account, id, provider, master_key.as_deref())
}

fn build_refresh_candidate_with_master_key(
    account: &serde_json::Value,
    id: &str,
    provider: &str,
    master_key: Option<&[u8]>,
) -> Option<AuthToken> {
    let token_payload = extract_token_payload(account);
    let mut auth_token = token_payload
        .and_then(|value| serde_json::from_value::<AuthToken>(value).ok())
        .unwrap_or(AuthToken {
            id: String::new(),
            provider: String::new(),
            refresh_token: None,
            access_token: None,
            session_token: None,
            expires_at: None,
            scope: None,
            email: None,
        });

    auth_token.access_token =
        decrypt_refresh_token_field(auth_token.access_token, master_key.as_deref());
    auth_token.refresh_token =
        decrypt_refresh_token_field(auth_token.refresh_token, master_key.as_deref());
    auth_token.session_token =
        decrypt_refresh_token_field(auth_token.session_token, master_key.as_deref());

    if auth_token.expires_at.is_none() {
        auth_token.expires_at = extract_expiry(account);
    }

    if auth_token.access_token.is_none() {
        auth_token.access_token = account
            .get("access_token")
            .and_then(|value| value.as_str())
            .map(ToOwned::to_owned)
            .and_then(|value| decrypt_refresh_token_field(Some(value), master_key.as_deref()));
    }

    if auth_token.refresh_token.is_none() {
        auth_token.refresh_token = account
            .get("refresh_token")
            .and_then(|value| value.as_str())
            .map(ToOwned::to_owned)
            .and_then(|value| decrypt_refresh_token_field(Some(value), master_key.as_deref()));
    }

    if auth_token.session_token.is_none() {
        auth_token.session_token = account
            .get("session_token")
            .and_then(|value| value.as_str())
            .map(ToOwned::to_owned)
            .and_then(|value| decrypt_refresh_token_field(Some(value), master_key.as_deref()));
    }

    auth_token.id = id.to_string();
    auth_token.provider = provider.to_string();

    if provider.contains("copilot")
        && auth_token.session_token.is_none()
        && auth_token.access_token.is_some()
    {
        auth_token.expires_at = Some(0);
    }

    let has_required_refresh_credential = if provider.contains("copilot") {
        auth_token.access_token.is_some()
    } else {
        auth_token.refresh_token.is_some()
    };

    if !has_required_refresh_credential {
        return None;
    }

    Some(auth_token)
}

fn decrypt_refresh_token_field(token: Option<String>, master_key: Option<&[u8]>) -> Option<String> {
    let value = token?;
    if !value.starts_with("Tengra:v1:") {
        return Some(value);
    }

    let key = match master_key {
        Some(key) => key,
        None => {
            eprintln!("[WARN] Token loop: master key unavailable for encrypted refresh candidate");
            return None;
        }
    };

    match crate::security::decrypt_token(&value, key) {
        Ok(decrypted) => Some(decrypted),
        Err(error) => {
            eprintln!(
                "[WARN] Token loop: failed to decrypt refresh candidate token: {}",
                error
            );
            None
        }
    }
}

fn extract_token_payload(account: &serde_json::Value) -> Option<serde_json::Value> {
    if let Some(token_data) = account.get("token_data") {
        if token_data.is_object() {
            return Some(token_data.clone());
        }
    }

    let metadata_value = account.get("metadata")?;
    if let Some(metadata_object) = metadata_value.as_object() {
        if let Some(nested_token) = metadata_object.get("token") {
            if nested_token.is_object() {
                return Some(nested_token.clone());
            }
        }
        return Some(serde_json::Value::Object(metadata_object.clone()));
    }

    metadata_value.as_str().and_then(|value| {
        let parsed = serde_json::from_str::<serde_json::Value>(value).ok()?;
        if let Some(nested_token) = parsed.get("token") {
            if nested_token.is_object() {
                return Some(nested_token.clone());
            }
        }
        Some(parsed)
    })
}

fn extract_expiry(account: &serde_json::Value) -> Option<i64> {
    if let Some(explicit) = account.get("expires_at").and_then(|value| value.as_i64()) {
        return Some(explicit);
    }

    let metadata = extract_token_payload(account)?;

    if let Some(explicit) = metadata.get("expires_at").and_then(|value| value.as_i64()) {
        return Some(explicit);
    }

    if let Some(expire_iso) = metadata.get("expire").and_then(|value| value.as_str()) {
        if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(expire_iso) {
            return Some(parsed.timestamp_millis());
        }
    }

    if let Some(expires_in) = metadata.get("expires_in").and_then(|value| value.as_i64()) {
        return Some(chrono::Utc::now().timestamp_millis() + (expires_in * 1000));
    }

    None
}

async fn load_provider_client_config(provider: &str) -> (String, Option<String>) {
    let client_id = static_config::oauth_client_id(provider)
        .unwrap_or_default()
        .to_string();
    let client_secret = static_config::oauth_client_secret(provider).map(ToOwned::to_owned);
    (client_id, client_secret)
}

#[cfg(test)]
mod tests {
    use super::{
        build_refresh_candidate, build_refresh_candidate_with_master_key,
        provider_supports_background_refresh, refresh_threshold_ms, COPILOT_REFRESH_THRESHOLD_MS,
        REFRESH_THRESHOLD_MS,
    };
    use crate::security::encrypt_token;
    use serde_json::json;

    #[test]
    fn skips_non_refreshable_provider_rows() {
        assert!(!provider_supports_background_refresh("proxy_key"));
        assert!(!provider_supports_background_refresh("nvidia"));
        assert!(provider_supports_background_refresh("antigravity"));
        assert!(provider_supports_background_refresh("codex"));
        assert!(provider_supports_background_refresh("copilot"));
    }

    #[test]
    fn requires_refresh_token_for_oauth_refresh_providers() {
        let row = json!({
            "access_token": "access-only",
            "expires_at": 1
        });

        assert!(build_refresh_candidate(&row, "acc-1", "antigravity").is_none());
        assert!(build_refresh_candidate(&row, "acc-2", "codex").is_none());
    }

    #[test]
    fn allows_access_token_only_for_copilot_refresh() {
        let row = json!({
            "access_token": "github-token"
        });

        let candidate = build_refresh_candidate(&row, "acc-3", "copilot")
            .expect("copilot access token should be enough to hydrate session token");

        assert_eq!(candidate.access_token.as_deref(), Some("github-token"));
        assert_eq!(candidate.expires_at, Some(0));
    }

    #[test]
    fn uses_tighter_refresh_threshold_for_copilot() {
        assert_eq!(
            refresh_threshold_ms("copilot"),
            COPILOT_REFRESH_THRESHOLD_MS
        );
        assert_eq!(refresh_threshold_ms("codex"), REFRESH_THRESHOLD_MS);
    }

    #[test]
    fn decrypts_encrypted_refresh_candidates_before_upstream_refresh() {
        let master_key = [7u8; 32];
        let encrypted_refresh =
            encrypt_token("real-refresh-token", &master_key).expect("should encrypt");
        let encrypted_access =
            encrypt_token("real-access-token", &master_key).expect("should encrypt");
        let row = json!({
            "refresh_token": encrypted_refresh,
            "access_token": encrypted_access,
            "expires_at": 1
        });

        let candidate = build_refresh_candidate_with_master_key(
            &row,
            "acc-4",
            "antigravity",
            Some(&master_key),
        )
        .expect("encrypted refresh token should still be usable");

        assert_eq!(
            candidate.refresh_token.as_deref(),
            Some("real-refresh-token")
        );
        assert_eq!(candidate.access_token.as_deref(), Some("real-access-token"));
    }

    #[test]
    fn decrypts_encrypted_copilot_access_tokens() {
        let master_key = [9u8; 32];
        let encrypted_access =
            encrypt_token("github-access-token", &master_key).expect("should encrypt");
        let row = json!({
            "access_token": encrypted_access
        });

        let candidate =
            build_refresh_candidate_with_master_key(&row, "acc-5", "copilot", Some(&master_key))
                .expect("encrypted copilot access token should be usable");

        assert_eq!(
            candidate.access_token.as_deref(),
            Some("github-access-token")
        );
        assert_eq!(candidate.expires_at, Some(0));
    }
}
