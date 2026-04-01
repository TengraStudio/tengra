use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::sync::OnceLock;

use anyhow::{anyhow, Result};
use axum::{
    extract::{Query, State},
    routing::get,
    Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::net::TcpListener;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::auth::antigravity::client::AntigravityClient;
use crate::auth::claude::client::ClaudeClient;
use crate::auth::codex::client::CodexClient;
use crate::auth::codex::pkce::generate_pkce_codes;

const SESSION_TTL_SECS: i64 = 300;
const CODEX_CALLBACK_PORT: u16 = 1455;
const CLAUDE_CALLBACK_PORT: u16 = 54545;
const ANTIGRAVITY_CALLBACK_PORT: u16 = 51121;

static OAUTH_SESSIONS: OnceLock<RwLock<HashMap<String, OAuthSession>>> = OnceLock::new();
static CALLBACK_SERVERS: OnceLock<RwLock<HashSet<&'static str>>> = OnceLock::new();

#[derive(Clone, Serialize)]
pub struct SessionStatus {
    pub state: String,
    pub provider: String,
    pub account_id: String,
    pub status: String,
    pub error: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone)]
struct OAuthSession {
    state: String,
    provider: String,
    account_id: String,
    status: String,
    error: Option<String>,
    code_verifier: Option<String>,
    created_at: i64,
    updated_at: i64,
}

#[derive(Clone)]
struct CallbackState {
    provider: &'static str,
}

#[derive(Deserialize)]
struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Deserialize)]
pub struct ManualOAuthCallback {
    pub provider: String,
    pub code: Option<String>,
    pub state: String,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

fn sessions() -> &'static RwLock<HashMap<String, OAuthSession>> {
    OAUTH_SESSIONS.get_or_init(|| RwLock::new(HashMap::new()))
}

fn callback_servers() -> &'static RwLock<HashSet<&'static str>> {
    CALLBACK_SERVERS.get_or_init(|| RwLock::new(HashSet::new()))
}

pub async fn create_session(
    provider: &str,
    account_id: Option<&str>,
    needs_pkce: bool,
) -> Result<(String, String, Option<String>)> {
    let state = generate_state();
    let verifier = needs_pkce.then(|| generate_pkce_codes().code_verifier);
    let resolved_account_id = account_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| generate_account_id(provider));
    let now = now_ts();
    let session = OAuthSession {
        state: state.clone(),
        provider: provider.to_string(),
        account_id: resolved_account_id.clone(),
        status: "wait".to_string(),
        error: None,
        code_verifier: verifier.clone(),
        created_at: now,
        updated_at: now,
    };

    sessions().write().await.insert(state.clone(), session);
    Ok((state, resolved_account_id, verifier))
}

pub async fn get_session_status_for(
    provider: &str,
    state: &str,
    account_id: &str,
) -> Option<SessionStatus> {
    expire_stale_sessions().await;
    sessions()
        .read()
        .await
        .get(state)
        .filter(|session| session.provider == provider && session.account_id == account_id)
        .cloned()
        .map(as_status)
}

pub async fn cancel_session(provider: &str, state: &str, account_id: &str) -> Result<bool> {
    expire_stale_sessions().await;
    let mut guard = sessions().write().await;
    let should_remove = guard
        .get(state)
        .map(|session| session.provider == provider && session.account_id == account_id)
        .unwrap_or(false);
    if should_remove {
        guard.remove(state);
        return Ok(true);
    }
    Ok(false)
}

pub async fn ensure_callback_server(provider: &str) -> Result<()> {
    let provider_key = provider_static(provider)?;
    if callback_servers().read().await.contains(provider_key) {
        return Ok(());
    }

    let (route, addr, state) = callback_config(provider)?;
    let listener = match TcpListener::bind(addr).await {
        Ok(listener) => listener,
        Err(error) if error.kind() == std::io::ErrorKind::AddrInUse => {
            if callback_server_responds(addr, route).await {
                callback_servers().write().await.insert(provider_key);
                return Ok(());
            }
            return Err(error.into());
        }
        Err(error) => return Err(error.into()),
    };
    let app = Router::new()
        .route(route, get(handle_callback))
        .with_state(state);

    tokio::spawn(async move {
        if let Err(error) = axum::serve(listener, app).await {
            eprintln!("[WARN] OAuth callback server stopped: {}", error);
        }
    });

    callback_servers().write().await.insert(provider_key);
    Ok(())
}

pub async fn handle_manual_callback_request(payload: ManualOAuthCallback) -> Result<SessionStatus> {
    complete_session(
        payload.provider.as_str(),
        payload.state.as_str(),
        payload.code.as_deref(),
        payload.error.as_deref(),
        payload.error_description.as_deref(),
    )
    .await
}

async fn handle_callback(
    State(state): State<CallbackState>,
    Query(query): Query<CallbackQuery>,
) -> axum::response::Html<&'static str> {
    let Some(session_state) = query.state.as_deref() else {
        return crate::auth::common::close_window_html();
    };

    if let Err(e) = complete_session(
        state.provider,
        session_state,
        query.code.as_deref(),
        query.error.as_deref(),
        query.error_description.as_deref(),
    )
    .await
    {
        let _ = mark_session_error(state.provider, session_state, e.to_string()).await;
    }

    crate::auth::common::close_window_html()
}

async fn complete_session(
    provider: &str,
    state: &str,
    code: Option<&str>,
    error: Option<&str>,
    error_description: Option<&str>,
) -> Result<SessionStatus> {
    if let Some(message) = normalize_error(error, error_description) {
        return mark_session_error(provider, state, message).await;
    }

    let code = code.ok_or_else(|| anyhow!("Missing authorization code"))?;
    let session = load_session(provider, state).await?;

    match provider {
        "codex" => exchange_codex(session, code).await,
        "claude" => exchange_claude(session, code).await,
        "antigravity" => exchange_antigravity(session, code).await,
        _ => Err(anyhow!("Unsupported provider for callback: {}", provider)),
    }
}

async fn exchange_codex(session: OAuthSession, code: &str) -> Result<SessionStatus> {
    let verifier = session
        .code_verifier
        .as_deref()
        .ok_or_else(|| anyhow!("Missing PKCE verifier for codex session"))?;
    let client = CodexClient::new().await;
    let token = client.exchange_code(code, verifier).await?;
    let (email, display_name, avatar_url) = extract_codex_profile_claims(&token.id_token);
    let token_json = json!({
        "access_token": token.access_token,
        "refresh_token": token.refresh_token,
        "id_token": token.id_token,
        "token_type": token.token_type,
        "expires_in": token.expires_in,
        "expires_at": now_ts_ms() + ((token.expires_in as i64) * 1000),
        "email": email,
        "display_name": display_name,
        "avatar_url": avatar_url
    });
    crate::db::save_token(token_json, &session.account_id, "codex").await?;
    mark_session_complete(&session.state).await
}

async fn exchange_claude(session: OAuthSession, code: &str) -> Result<SessionStatus> {
    let verifier = session
        .code_verifier
        .as_deref()
        .ok_or_else(|| anyhow!("Missing PKCE verifier for claude session"))?;
    let client = ClaudeClient::new().await;
    let token = client.exchange_code(code, verifier).await?;
    let token_json = serde_json::to_value(token)?;
    crate::db::save_token(token_json, &session.account_id, "claude").await?;
    mark_session_complete(&session.state).await
}

async fn exchange_antigravity(session: OAuthSession, code: &str) -> Result<SessionStatus> {
    let client = AntigravityClient::new().await;
    let token = client.exchange_code(code).await?;
    let email = client
        .get_user_email(&token.access_token)
        .await
        .unwrap_or_default();
    let project_context = client.discover_project_context(&token.access_token).await.ok();
    let project_id = if let Some(context) = project_context.as_ref() {
        client
            .ensure_onboarded(&token.access_token, context)
            .await
            .unwrap_or_else(|_| context.project_id.clone())
    } else {
        "auto".to_string()
    };
    let expires_at = now_ts_ms() + (token.expires_in * 1000);
    let storage = json!({
        "access_token": token.access_token,
        "refresh_token": token.refresh_token,
        "expires_in": token.expires_in,
        "token_type": token.token_type,
        "expires_at": expires_at,
        "email": email,
        "project_id": project_id,
        "tier_id": project_context
            .as_ref()
            .map(|context| context.tier_id.clone())
            .unwrap_or_else(|| "legacy-tier".to_string()),
        "type": "antigravity"
    });
    crate::db::save_token(storage, &session.account_id, "antigravity").await?;
    mark_session_complete(&session.state).await
}

async fn mark_session_complete(state: &str) -> Result<SessionStatus> {
    update_session(state, |session| {
        session.status = "ok".to_string();
        session.error = None;
        session.updated_at = now_ts();
    })
    .await
}

async fn mark_session_error(provider: &str, state: &str, message: String) -> Result<SessionStatus> {
    let session = load_session(provider, state).await?;
    update_session(&session.state, |current| {
        current.status = "error".to_string();
        current.error = Some(message.clone());
        current.updated_at = now_ts();
    })
    .await
}

async fn update_session<F>(state: &str, update: F) -> Result<SessionStatus>
where
    F: FnOnce(&mut OAuthSession),
{
    let mut guard = sessions().write().await;
    let session = guard
        .get_mut(state)
        .ok_or_else(|| anyhow!("OAuth session not found"))?;
    update(session);
    Ok(as_status(session.clone()))
}

async fn load_session(provider: &str, state: &str) -> Result<OAuthSession> {
    expire_stale_sessions().await;
    let session = sessions()
        .read()
        .await
        .get(state)
        .cloned()
        .ok_or_else(|| anyhow!("OAuth session not found"))?;
    if session.provider != provider {
        return Err(anyhow!("OAuth session provider mismatch"));
    }
    Ok(session)
}

async fn expire_stale_sessions() {
    let threshold = now_ts() - SESSION_TTL_SECS;
    let mut guard = sessions().write().await;
    for session in guard.values_mut() {
        if session.status == "wait" && session.updated_at < threshold {
            session.status = "error".to_string();
            session.error = Some("OAuth flow timed out".to_string());
            session.updated_at = now_ts();
        }
    }
}

fn callback_config(provider: &str) -> Result<(&'static str, SocketAddr, CallbackState)> {
    let provider_static = provider_static(provider)?;
    let (route, port) = match provider_static {
        "codex" => ("/auth/callback", CODEX_CALLBACK_PORT),
        "claude" => ("/callback", CLAUDE_CALLBACK_PORT),
        "antigravity" => ("/oauth-callback", ANTIGRAVITY_CALLBACK_PORT),
        _ => return Err(anyhow!("Unsupported callback provider: {}", provider)),
    };

    Ok((
        route,
        SocketAddr::from(([127, 0, 0, 1], port)),
        CallbackState {
            provider: provider_static,
        },
    ))
}

async fn callback_server_responds(addr: SocketAddr, route: &str) -> bool {
    let url = format!("http://{}{}", addr, route);
    match reqwest::get(url).await {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    }
}

fn provider_static(provider: &str) -> Result<&'static str> {
    match provider {
        "codex" => Ok("codex"),
        "claude" => Ok("claude"),
        "antigravity" => Ok("antigravity"),
        _ => Err(anyhow!("Unsupported provider: {}", provider)),
    }
}

fn as_status(session: OAuthSession) -> SessionStatus {
    SessionStatus {
        state: session.state,
        provider: session.provider,
        account_id: session.account_id,
        status: session.status,
        error: session.error,
        created_at: session.created_at,
        updated_at: session.updated_at,
    }
}

fn normalize_error(error: Option<&str>, error_description: Option<&str>) -> Option<String> {
    let message = error_description
        .or(error)
        .map(str::trim)
        .unwrap_or_default();
    if message.is_empty() {
        return None;
    }
    Some(message.to_string())
}

fn generate_state() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect()
}

pub fn generate_account_id(provider: &str) -> String {
    format!("{}_{}", provider, Uuid::new_v4().simple())
}

fn now_ts() -> i64 {
    chrono::Utc::now().timestamp()
}

fn now_ts_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn extract_codex_profile_claims(
    id_token: &str,
) -> (Option<String>, Option<String>, Option<String>) {
    let mut segments = id_token.split('.');
    let _header = segments.next();
    let Some(payload) = segments.next() else {
        return (None, None, None);
    };

    let Ok(decoded_payload) = URL_SAFE_NO_PAD.decode(payload) else {
        return (None, None, None);
    };
    let Ok(claims) = serde_json::from_slice::<serde_json::Value>(&decoded_payload) else {
        return (None, None, None);
    };

    let email = claims
        .get("email")
        .and_then(|value| value.as_str())
        .map(str::to_string);
    let display_name = claims
        .get("name")
        .and_then(|value| value.as_str())
        .map(str::to_string);
    let avatar_url = claims
        .get("picture")
        .and_then(|value| value.as_str())
        .map(str::to_string);

    (email, display_name, avatar_url)
}

#[cfg(test)]
mod tests {
    use super::{
        callback_config, cancel_session, create_session, extract_codex_profile_claims,
        get_session_status_for, normalize_error, ManualOAuthCallback,
    };
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};

    #[tokio::test]
    async fn creates_pending_session_status() {
        let (state, account_id, verifier) = create_session("codex", Some("codex_existing"), true)
            .await
            .expect("session");
        let status = get_session_status_for("codex", &state, &account_id)
            .await
            .expect("status");
        assert_eq!(status.provider, "codex");
        assert_eq!(status.status, "wait");
        assert_eq!(status.account_id, "codex_existing");
        assert!(verifier.is_some());
    }

    #[tokio::test]
    async fn generates_distinct_account_id_when_not_provided() {
        let (state, account_id, verifier) =
            create_session("claude", None, true).await.expect("session");
        let status = get_session_status_for("claude", &state, &account_id)
            .await
            .expect("status");

        assert!(account_id.starts_with("claude_"));
        assert_eq!(status.account_id, account_id);
        assert!(verifier.is_some());
    }

    #[tokio::test]
    async fn cancels_matching_session() {
        let (state, account_id, _) = create_session("antigravity", None, false)
            .await
            .expect("session");

        let removed = cancel_session("antigravity", &state, &account_id)
            .await
            .expect("cancel");
        assert!(removed);
        assert!(get_session_status_for("antigravity", &state, &account_id)
            .await
            .is_none());
    }

    #[test]
    fn prefers_error_description() {
        assert_eq!(
            normalize_error(Some("access_denied"), Some("user denied")),
            Some("user denied".to_string())
        );
    }

    #[test]
    fn manual_callback_shape_deserializes() {
        let payload = serde_json::from_value::<ManualOAuthCallback>(serde_json::json!({
            "provider": "codex",
            "state": "abc",
            "code": "123"
        }))
        .expect("payload");
        assert_eq!(payload.provider, "codex");
        assert_eq!(payload.state, "abc");
    }

    #[test]
    fn callback_config_uses_expected_fixed_ports() {
        let (_, codex_addr, _) = callback_config("codex").expect("codex");
        let (_, claude_addr, _) = callback_config("claude").expect("claude");
        assert_eq!(codex_addr.port(), 1455);
        assert_eq!(claude_addr.port(), 54545);
    }

    #[test]
    fn decodes_codex_profile_claims_from_id_token() {
        let payload = r#"{"email":"test@example.com","name":"Test User","picture":"https://example.com/avatar.png"}"#;
        let token = format!(
            "header.{}.signature",
            URL_SAFE_NO_PAD.encode(payload.as_bytes())
        );

        let (email, display_name, avatar_url) = extract_codex_profile_claims(&token);
        assert_eq!(email.as_deref(), Some("test@example.com"));
        assert_eq!(display_name.as_deref(), Some("Test User"));
        assert_eq!(
            avatar_url.as_deref(),
            Some("https://example.com/avatar.png")
        );
    }
}
