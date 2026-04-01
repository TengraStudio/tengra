use crate::auth::antigravity::client::AntigravityClient;
use crate::auth::claude::client::ClaudeClient;
use crate::auth::codex::client::CodexClient;
use crate::auth::copilot::CopilotClient;
use crate::auth::session::{
    cancel_session, create_session, ensure_callback_server, get_session_status_for,
    handle_manual_callback_request, ManualOAuthCallback,
};
use crate::proxy::server::AppState;
use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

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

    let url = build_auth_url(provider, state.as_str(), verifier.as_deref())
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
) -> anyhow::Result<String> {
    match provider {
        "codex" => {
            let pkce = verifier
                .map(|code_verifier| crate::auth::codex::pkce::PKCECodes {
                    code_verifier: code_verifier.to_string(),
                    code_challenge: crate::auth::codex::pkce::generate_challenge(code_verifier),
                })
                .ok_or_else(|| anyhow::anyhow!("Missing PKCE verifier for codex auth"))?;
            Ok(CodexClient::new().await.generate_auth_url(state, &pkce))
        }
        "claude" => {
            let pkce = verifier
                .map(|code_verifier| crate::auth::codex::pkce::PKCECodes {
                    code_verifier: code_verifier.to_string(),
                    code_challenge: crate::auth::codex::pkce::generate_challenge(code_verifier),
                })
                .ok_or_else(|| anyhow::anyhow!("Missing PKCE verifier for claude auth"))?;
            Ok(ClaudeClient::new().await.generate_auth_url(state, &pkce))
        }
        "antigravity" => Ok(AntigravityClient::new().await.generate_auth_url(state)),
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

#[cfg(test)]
mod tests {
    use super::{AuthStatusQuery, CancelAuthRequest};

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
