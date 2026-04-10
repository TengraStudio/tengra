pub mod headers;
pub mod request;
pub mod response;
pub mod stream;

use crate::proxy::antigravity::fallback_base_urls;
use crate::proxy::model_catalog::resolve_provider;
use crate::proxy::server::AppState;
use crate::proxy::types::ChatCompletionRequest;
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{sse::Sse, IntoResponse, Response},
    Json,
};
use reqwest::Client;
use serde_json::{json, Map, Value};
use std::sync::{Arc, OnceLock};
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

static UPSTREAM_HTTP_CLIENT: OnceLock<Client> = OnceLock::new();
static COPILOT_RATE_LIMITER: OnceLock<Mutex<CopilotRateLimitState>> = OnceLock::new();
static ANTIGRAVITY_RATE_LIMITER: OnceLock<Mutex<AntigravityRateLimitState>> = OnceLock::new();

const COPILOT_MIN_API_INTERVAL_MS: i64 = 1000;
const COPILOT_MAX_QUEUED_REQUESTS: usize = 30;

const ANTIGRAVITY_MIN_API_INTERVAL_MS: i64 = 2000;
const ANTIGRAVITY_MAX_QUEUED_REQUESTS: usize = 12;

#[derive(Default)]
struct CopilotRateLimitState {
    last_api_call_at_ms: i64,
    pending_requests: usize,
}

#[derive(Default)]
struct AntigravityRateLimitState {
    last_api_call_at_ms: i64,
    pending_requests: usize,
}

pub async fn handle_chat_completions(
    state: State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(payload): Json<ChatCompletionRequest>,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    execute_chat_completion_payload(state, payload).await
}

pub async fn execute_chat_completion_payload(
    state: State<Arc<AppState>>,
    payload: ChatCompletionRequest,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    // 1. Resolve Provider
    let provider = payload
        .provider
        .as_deref()
        .or_else(|| resolve_provider(&payload.model))
        .unwrap_or("codex")
        .to_string();

    // 2. Load and decrypt key
    let accounts = crate::db::get_provider_accounts(&provider)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
        })?;

    let mut active_keys: Vec<&serde_json::Value> = accounts
        .iter()
        .filter(|k| k["is_active"] == json!(1) || k["is_active"] == json!(true))
        .collect();
    if active_keys.is_empty() && !accounts.is_empty() {
        active_keys.push(&accounts[0]);
    }

    if active_keys.is_empty() {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": format!("No key for {}", provider)})),
        ));
    }

    let requested_account_id = requested_account_id(&payload);
    let active_key_row = requested_account_id
        .as_deref()
        .and_then(|account_id| {
            active_keys
                .iter()
                .copied()
                .find(|row| row.get("id").and_then(Value::as_str) == Some(account_id))
                .or_else(|| {
                    accounts
                        .iter()
                        .find(|row| row.get("id").and_then(Value::as_str) == Some(account_id))
                })
        })
        .or_else(|| active_keys.first().copied());
    let Some(active_key_row) = active_key_row else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": format!("No active account for {}", provider)})),
        ));
    };

    // 3. Quota check
    if is_quota_exhausted(active_key_row) {
        return Err((
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({"error": "Quota exhausted"})),
        ));
    }

    let raw_token = active_key_row["access_token"].as_str().unwrap_or("");
    let auth_token = decrypt_if_needed(raw_token)?;

    if provider == "copilot" {
        return execute_copilot_rate_limited(
            state,
            payload,
            &provider,
            &auth_token,
            active_key_row,
        )
        .await;
    }

    if provider == "antigravity" {
        return execute_antigravity_rate_limited(
            state,
            payload,
            &provider,
            &auth_token,
            active_key_row,
        )
        .await;
    }

    execute_upstream_request(state, payload, &provider, &auth_token, active_key_row).await
}

async fn execute_antigravity_rate_limited(
    state: State<Arc<AppState>>,
    payload: ChatCompletionRequest,
    provider: &str,
    auth_token: &str,
    active_key_row: &serde_json::Value,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let wait_ms = {
        let limiter = antigravity_rate_limiter();
        let mut state = limiter.lock().await;

        if state.pending_requests >= ANTIGRAVITY_MAX_QUEUED_REQUESTS {
            return Err((
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({
                    "error": "Antigravity request queue full"
                })),
            ));
        }

        state.pending_requests += 1;
        let now = chrono::Utc::now().timestamp_millis();
        let wait_ms = (state.last_api_call_at_ms + ANTIGRAVITY_MIN_API_INTERVAL_MS - now).max(0);
        state.last_api_call_at_ms = now + wait_ms;
        wait_ms
    };

    if wait_ms > 0 {
        sleep(Duration::from_millis(wait_ms as u64)).await;
    }

    let result =
        execute_upstream_request(state, payload, provider, auth_token, active_key_row).await;

    {
        let limiter = antigravity_rate_limiter();
        let mut state = limiter.lock().await;
        state.pending_requests = state.pending_requests.saturating_sub(1);
    }

    result
}

async fn execute_copilot_rate_limited(
    state: State<Arc<AppState>>,
    payload: ChatCompletionRequest,
    provider: &str,
    auth_token: &str,
    active_key_row: &serde_json::Value,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let wait_ms = {
        let limiter = copilot_rate_limiter();
        let mut state = limiter.lock().await;
        if state.pending_requests >= COPILOT_MAX_QUEUED_REQUESTS {
            return Err((
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({
                    "error": "Copilot request queue full"
                })),
            ));
        }

        state.pending_requests += 1;
        let now = chrono::Utc::now().timestamp_millis();
        let wait_ms = (state.last_api_call_at_ms + COPILOT_MIN_API_INTERVAL_MS - now).max(0);
        state.last_api_call_at_ms = now + wait_ms;
        wait_ms
    };

    if wait_ms > 0 {
        sleep(Duration::from_millis(wait_ms as u64)).await;
    }

    let result =
        execute_upstream_request(state, payload, provider, auth_token, active_key_row).await;

    {
        let limiter = copilot_rate_limiter();
        let mut state = limiter.lock().await;
        state.pending_requests = state.pending_requests.saturating_sub(1);
    }

    result
}

async fn execute_upstream_request(
    state: State<Arc<AppState>>,
    payload: ChatCompletionRequest,
    provider: &str,
    auth_token: &str,
    active_key_row: &serde_json::Value,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let provider_str = provider.to_string();
    let prepared_payload = prepare_payload(provider, payload, auth_token, active_key_row).await?;
    let request_body = request::translate_request(provider, &prepared_payload);

    let res = if provider == "antigravity" {
        execute_antigravity_request(
            state.clone(),
            provider,
            auth_token,
            active_key_row,
            &prepared_payload,
            &request_body,
        )
        .await?
    } else {
        send_upstream_request(
            state.clone(),
            provider,
            auth_token,
            active_key_row,
            &prepared_payload,
            &request_body,
            None,
        )
        .await?
    };

    // 5. Transform Response
    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err((status, Json(json!({"error": body}))));
    }

    if prepared_payload.stream {
        let session_key = generate_session_key(active_key_row, &prepared_payload);
        let sse_stream =
            stream::translate_stream(provider_str, res.bytes_stream(), state.clone(), session_key);
        Ok(Sse::new(sse_stream).into_response())
    } else {
        let status = res.status();
        let val = res.json::<serde_json::Value>().await.map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
        })?;

        let translated = response::translate_response(provider, val);
        Ok((status, Json(translated)).into_response())
    }
}

async fn execute_antigravity_request(
    state: State<Arc<AppState>>,
    provider: &str,
    auth_token: &str,
    active_key_row: &Value,
    payload: &ChatCompletionRequest,
    request_body: &Value,
) -> Result<reqwest::Response, (StatusCode, Json<serde_json::Value>)> {
    let base_url = parse_metadata_map(active_key_row.get("metadata").unwrap_or(&Value::Null))
        .and_then(|metadata| {
            metadata
                .get("base_url")
                .and_then(Value::as_str)
                .map(str::to_string)
        });
    let mut last_error = None;

    for candidate in fallback_base_urls(base_url.as_deref()) {
        let res = send_upstream_request(
            state.clone(),
            provider,
            auth_token,
            active_key_row,
            payload,
            request_body,
            Some(candidate.as_str()),
        )
        .await;

        match res {
            Ok(response) => {
                if response.status() == StatusCode::TOO_MANY_REQUESTS {
                    // Upstream rate limit. Wait 2.2s and retry once.
                    sleep(Duration::from_millis(2200)).await;
                    let retry_res = send_upstream_request(
                        state.clone(),
                        provider,
                        auth_token,
                        active_key_row,
                        payload,
                        request_body,
                        Some(candidate.as_str()),
                    )
                    .await;
                    if let Ok(retry_response) = retry_res {
                        if retry_response.status().is_success() {
                            return Ok(retry_response);
                        }
                        last_error = Some((
                            retry_response.status(),
                            Json(json!({"error": retry_response.text().await.unwrap_or_default()})),
                        ));
                    }
                } else if response.status().is_success() {
                    return Ok(response);
                } else if response.status() == StatusCode::UNAUTHORIZED {
                    if let Some(retry_response) = retry_antigravity_after_refresh(
                        state.clone(),
                        active_key_row,
                        payload,
                        request_body,
                        &candidate,
                    )
                    .await?
                    {
                        return Ok(retry_response);
                    }
                    last_error = Some((
                        response.status(),
                        Json(json!({"error": response.text().await.unwrap_or_default()})),
                    ));
                } else {
                    last_error = Some((
                        response.status(),
                        Json(json!({"error": response.text().await.unwrap_or_default()})),
                    ));
                }
            }
            Err(error) => {
                last_error = Some(error);
            }
        }
    }

    Err(last_error.unwrap_or_else(|| {
        (
            StatusCode::BAD_GATEWAY,
            Json(json!({"error": "No Antigravity upstream endpoint succeeded"})),
        )
    }))
}

async fn retry_antigravity_after_refresh(
    state: State<Arc<AppState>>,
    active_key_row: &Value,
    payload: &ChatCompletionRequest,
    request_body: &Value,
    candidate: &str,
) -> Result<Option<reqwest::Response>, (StatusCode, Json<serde_json::Value>)> {
    let refreshed = crate::token::refresh_account_token(active_key_row)
        .await
        .map_err(|error| (StatusCode::BAD_GATEWAY, Json(json!({"error": error}))))?;
    let Some(token) = refreshed.and_then(|value| value.access_token) else {
        return Ok(None);
    };
    let response = send_upstream_request(
        state.clone(),
        "antigravity",
        token.as_str(),
        active_key_row,
        payload,
        request_body,
        Some(candidate),
    )
    .await?;
    if response.status().is_success() {
        return Ok(Some(response));
    }
    Ok(None)
}

async fn send_upstream_request(
    state: State<Arc<AppState>>,
    provider: &str,
    auth_token: &str,
    active_key_row: &Value,
    payload: &ChatCompletionRequest,
    request_body: &Value,
    base_url_override: Option<&str>,
) -> Result<reqwest::Response, (StatusCode, Json<serde_json::Value>)> {
    let upstream_url =
        get_upstream_url(provider, payload.stream, active_key_row, base_url_override);

    let session_key = generate_session_key(active_key_row, payload);
    let (session_id, prior_signature) = {
        let mut sid_cache = state.session_id_cache.lock().await;
        let sig_cache = state.signature_cache.lock().await;

        let sid = sid_cache
            .entry(session_key.clone())
            .or_insert_with(|| uuid::Uuid::new_v4().to_string())
            .clone();
        let sig = sig_cache.get(&session_key).cloned();
        (sid, sig)
    };

    let builder = headers::apply_headers(
        upstream_http_client().post(upstream_url),
        provider,
        auth_token,
        payload.stream,
        active_key_row,
        Some(&session_id),
        prior_signature.as_deref(),
    );
    builder.json(request_body).send().await.map_err(|error| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": error.to_string()})),
        )
    })
}

async fn prepare_payload(
    provider: &str,
    mut payload: ChatCompletionRequest,
    auth_token: &str,
    active_key_row: &Value,
) -> Result<ChatCompletionRequest, (StatusCode, Json<serde_json::Value>)> {
    if let Some(injection) = crate::proxy::skills::build_skill_injection(provider)
        .await
        .map_err(|error| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to resolve skills: {}", error)})),
            )
        })?
    {
        crate::proxy::skills::inject_skill_prompt(&mut payload, &injection.content).map_err(
            |error| {
                (
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": format!("Failed to inject skills: {}", error)})),
                )
            },
        )?;
    }

    if provider != "antigravity" {
        return Ok(payload);
    }

    let project_id = resolve_antigravity_project_id(auth_token, active_key_row).await?;
    let mut metadata = payload
        .metadata
        .take()
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    metadata.insert("project_id".to_string(), Value::String(project_id));
    payload.metadata = Some(Value::Object(metadata));
    Ok(payload)
}

async fn resolve_antigravity_project_id(
    auth_token: &str,
    active_key_row: &Value,
) -> Result<String, (StatusCode, Json<serde_json::Value>)> {
    if let Some(project_id) = antigravity_project_from_row(active_key_row) {
        return Ok(project_id);
    }

    let client = crate::auth::antigravity::client::AntigravityClient::new(None)
        .await
        .map_err(|error| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to initialize Antigravity OAuth client: {}", error)})),
            )
        })?;
    let context = client
        .discover_project_context(auth_token)
        .await
        .map_err(|error| {
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("Failed to resolve Antigravity project: {}", error)})),
            )
        })?;
    let project_id = client
        .ensure_onboarded(auth_token, &context)
        .await
        .map_err(|error| {
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("Failed to resolve Antigravity project: {}", error)})),
            )
        })?;

    if let Some(account_id) = active_key_row.get("id").and_then(Value::as_str) {
        let _ = crate::db::merge_metadata_patch(
            account_id,
            "antigravity",
            json!({ "project_id": project_id, "tier_id": context.tier_id }),
        )
        .await;
    }

    Ok(project_id)
}

fn antigravity_project_from_row(active_key_row: &Value) -> Option<String> {
    let metadata = active_key_row
        .get("metadata")
        .and_then(parse_metadata_map)
        .unwrap_or_default();
    metadata
        .get("project_id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != "auto")
        .map(str::to_string)
}

fn requested_account_id(payload: &ChatCompletionRequest) -> Option<String> {
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

fn parse_metadata_map(value: &Value) -> Option<Map<String, Value>> {
    match value {
        Value::Object(map) => Some(map.clone()),
        Value::String(text) => serde_json::from_str::<Value>(text)
            .ok()
            .and_then(|parsed| parsed.as_object().cloned()),
        _ => None,
    }
}

fn copilot_rate_limiter() -> &'static Mutex<CopilotRateLimitState> {
    COPILOT_RATE_LIMITER.get_or_init(|| Mutex::new(CopilotRateLimitState::default()))
}

fn antigravity_rate_limiter() -> &'static Mutex<AntigravityRateLimitState> {
    ANTIGRAVITY_RATE_LIMITER.get_or_init(|| Mutex::new(AntigravityRateLimitState::default()))
}

fn decrypt_if_needed(token: &str) -> Result<String, (StatusCode, Json<serde_json::Value>)> {
    if !token.starts_with("Tengra:v1:") {
        return Ok(token.to_string());
    }
    let master_key = crate::security::load_master_key().map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
    })?;
    crate::security::decrypt_token(token, &master_key).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
    })
}

fn is_quota_exhausted(row: &serde_json::Value) -> bool {
    row.get("metadata")
        .and_then(|m| m.as_str())
        .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
        .and_then(|v| {
            v.get("quota")
                .and_then(|q| q.get("remaining"))
                .and_then(|remaining| remaining.as_f64())
                .map(|remaining| remaining <= 0.0)
        })
        .unwrap_or(false)
}

fn get_upstream_url(
    provider: &str,
    stream: bool,
    active_key_row: &Value,
    base_url_override: Option<&str>,
) -> String {
    match provider {
        // Anthropic Claude
        "claude" => "https://api.anthropic.com/v1/messages".to_string(),

        // Google Antigravity (OAuth-based Gemini)
        "antigravity" => {
            let base = base_url_override
                .map(str::to_string)
                .unwrap_or_else(|| antigravity_base_url(active_key_row));
            if stream {
                format!("{}/v1internal:streamGenerateContent?alt=sse", base)
            } else {
                format!("{}/v1internal:generateContent", base)
            }
        }

        // OpenAI Codex (OAuth-based)
        "codex" => "https://chatgpt.com/backend-api/codex/responses".to_string(),

        // GitHub Copilot
        "copilot" => "https://api.githubcopilot.com/chat/completions".to_string(),

        // NVIDIA NIM
        "nvidia" => "https://integrate.api.nvidia.com/v1/chat/completions".to_string(),

        // OpenAI API (sk-... keys)
        "openai" => "https://api.openai.com/v1/chat/completions".to_string(),

        // Google Gemini API (API key)
        "gemini" => {
            let model = extract_model_from_row(active_key_row).unwrap_or("gemini-2.0-flash");
            if stream {
                format!(
                    "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse",
                    model
                )
            } else {
                format!(
                    "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
                    model
                )
            }
        }

        // Mistral AI
        "mistral" => "https://api.mistral.ai/v1/chat/completions".to_string(),

        // Groq (fast inference)
        "groq" => "https://api.groq.com/openai/v1/chat/completions".to_string(),

        // Together AI
        "together" => "https://api.together.xyz/v1/chat/completions".to_string(),

        // Perplexity AI
        "perplexity" => "https://api.perplexity.ai/chat/completions".to_string(),

        // Cohere
        "cohere" => "https://api.cohere.com/v2/chat".to_string(),

        // xAI (Grok)
        "xai" => "https://api.x.ai/v1/chat/completions".to_string(),

        // DeepSeek
        "deepseek" => "https://api.deepseek.com/v1/chat/completions".to_string(),

        // OpenRouter (multi-model gateway)
        "openrouter" => "https://openrouter.ai/api/v1/chat/completions".to_string(),

        // Default: OpenAI-compatible
        _ => "https://api.openai.com/v1/chat/completions".to_string(),
    }
}

fn extract_model_from_row(row: &Value) -> Option<&str> {
    row.get("model").and_then(Value::as_str)
}

fn antigravity_base_url(active_key_row: &Value) -> String {
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

fn upstream_http_client() -> &'static Client {
    UPSTREAM_HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            // Streaming completions can legitimately run for several minutes.
            // Keep a long request timeout to avoid cutting active streams mid-response.
            .timeout(std::time::Duration::from_secs(600))
            .connect_timeout(std::time::Duration::from_secs(15))
            .pool_max_idle_per_host(8)
            .tcp_keepalive(std::time::Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

fn generate_session_key(
    row: &serde_json::Value,
    payload: &crate::proxy::types::ChatCompletionRequest,
) -> String {
    let account_id = row
        .get("id")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("anon")
        .to_string();
    let conversation_id = payload
        .metadata
        .as_ref()
        .and_then(|m| {
            m.get("conversation_id")
                .or_else(|| m.get("conversationId"))
                .and_then(serde_json::Value::as_str)
        })
        .unwrap_or("default")
        .to_string();
    format!("{}:{}", account_id, conversation_id)
}
