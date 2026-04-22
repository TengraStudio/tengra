/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::auth::antigravity::client::AntigravityClient;
use crate::auth::claude::client::ClaudeClient;
use crate::auth::codex::client::CodexClient;
use crate::auth::copilot::CopilotClient;
use crate::auth::ollama::client::OllamaClient;
use crate::auth::session::{
    cancel_session, complete_external_session, create_session, ensure_callback_server,
    get_session_status_for, handle_manual_callback_request, ManualOAuthCallback,
};
use crate::proxy::server::AppState;
use axum::{
    extract::{Query, State},
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;
use tokio_stream::{wrappers::IntervalStream, StreamExt};

const OLLAMA_AUTHORIZED_FALLBACK_URL: &str = "https://ollama.com/connect";

#[derive(Deserialize)]
pub struct PollQuery {
    pub device_code: String,
    #[serde(rename = "account_id")]
    pub _account_id: Option<String>,
    pub provider: Option<String>,
}

#[derive(Deserialize)]
pub struct QuotaQuery {
    pub provider: String,
    pub account_id: Option<String>,
}

#[derive(Deserialize)]
pub struct AuthStatusQuery {
    pub provider: String,
    pub state: String,
    pub account_id: String,
}

#[derive(Deserialize)]
pub struct AuthUrlQuery {
    pub account_id: Option<String>,
}

#[derive(Deserialize)]
pub struct CancelAuthRequest {
    pub provider: String,
    pub state: String,
    pub account_id: String,
}

#[derive(Deserialize, Default)]
pub struct OllamaSignoutRequest {
    pub account_id: Option<String>,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Serialize)]
pub struct PollResponse {
    pub success: bool,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub refresh_token_expires_in: Option<u64>,
    pub token_type: Option<String>,
    pub scope: Option<String>,
    pub session_token: Option<String>,
    pub expires_at: Option<i64>,
    pub copilot_plan: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct AuthUrlResponse {
    pub url: String,
    pub state: String,
    pub account_id: String,
}

pub async fn handle_github_login(
    _state: State<Arc<AppState>>,
) -> Result<Json<LoginResponse>, (axum::http::StatusCode, String)> {
    let client = CopilotClient::new();
    let res = client
        .initiate_device_flow()
        .await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(LoginResponse {
        device_code: res.device_code,
        user_code: res.user_code,
        verification_uri: res.verification_uri,
        expires_in: res.expires_in,
        interval: res.interval,
    }))
}

pub async fn handle_github_poll(
    _state: State<Arc<AppState>>,
    Query(query): Query<PollQuery>,
) -> Result<Json<PollResponse>, (axum::http::StatusCode, String)> {
    let client = CopilotClient::new();
    let res = client.poll_for_token(&query.device_code).await;

    match res {
        Ok(token_resp) => {
            if let Some(error) = token_resp.error {
                return Ok(Json(PollResponse {
                    success: false,
                    access_token: None,
                    refresh_token: None,
                    refresh_token_expires_in: None,
                    token_type: None,
                    scope: None,
                    session_token: None,
                    expires_at: None,
                    copilot_plan: None,
                    error: Some(error),
                }));
            }

            let Some(access_token) = token_resp.access_token else {
                return Ok(Json(PollResponse {
                    success: false,
                    access_token: None,
                    refresh_token: None,
                    refresh_token_expires_in: None,
                    token_type: None,
                    scope: None,
                    session_token: None,
                    expires_at: None,
                    copilot_plan: None,
                    error: Some("No access token in GitHub response".to_string()),
                }));
            };

            let provider = query.provider.as_deref().unwrap_or("github");
            let is_copilot = provider.eq_ignore_ascii_case("copilot");
            if !is_copilot {
                return Ok(Json(PollResponse {
                    success: true,
                    access_token: Some(access_token),
                    refresh_token: token_resp.refresh_token,
                    refresh_token_expires_in: token_resp.refresh_token_expires_in,
                    token_type: token_resp.token_type,
                    scope: token_resp.scope,
                    session_token: None,
                    expires_at: None,
                    copilot_plan: None,
                    error: None,
                }));
            }

            // After getting GitHub token, we should also try to get the Copilot session token
            // to verify they actually have Copilot.
            let session_res = client.exchange_for_copilot_token(&access_token).await;

            match session_res {
                Ok(session) => {
                    let copilot_plan = client
                        .fetch_copilot_plan(&access_token)
                        .await
                        .unwrap_or_else(|_| "individual".to_string());
                    let expires_at = (session.expires_at as i64) * 1000;

                    Ok(Json(PollResponse {
                        success: true,
                        access_token: Some(access_token),
                        refresh_token: token_resp.refresh_token,
                        refresh_token_expires_in: token_resp.refresh_token_expires_in,
                        token_type: token_resp.token_type,
                        scope: token_resp.scope,
                        session_token: Some(session.token),
                        expires_at: Some(expires_at),
                        copilot_plan: Some(copilot_plan),
                        error: None,
                    }))
                }
                Err(e) => Ok(Json(PollResponse {
                    success: false,
                    access_token: None,
                    refresh_token: None,
                    refresh_token_expires_in: None,
                    token_type: None,
                    scope: None,
                    session_token: None,
                    expires_at: None,
                    copilot_plan: None,
                    error: Some(format!(
                        "GitHub login successful, but your account doesn't have an active Copilot subscription: {}",
                        e
                    )),
                })),
            }
        }
        Err(e) => {
            // Still waiting or error
            Ok(Json(PollResponse {
                success: false,
                access_token: None,
                refresh_token: None,
                refresh_token_expires_in: None,
                token_type: None,
                scope: None,
                session_token: None,
                expires_at: None,
                copilot_plan: None,
                error: Some(e.to_string()),
            }))
        }
    }
}
pub async fn handle_list_accounts(
    _state: State<Arc<AppState>>,
) -> Result<Json<Vec<serde_json::Value>>, (axum::http::StatusCode, String)> {
    match crate::db::get_all_linked_accounts().await {
        Ok(accounts) => Ok(Json(accounts)),
        Err(e) => Err((axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

pub async fn handle_get_quota(
    _state: State<Arc<AppState>>,
    Query(query): Query<QuotaQuery>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let accounts = crate::db::get_provider_accounts(&query.provider)
        .await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let row = if let Some(account_id) = query.account_id.as_deref() {
        accounts
            .into_iter()
            .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(account_id))
    } else {
        accounts.into_iter().next()
    }
    .ok_or_else(|| {
        (
            axum::http::StatusCode::NOT_FOUND,
            "Account not found".to_string(),
        )
    })?;

    let access_token = row
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                "No token for account".to_string(),
            )
        })?;

    let master_key = crate::security::load_master_key()
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let decrypted_token = if access_token.starts_with("Tengra:v1:") {
        crate::security::decrypt_token(access_token, &master_key)
            .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    } else {
        access_token.to_string()
    };

    match crate::quota::check_quota(&query.provider, &decrypted_token).await {
        Ok(res) => Ok(Json(serde_json::to_value(res).unwrap_or_default())),
        Err(e) => Err((axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

pub async fn handle_get_quota_snapshot(
    _state: State<Arc<AppState>>,
) -> Result<Json<Value>, (axum::http::StatusCode, String)> {
    let snapshot = build_quota_snapshot().await.map_err(|e| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            e.to_string(),
        )
    })?;
    Ok(Json(snapshot))
}

pub async fn handle_stream_quota(
    _state: State<Arc<AppState>>,
) -> Sse<impl futures::Stream<Item = Result<Event, Infallible>>> {
    let stream = IntervalStream::new(tokio::time::interval(Duration::from_secs(20))).then(|_| async {
        let payload = match build_quota_snapshot().await {
            Ok(snapshot) => snapshot,
            Err(error) => json!({
                "timestamp_ms": chrono::Utc::now().timestamp_millis(),
                "accounts": [],
                "error": error.to_string()
            }),
        };

        Ok(Event::default()
            .event("snapshot")
            .data(payload.to_string()))
    });

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(10))
            .text("keepalive"),
    )
}

async fn build_quota_snapshot() -> anyhow::Result<Value> {
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
                | "github"
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
                Duration::from_millis(900),
                crate::quota::check_quota(provider_raw.as_str(), token.as_str())
            ).await {
                Ok(Ok(quota)) => json!({
                    "provider": provider_raw,
                    "account_id": account_id,
                    "email": email,
                    "is_active": is_active,
                    "success": true,
                    "quota": quota
                }),
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

    Ok(json!({
        "timestamp_ms": chrono::Utc::now().timestamp_millis(),
        "accounts": results
    }))
}

fn parse_is_active(account: &Value) -> bool {
    match account.get("is_active") {
        Some(Value::Bool(value)) => *value,
        Some(Value::Number(value)) => value.as_i64().unwrap_or(0) != 0,
        Some(Value::String(value)) => matches!(value.as_str(), "1" | "true" | "TRUE"),
        _ => true,
    }
}

fn decrypt_access_token(access_token: &str) -> anyhow::Result<String> {
    if !access_token.starts_with("Tengra:v1:") {
        return Ok(access_token.to_string());
    }
    let master_key = crate::security::load_master_key()?;
    let token = crate::security::decrypt_token(access_token, &master_key)?;
    Ok(token)
}

pub async fn handle_manual_oauth_callback(
    _state: State<Arc<AppState>>,
    Json(payload): Json<ManualOAuthCallback>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let status = handle_manual_callback_request(payload)
        .await
        .map_err(|error| (axum::http::StatusCode::BAD_REQUEST, error.to_string()))?;
    Ok(Json(json!(status)))
}

pub async fn handle_provider_auth_url(
    provider: &str,
    account_id: Option<&str>,
) -> Result<Json<AuthUrlResponse>, (axum::http::StatusCode, String)> {
    if provider != "ollama" {
        ensure_callback_server(provider).await.map_err(|error| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                error.to_string(),
            )
        })?;
    }
    let needs_pkce = matches!(provider, "codex" | "claude");
    let (state, account_id, verifier) = create_session(provider, account_id, needs_pkce)
        .await
        .map_err(|error| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                error.to_string(),
            )
        })?;

    if provider == "ollama" && should_eagerly_complete_ollama_session() {
        let already_authorized =
            complete_ollama_session_if_authorized(state.as_str(), account_id.as_str())
                .await
                .map_err(|error| {
                    (
                        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                        error.to_string(),
                    )
                })?;
        if already_authorized {
            return Ok(Json(AuthUrlResponse {
                url: OLLAMA_AUTHORIZED_FALLBACK_URL.to_string(),
                state,
                account_id,
            }));
        }
    }

    let url = build_auth_url(
        provider,
        state.as_str(),
        verifier.as_deref(),
        Some(account_id.as_str()),
    )
    .await
    .map_err(|error| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            error.to_string(),
        )
    })?;

    Ok(Json(AuthUrlResponse {
        url,
        state,
        account_id,
    }))
}

async fn build_auth_url(
    provider: &str,
    state: &str,
    verifier: Option<&str>,
    account_id: Option<&str>,
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
        "ollama" => build_ollama_auth_url(account_id).await,
        _ => Err(anyhow::anyhow!("Unsupported auth provider: {}", provider)),
    }
}

pub async fn handle_codex_auth_url(
    _state: State<Arc<AppState>>,
    Query(query): Query<AuthUrlQuery>,
) -> Result<Json<AuthUrlResponse>, (axum::http::StatusCode, String)> {
    handle_provider_auth_url("codex", query.account_id.as_deref()).await
}

pub async fn handle_claude_auth_url(
    _state: State<Arc<AppState>>,
    Query(query): Query<AuthUrlQuery>,
) -> Result<Json<AuthUrlResponse>, (axum::http::StatusCode, String)> {
    handle_provider_auth_url("claude", query.account_id.as_deref()).await
}

pub async fn handle_antigravity_auth_url(
    _state: State<Arc<AppState>>,
    Query(query): Query<AuthUrlQuery>,
) -> Result<Json<AuthUrlResponse>, (axum::http::StatusCode, String)> {
    handle_provider_auth_url("antigravity", query.account_id.as_deref()).await
}

pub async fn handle_ollama_auth_url(
    _state: State<Arc<AppState>>,
    Query(query): Query<AuthUrlQuery>,
) -> Result<Json<AuthUrlResponse>, (axum::http::StatusCode, String)> {
    handle_provider_auth_url("ollama", query.account_id.as_deref()).await
}

pub async fn handle_ollama_signout(
    _state: State<Arc<AppState>>,
    Json(payload): Json<OllamaSignoutRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let base_url = resolve_ollama_base_url(payload.account_id.as_deref()).await;
    let client = OllamaClient::new(base_url.as_deref(), None).map_err(|error| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            error.to_string(),
        )
    })?;
    let already_signed_out = match client.signout().await {
        Ok(()) => false,
        Err(error) => {
            if is_ollama_not_authorized_error(error.to_string().as_str()) {
                true
            } else {
                return Err((
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    error.to_string(),
                ));
            }
        }
    };

    Ok(Json(json!({
        "success": true,
        "already_signed_out": already_signed_out
    })))
}

pub async fn handle_get_auth_status(
    _state: State<Arc<AppState>>,
    Query(query): Query<AuthStatusQuery>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let mut session_status = get_session_status_for(
        query.provider.as_str(),
        query.state.as_str(),
        query.account_id.as_str(),
    )
    .await;

    if query.provider.eq_ignore_ascii_case("ollama")
        && session_status
            .as_ref()
            .map(|status| status.status == "wait")
            .unwrap_or(false)
    {
        match complete_ollama_session_if_authorized(query.state.as_str(), query.account_id.as_str())
            .await
        {
            Ok(true) => {
                session_status = get_session_status_for(
                    query.provider.as_str(),
                    query.state.as_str(),
                    query.account_id.as_str(),
                )
                .await;
            }
            Ok(false) => {}
            Err(error) => {
                return Ok(Json(json!({
                    "status": "error",
                    "provider": query.provider,
                    "state": query.state,
                    "account_id": query.account_id,
                    "error": error.to_string()
                })));
            }
        }
    }

    if let Some(status) = session_status.clone() {
        if status.status == "ok" || status.status == "error" {
            return Ok(Json(json!(status)));
        }
    }

    let linked_account =
        crate::db::get_linked_account(query.provider.as_str(), query.account_id.as_str())
            .await
            .map_err(|error| {
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    error.to_string(),
                )
            })?;

    if let Some(account) = linked_account {
        return Ok(Json(json!({
            "status": "ok",
            "provider": query.provider,
            "state": query.state,
            "account_id": query.account_id,
            "account": account
        })));
    }

    if let Some(status) = session_status {
        return Ok(Json(json!(status)));
    }

    Ok(Json(json!({
        "status": "wait",
        "provider": query.provider,
        "state": query.state,
        "account_id": query.account_id
    })))
}

async fn build_ollama_auth_url(account_id: Option<&str>) -> anyhow::Result<String> {
    let base_url = resolve_ollama_base_url(account_id).await;
    let client = OllamaClient::new(base_url.as_deref(), None)?;
    match client.fetch_signin_url().await {
        Ok(url) => Ok(url),
        Err(error) => {
            if is_ollama_already_authorized_error(error.to_string().as_str()) {
                return Ok(OLLAMA_AUTHORIZED_FALLBACK_URL.to_string());
            }
            Err(error)
        }
    }
}

fn should_eagerly_complete_ollama_session() -> bool {
    false
}

async fn complete_ollama_session_if_authorized(
    state: &str,
    account_id: &str,
) -> anyhow::Result<bool> {
    let base_url = resolve_ollama_base_url(Some(account_id)).await;
    let client = OllamaClient::new(base_url.as_deref(), None)?;
    let profile = match client.fetch_profile().await {
        Ok(profile) => profile,
        Err(error) => {
            if is_ollama_not_authorized_error(error.to_string().as_str()) {
                return Ok(false);
            }
            return Err(error);
        }
    };

    let profile_json = json!({
        "id": profile.id,
        "email": profile.email,
        "name": profile.name,
        "username": profile.username,
        "image_url": profile.image_url
    });
    let display_name = profile
        .name
        .as_deref()
        .or(profile.username.as_deref())
        .map(str::to_string);
    let token_json = json!({
        "email": profile.email,
        "display_name": display_name,
        "avatar_url": profile.image_url,
        "oauth_provider": "ollama",
        "external_account_id": profile.id,
        "base_url": base_url,
        "provider_profile": profile_json
    });

    crate::db::save_token_with_retry(token_json, account_id, "ollama", 3).await?;
    crate::db::delete_provider_accounts_except("ollama", account_id).await?;
    complete_external_session("ollama", state, account_id).await?;
    Ok(true)
}

fn is_ollama_already_authorized_error(message: &str) -> bool {
    message.to_ascii_lowercase().contains("already authorized")
}

fn is_ollama_not_authorized_error(message: &str) -> bool {
    let normalized = message.to_ascii_lowercase();
    normalized.contains("status 401")
        || normalized.contains("status 403")
        || normalized.contains("unauthorized")
}

async fn resolve_ollama_base_url(account_id: Option<&str>) -> Option<String> {
    if let Some(id) = account_id {
        if let Ok(Some(account)) = crate::db::get_linked_account("ollama", id).await {
            if let Some(url) = extract_ollama_base_url_from_account(&account) {
                return Some(url);
            }
        }
    }

    resolve_ollama_base_url_from_env()
}

fn resolve_ollama_base_url_from_env() -> Option<String> {
    std::env::var("TENGRA_OLLAMA_BASE_URL")
        .ok()
        .or_else(|| std::env::var("OLLAMA_HOST").ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn extract_ollama_base_url_from_account(account: &Value) -> Option<String> {
    let metadata = match account.get("metadata") {
        Some(Value::Object(map)) => Value::Object(map.clone()),
        Some(Value::String(text)) => serde_json::from_str::<Value>(text).ok()?,
        _ => Value::Null,
    };
    metadata
        .get("base_url")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

pub async fn handle_cancel_auth(
    _state: State<Arc<AppState>>,
    Json(payload): Json<CancelAuthRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let cancelled = cancel_session(
        payload.provider.as_str(),
        payload.state.as_str(),
        payload.account_id.as_str(),
    )
    .await
    .map_err(|error| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            error.to_string(),
        )
    })?;

    Ok(Json(json!({
        "success": true,
        "cancelled": cancelled
    })))
}

#[cfg(test)]
mod tests {
    use super::{
        extract_ollama_base_url_from_account, is_ollama_not_authorized_error,
        should_eagerly_complete_ollama_session, AuthStatusQuery, CancelAuthRequest,
    };

    #[test]
    fn auth_status_query_requires_provider_state_and_account_id() {
        let query = serde_urlencoded::from_str::<AuthStatusQuery>(
            "provider=codex&state=abc&account_id=codex_123",
        )
        .expect("query should deserialize");
        assert_eq!(query.provider, "codex");
        assert_eq!(query.state, "abc");
        assert_eq!(query.account_id, "codex_123");
    }

    #[test]
    fn cancel_auth_request_deserializes() {
        let payload = serde_json::from_value::<CancelAuthRequest>(serde_json::json!({
            "provider": "claude",
            "state": "xyz",
            "account_id": "claude_456"
        }))
        .expect("payload should deserialize");
        assert_eq!(payload.provider, "claude");
        assert_eq!(payload.state, "xyz");
        assert_eq!(payload.account_id, "claude_456");
    }

    #[test]
    fn parses_ollama_base_url_from_stringified_metadata() {
        let account = serde_json::json!({
            "metadata": "{\"base_url\":\"http://127.0.0.1:11434\"}"
        });
        let base_url = extract_ollama_base_url_from_account(&account);
        assert_eq!(base_url.as_deref(), Some("http://127.0.0.1:11434"));
    }

    #[test]
    fn classifies_ollama_unauthorized_errors() {
        assert!(is_ollama_not_authorized_error(
            "Ollama profile fetch failed with status 401 Unauthorized"
        ));
        assert!(is_ollama_not_authorized_error(
            "Ollama profile fetch failed with status 403 Forbidden"
        ));
    }

    #[test]
    fn defers_ollama_profile_persistence_until_after_signin() {
        assert!(!should_eagerly_complete_ollama_session());
    }
}
