/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::auth::copilot::client::CopilotClient;
use crate::auth::session::{
    cancel_session, create_session, ensure_callback_server, get_session_status_for,
    handle_manual_callback_request, ManualOAuthCallback,
};
use crate::proxy::handlers::management_support::{
    build_auth_url, build_quota_snapshot, decrypt_access_token, get_cursor_machine_ids,
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

#[derive(Deserialize)]
pub struct CursorCompleteRequest {
    pub session: String,
    pub account_id: Option<String>,
    pub machine_id: Option<String>,
    pub mac_machine_id: Option<String>,
}

pub async fn handle_copilot_login(
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

pub async fn handle_copilot_poll(
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

            let provider = query.provider.as_deref().unwrap_or("copilot");
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
            error: Some(e.to_string()),
        })),
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
    state: State<Arc<AppState>>,
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

    let decrypted_token = decrypt_access_token(access_token)
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match crate::quota::check_quota(&query.provider, &decrypted_token).await {
        Ok(mut res) => {
            if query.provider == "copilot" {
                if let Some(account_id) = query.account_id.as_deref() {
                    let cache = state.copilot_usage_cache.lock().await;
                    if let Some(usage) = cache.get(account_id) {
                        if let Some(quota) = res.quota.as_mut() {
                            if let Some(limits) = usage.get("session_limits") {
                                quota.session_limits = serde_json::from_value(limits.clone()).ok();
                            }
                            if let Some(session_usage) = usage.get("session_usage") {
                                quota.session_usage =
                                    serde_json::from_value(session_usage.clone()).ok();
                            }
                        }
                    }
                }
            }
            Ok(Json(serde_json::to_value(res).unwrap_or_default()))
        }
        Err(e) => Err((axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

pub async fn handle_get_quota_snapshot(
    state: State<Arc<AppState>>,
) -> Result<Json<Value>, (axum::http::StatusCode, String)> {
    let snapshot = build_quota_snapshot(state.0.clone())
        .await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(snapshot))
}

pub async fn handle_stream_quota(
    state: State<Arc<AppState>>,
) -> Sse<impl futures::Stream<Item = Result<Event, Infallible>>> {
    let stream =
        IntervalStream::new(tokio::time::interval(Duration::from_secs(20))).then(move |_| {
            let state_inner = state.0.clone();
            async move {
                let payload = match build_quota_snapshot(state_inner).await {
                    Ok(snapshot) => snapshot,
                    Err(error) => json!({
                        "timestamp_ms": chrono::Utc::now().timestamp_millis(),
                        "accounts": [],
                        "error": error.to_string()
                    }),
                };

                Ok(Event::default().event("snapshot").data(payload.to_string()))
            }
        });

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(10))
            .text("keepalive"),
    )
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

pub async fn handle_cursor_complete(
    _state: State<Arc<AppState>>,
    Json(payload): Json<CursorCompleteRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let account_id = payload.account_id.as_deref().unwrap_or("cursor_default");

    let (det_machine_id, det_mac_machine_id) =
        if payload.machine_id.is_none() || payload.mac_machine_id.is_none() {
            get_cursor_machine_ids()
        } else {
            ("".to_string(), "".to_string())
        };

    let machine_id = payload.machine_id.as_deref().unwrap_or(&det_machine_id);
    let mac_machine_id = payload
        .mac_machine_id
        .as_deref()
        .unwrap_or(&det_mac_machine_id);

    let status = crate::auth::session::complete_cursor_session(
        &payload.session,
        account_id,
        machine_id,
        mac_machine_id,
    )
    .await
    .map_err(|error| (axum::http::StatusCode::BAD_REQUEST, error.to_string()))?;
    Ok(Json(json!(status)))
}

pub async fn handle_provider_auth_url(
    provider: &str,
    account_id: Option<&str>,
) -> Result<Json<AuthUrlResponse>, (axum::http::StatusCode, String)> {
    ensure_callback_server(provider).await.map_err(|error| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            error.to_string(),
        )
    })?;
    let needs_pkce = matches!(provider, "codex" | "claude");
    let (state, account_id, verifier) = create_session(provider, account_id, needs_pkce)
        .await
        .map_err(|error| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                error.to_string(),
            )
        })?;


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


pub async fn handle_cursor_auth_url(
    _state: State<Arc<AppState>>,
    Query(query): Query<AuthUrlQuery>,
) -> Result<Json<AuthUrlResponse>, (axum::http::StatusCode, String)> {
    let account_id = query
        .account_id
        .as_deref()
        .unwrap_or("cursor_default")
        .to_string();
    Ok(Json(AuthUrlResponse {
        url: "https://cursor.com/login".to_string(),
        state: "cursor-direct".to_string(),
        account_id,
    }))
}


pub async fn handle_get_auth_status(
    _state: State<Arc<AppState>>,
    Query(query): Query<AuthStatusQuery>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let session_status = get_session_status_for(
        query.provider.as_str(),
        query.state.as_str(),
        query.account_id.as_str(),
    )
    .await;


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

pub async fn handle_debug_tokens(
    _state: State<Arc<AppState>>,
) -> Result<Json<Value>, (axum::http::StatusCode, String)> {
    let accounts = crate::db::get_all_linked_accounts()
        .await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let master_key = crate::security::load_master_key()
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut debug_info = Vec::new();

    for account in accounts {
        let id = account
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("unknown");
        let provider = account
            .get("provider")
            .and_then(Value::as_str)
            .unwrap_or("unknown");

        let access_token = account
            .get("access_token")
            .and_then(Value::as_str)
            .unwrap_or("");
        let refresh_token = account.get("refresh_token").and_then(Value::as_str);
        let session_token = account.get("session_token").and_then(Value::as_str);

        let decrypted_access = if access_token.starts_with("Tengra:v1:") {
            crate::security::decrypt_token(access_token, &master_key)
                .unwrap_or_else(|_| "DECRYPT_FAILED".to_string())
        } else {
            access_token.to_string()
        };

        let decrypted_refresh = refresh_token.map(|rt| {
            if rt.starts_with("Tengra:v1:") {
                crate::security::decrypt_token(rt, &master_key)
                    .unwrap_or_else(|_| "DECRYPT_FAILED".to_string())
            } else {
                rt.to_string()
            }
        });

        let decrypted_session = session_token.map(|st| {
            if st.starts_with("Tengra:v1:") {
                crate::security::decrypt_token(st, &master_key)
                    .unwrap_or_else(|_| "DECRYPT_FAILED".to_string())
            } else {
                st.to_string()
            }
        });

        debug_info.push(json!({
            "id": id,
            "provider": provider,
            "access_token": decrypted_access,
            "refresh_token": decrypted_refresh,
            "session_token": decrypted_session,
            "metadata": account.get("metadata")
        }));
    }

    Ok(Json(json!(debug_info)))
}

#[cfg(test)]
mod tests {

    use super::{
        AuthStatusQuery,
        CancelAuthRequest,
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
}
