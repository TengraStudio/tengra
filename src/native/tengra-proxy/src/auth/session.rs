/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use std::collections::{HashMap, HashSet, VecDeque};
use std::net::SocketAddr;
use std::sync::OnceLock;
use std::time::Instant;

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
const CALLBACK_LATENCY_SAMPLE_LIMIT: usize = 512;
const OLLAMA_SINGLE_ACCOUNT_ID: &str = "ollama_default";

static OAUTH_SESSIONS: OnceLock<RwLock<HashMap<String, OAuthSession>>> = OnceLock::new();
static CALLBACK_SERVERS: OnceLock<RwLock<HashSet<&'static str>>> = OnceLock::new();
static CALLBACK_BRIDGE_usageStats: OnceLock<RwLock<CallbackBridgeusageStatsState>> =
    OnceLock::new();

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

#[derive(Clone, Serialize)]
pub struct CallbackRouteHealth {
    pub callback_url: String,
    pub callback_route: String,
    pub callback_port: u16,
    pub route_healthy: bool,
}

#[derive(Clone, Serialize, Default)]
pub struct CallbackBridgeLatencySnapshot {
    pub p50: u64,
    pub p95: u64,
    pub sample_count: usize,
}

#[derive(Clone, Serialize, Default)]
pub struct CallbackBridgeusageStatsSnapshot {
    pub redirect_count: u64,
    pub error_count: u64,
    pub latency_ms: CallbackBridgeLatencySnapshot,
}

#[derive(Default)]
struct CallbackBridgeusageStatsState {
    redirect_count: u64,
    error_count: u64,
    latency_samples_ms: VecDeque<u64>,
}

#[derive(Default)]
struct CodexProfileClaims {
    email: Option<String>,
    display_name: Option<String>,
    avatar_url: Option<String>,
    organization_id: Option<String>,
    organization_name: Option<String>,
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

fn callback_bridge_usageStats() -> &'static RwLock<CallbackBridgeusageStatsState> {
    CALLBACK_BRIDGE_usageStats.get_or_init(|| RwLock::new(CallbackBridgeusageStatsState::default()))
}

pub async fn create_session(
    provider: &str,
    account_id: Option<&str>,
    needs_pkce: bool,
) -> Result<(String, String, Option<String>)> {
    let state = generate_state();
    let verifier = needs_pkce.then(|| generate_pkce_codes().code_verifier);
    let resolved_account_id = resolve_session_account_id(provider, account_id);
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

fn resolve_session_account_id(provider: &str, account_id: Option<&str>) -> String {
    if provider.eq_ignore_ascii_case("ollama") {
        return OLLAMA_SINGLE_ACCOUNT_ID.to_string();
    }

    account_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| generate_account_id(provider))
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

pub async fn verify_callback_route(provider: &str) -> Result<CallbackRouteHealth> {
    let (route, addr, _) = callback_config(provider)?;
    let route_healthy = callback_server_responds(addr, route).await;
    Ok(CallbackRouteHealth {
        callback_url: format!("http://localhost:{}{}", addr.port(), route),
        callback_route: route.to_string(),
        callback_port: addr.port(),
        route_healthy,
    })
}

pub async fn handle_manual_callback_request(payload: ManualOAuthCallback) -> Result<SessionStatus> {
    let started_at = Instant::now();
    let result = complete_session(
        payload.provider.as_str(),
        payload.state.as_str(),
        payload.code.as_deref(),
        payload.error.as_deref(),
        payload.error_description.as_deref(),
    )
    .await;
    record_callback_bridge_event(false, result.is_err(), elapsed_ms(started_at)).await;
    result
}

pub async fn complete_external_session(
    provider: &str,
    state: &str,
    account_id: &str,
) -> Result<SessionStatus> {
    let session = load_session(provider, state).await?;
    if session.account_id != account_id {
        return Err(anyhow!("OAuth session account mismatch"));
    }
    mark_session_complete(&session.state).await
}

async fn handle_callback(
    State(state): State<CallbackState>,
    Query(query): Query<CallbackQuery>,
) -> axum::response::Html<&'static str> {
    let started_at = Instant::now();
    let Some(session_state) = query.state.as_deref() else {
        record_callback_bridge_event(true, true, elapsed_ms(started_at)).await;
        return crate::auth::common::close_window_html();
    };

    let mut had_error = false;
    if let Err(e) = complete_session(
        state.provider,
        session_state,
        query.code.as_deref(),
        query.error.as_deref(),
        query.error_description.as_deref(),
    )
    .await
    {
        had_error = true;
        let _ = mark_session_error(state.provider, session_state, e.to_string()).await;
    }
    record_callback_bridge_event(true, had_error, elapsed_ms(started_at)).await;

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
    let client = CodexClient::new().await?;
    let token = client.exchange_code(code, verifier).await?;
    let claims = extract_codex_profile_claims(&token.id_token);
    let mut token_json = json!({
        "access_token": token.access_token,
        "refresh_token": token.refresh_token,
        "id_token": token.id_token,
        "token_type": token.token_type,
        "expires_in": token.expires_in,
        "expires_at": now_ts_ms() + ((token.expires_in as i64) * 1000),
        "email": claims.email,
        "display_name": claims.display_name,
        "avatar_url": claims.avatar_url
    });
    if let Some(map) = token_json.as_object_mut() {
        if claims.organization_id.is_some() || claims.organization_name.is_some() {
            map.insert(
                "organization".to_string(),
                json!({
                    "id": claims.organization_id,
                    "name": claims.organization_name
                }),
            );
        }
    }
    crate::db::save_token_with_retry(token_json, &session.account_id, "codex", 3).await?;
    mark_session_complete(&session.state).await
}

async fn exchange_claude(session: OAuthSession, code: &str) -> Result<SessionStatus> {
    let verifier = session
        .code_verifier
        .as_deref()
        .ok_or_else(|| anyhow!("Missing PKCE verifier for claude session"))?;
    let client = ClaudeClient::new().await?;
    let token = client.exchange_code(code, verifier).await?;
    let mut token_json = serde_json::to_value(token)?;
    if let Some(map) = token_json.as_object_mut() {
        match client
            .fetch_profile_metadata(
                map.get("access_token")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            )
            .await
        {
            Ok(profile_metadata) => {
                if let Some(profile) = profile_metadata.as_object() {
                    if let Some(email) = profile.get("email").and_then(serde_json::Value::as_str) {
                        map.entry("email".to_string())
                            .or_insert_with(|| serde_json::Value::String(email.to_string()));
                    }
                    if let Some(display_name) = profile
                        .get("display_name")
                        .and_then(serde_json::Value::as_str)
                    {
                        map.entry("display_name".to_string())
                            .or_insert_with(|| serde_json::Value::String(display_name.to_string()));
                    }
                    if let Some(avatar_url) = profile
                        .get("avatar_url")
                        .and_then(serde_json::Value::as_str)
                    {
                        map.entry("avatar_url".to_string())
                            .or_insert_with(|| serde_json::Value::String(avatar_url.to_string()));
                    }
                }
                map.insert("provider_profile".to_string(), profile_metadata);
            }
            Err(error) => {
                map.insert(
                    "provider_profile_enrichment_error".to_string(),
                    serde_json::Value::String(error.to_string()),
                );
            }
        }
    }
    crate::db::save_token_with_retry(token_json, &session.account_id, "claude", 3).await?;
    mark_session_complete(&session.state).await
}

async fn exchange_antigravity(session: OAuthSession, code: &str) -> Result<SessionStatus> {
    let client = AntigravityClient::new(None).await?;
    let token = client.exchange_code(code).await?;
    let email = client
        .get_user_email(&token.access_token)
        .await
        .unwrap_or_default();
    let project_context = client
        .discover_project_context(&token.access_token)
        .await
        .ok();
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
    crate::db::save_token_with_retry(storage, &session.account_id, "antigravity", 3).await?;
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
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(500))
        .build()
    {
        Ok(client) => client,
        Err(_) => return false,
    };
    match client.get(url).send().await {
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

fn extract_codex_profile_claims(id_token: &str) -> CodexProfileClaims {
    let mut segments = id_token.split('.');
    let _header = segments.next();
    let Some(payload) = segments.next() else {
        return CodexProfileClaims::default();
    };

    let Ok(decoded_payload) = URL_SAFE_NO_PAD.decode(payload) else {
        return CodexProfileClaims::default();
    };
    let Ok(claims) = serde_json::from_slice::<serde_json::Value>(&decoded_payload) else {
        return CodexProfileClaims::default();
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

    let (organization_id, organization_name) = extract_codex_organization(&claims);
    CodexProfileClaims {
        email,
        display_name,
        avatar_url,
        organization_id,
        organization_name,
    }
}

fn extract_codex_organization(claims: &serde_json::Value) -> (Option<String>, Option<String>) {
    let first_org = claims
        .get("organizations")
        .and_then(|value| value.as_array())
        .and_then(|items| items.first())
        .and_then(|value| value.as_object());
    let org_id = first_org
        .and_then(|value| value.get("id"))
        .and_then(|value| value.as_str())
        .map(str::to_string)
        .or_else(|| {
            claims
                .get("org_id")
                .and_then(|value| value.as_str())
                .map(str::to_string)
        });
    let org_name = first_org
        .and_then(|value| value.get("name"))
        .and_then(|value| value.as_str())
        .map(str::to_string)
        .or_else(|| {
            claims
                .get("org_name")
                .and_then(|value| value.as_str())
                .map(str::to_string)
        });
    (org_id, org_name)
}

fn elapsed_ms(started_at: Instant) -> u64 {
    started_at.elapsed().as_millis().min(u128::from(u64::MAX)) as u64
}

async fn record_callback_bridge_event(was_redirect: bool, had_error: bool, latency_ms: u64) {
    let mut usageStats = callback_bridge_usageStats().write().await;
    if was_redirect {
        usageStats.redirect_count = usageStats.redirect_count.saturating_add(1);
    }
    if had_error {
        usageStats.error_count = usageStats.error_count.saturating_add(1);
    }
    usageStats.latency_samples_ms.push_back(latency_ms);
    while usageStats.latency_samples_ms.len() > CALLBACK_LATENCY_SAMPLE_LIMIT {
        usageStats.latency_samples_ms.pop_front();
    }
}

fn percentile(values: &[u64], percentile: u8) -> u64 {
    if values.is_empty() {
        return 0;
    }
    let mut sorted = values.to_vec();
    sorted.sort_unstable();
    let rank = ((usize::from(percentile) * sorted.len()).saturating_sub(1)) / 100;
    let index = rank.min(sorted.len().saturating_sub(1));
    sorted[index]
}

pub async fn callback_bridge_usageStats_snapshot() -> CallbackBridgeusageStatsSnapshot {
    let usageStats = callback_bridge_usageStats().read().await;
    let samples: Vec<u64> = usageStats.latency_samples_ms.iter().copied().collect();
    CallbackBridgeusageStatsSnapshot {
        redirect_count: usageStats.redirect_count,
        error_count: usageStats.error_count,
        latency_ms: CallbackBridgeLatencySnapshot {
            p50: percentile(&samples, 50),
            p95: percentile(&samples, 95),
            sample_count: samples.len(),
        },
    }
}

#[cfg(test)]
async fn reset_callback_bridge_usageStats_for_tests() {
    let mut usageStats = callback_bridge_usageStats().write().await;
    usageStats.redirect_count = 0;
    usageStats.error_count = 0;
    usageStats.latency_samples_ms.clear();
}

#[cfg(test)]
mod tests {
    use super::{
        callback_bridge_usageStats_snapshot, callback_config, cancel_session,
        complete_external_session, create_session, extract_codex_profile_claims,
        get_session_status_for, normalize_error, record_callback_bridge_event,
        reset_callback_bridge_usageStats_for_tests, ManualOAuthCallback,
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

    #[tokio::test]
    async fn completes_external_session_without_callback() {
        let (state, account_id, _) = create_session("ollama", Some("ollama_test"), false)
            .await
            .expect("session");
        let status = complete_external_session("ollama", &state, &account_id)
            .await
            .expect("status");
        assert_eq!(status.status, "ok");
        assert_eq!(status.provider, "ollama");
    }

    #[tokio::test]
    async fn enforces_single_ollama_account_id() {
        let (_state_a, account_a, _) = create_session("ollama", None, false)
            .await
            .expect("ollama session without account id");
        let (_state_b, account_b, _) = create_session("ollama", Some("ollama_custom"), false)
            .await
            .expect("ollama session with custom account id");

        assert_eq!(account_a, "ollama_default");
        assert_eq!(account_b, "ollama_default");
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
        let payload = r#"{"email":"test@example.com","name":"Test User","picture":"https://example.com/avatar.png","org_id":"org_123","org_name":"Acme"}"#;
        let token = format!(
            "header.{}.signature",
            URL_SAFE_NO_PAD.encode(payload.as_bytes())
        );

        let claims = extract_codex_profile_claims(&token);
        assert_eq!(claims.email.as_deref(), Some("test@example.com"));
        assert_eq!(claims.display_name.as_deref(), Some("Test User"));
        assert_eq!(
            claims.avatar_url.as_deref(),
            Some("https://example.com/avatar.png")
        );
        assert_eq!(claims.organization_id.as_deref(), Some("org_123"));
        assert_eq!(claims.organization_name.as_deref(), Some("Acme"));
    }

    #[tokio::test]
    async fn tracks_callback_bridge_usageStats_percentiles() {
        reset_callback_bridge_usageStats_for_tests().await;
        record_callback_bridge_event(true, false, 10).await;
        record_callback_bridge_event(true, false, 20).await;
        record_callback_bridge_event(true, true, 30).await;
        record_callback_bridge_event(true, false, 40).await;
        record_callback_bridge_event(true, true, 100).await;

        let snapshot = callback_bridge_usageStats_snapshot().await;
        assert_eq!(snapshot.redirect_count, 5);
        assert_eq!(snapshot.error_count, 2);
        assert_eq!(snapshot.latency_ms.sample_count, 5);
        assert_eq!(snapshot.latency_ms.p50, 30);
        assert_eq!(snapshot.latency_ms.p95, 100);
    }
}
