use axum::http::header::AUTHORIZATION;
use axum::{
    extract::State,
    http::{Request, StatusCode},
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;

use crate::db;
use crate::proxy::handlers::chat::handle_chat_completions;
use crate::static_config;

const INSECURE_PROXY_FALLBACK_ENV: &str = "TENGRA_PROXY_ALLOW_INSECURE_DEFAULT_KEY";

pub struct AppState {
    // No db_url needed, db module handles it
}

pub async fn start_proxy_server(port: u16) -> anyhow::Result<()> {
    let state = Arc::new(AppState {});
    let protected = Router::new()
        .route(
            "/v1/models",
            get(crate::proxy::handlers::models::handle_get_models),
        )
        .route(
            "/models",
            get(crate::proxy::handlers::models::handle_get_models),
        )
        .route(
            "/v1beta/models",
            get(crate::proxy::handlers::models::handle_get_models),
        )
        .route("/v1/chat/completions", post(handle_chat_completions))
        .route("/chat/completions", post(handle_chat_completions))
        .route(
            "/v1/completions",
            post(crate::proxy::handlers::completions::handle_completions),
        )
        .route(
            "/completions",
            post(crate::proxy::handlers::completions::handle_completions),
        )
        .route(
            "/v1/responses",
            post(crate::proxy::handlers::responses::handle_responses),
        )
        .route(
            "/responses",
            post(crate::proxy::handlers::responses::handle_responses),
        )
        .route(
            "/v1/messages",
            post(crate::proxy::handlers::claude::handle_messages),
        )
        .route(
            "/messages",
            post(crate::proxy::handlers::claude::handle_messages),
        )
        .route(
            "/v1/messages/count_tokens",
            post(crate::proxy::handlers::claude::handle_count_tokens),
        )
        .route(
            "/messages/count_tokens",
            post(crate::proxy::handlers::claude::handle_count_tokens),
        )
        .route(
            "/v1/embeddings",
            post(crate::proxy::handlers::embeddings::handle_embeddings),
        )
        .route(
            "/v0/auth/github/login",
            get(crate::proxy::handlers::management::handle_github_login),
        )
        .route(
            "/v0/auth/github/poll",
            get(crate::proxy::handlers::management::handle_github_poll),
        )
        .route(
            "/v0/management/accounts",
            get(crate::proxy::handlers::management::handle_list_accounts),
        )
        .route(
            "/v0/management/quota",
            get(crate::proxy::handlers::management::handle_get_quota),
        )
        .route(
            "/v0/management/anthropic-auth-url",
            get(crate::proxy::handlers::management::handle_claude_auth_url),
        )
        .route(
            "/v0/management/codex-auth-url",
            get(crate::proxy::handlers::management::handle_codex_auth_url),
        )
        .route(
            "/v0/management/antigravity-auth-url",
            get(crate::proxy::handlers::management::handle_antigravity_auth_url),
        )
        .route(
            "/v0/management/get-auth-status",
            get(crate::proxy::handlers::management::handle_get_auth_status),
        )
        .route(
            "/v0/management/cancel-auth",
            post(crate::proxy::handlers::management::handle_cancel_auth),
        )
        .route(
            "/v0/management/oauth-callback",
            post(crate::proxy::handlers::management::handle_manual_oauth_callback),
        )
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ))
        .with_state(state.clone());

    let app = Router::new()
        .route("/health", get(health_check))
        .route(
            "/api/auth/oauth/bridge/readiness",
            get(oauth_bridge_readiness),
        )
        .merge(protected)
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = TcpListener::bind(addr).await?;

    eprintln!("[LOG] Proxy HTTP server listening on http://{}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> Json<serde_json::Value> {
    let db_connected = crate::db::get_all_linked_accounts().await.is_ok();
    let client_id_configured = codex_client_id_configured().await;
    Json(json!({
        "status": if db_connected { "ok" } else { "degraded" },
        "db": {
            "connected": db_connected
        },
        "oauth_bridge": {
            "callback_port": 1455,
            "openai_client_id_configured": client_id_configured
        }
    }))
}

async fn oauth_bridge_readiness() -> Json<serde_json::Value> {
    let client_id_configured = codex_client_id_configured().await;
    Json(json!({
        "status": if client_id_configured { "ready" } else { "misconfigured" },
        "bridge": {
            "provider": "codex",
            "callback_url": "http://localhost:1455/auth/callback",
            "callback_port": 1455,
            "client_id_configured": client_id_configured
        }
    }))
}

async fn codex_client_id_configured() -> bool {
    !static_config::OPENAI_OAUTH_CLIENT_ID.trim().is_empty()
}

async fn auth_middleware(
    _state: State<Arc<AppState>>,
    req: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let provided_keys = extract_auth_candidates(&req);

    if !provided_keys.is_empty() {
        let insecure_fallback_enabled = std::env::var(INSECURE_PROXY_FALLBACK_ENV)
            .map(|value| matches!(value.trim(), "1" | "true" | "TRUE" | "yes" | "YES"))
            .unwrap_or(false);

        // Proxy auth rows are stored as provider `proxy_key`, not metadata type `api_key`.
        match db::get_provider_accounts("proxy_key").await {
            Ok(keys) if !keys.is_empty() => {
                if provided_keys
                    .iter()
                    .any(|key| keys.iter().any(|row| proxy_key_matches(row, key)))
                {
                    return Ok(next.run(req).await);
                }
            }
            _ => {
                if insecure_fallback_enabled
                    && provided_keys.iter().any(|key| key == "proxypal-local")
                {
                    return Ok(next.run(req).await);
                }
            }
        }

        if matches_local_proxy_keys(&provided_keys) {
            return Ok(next.run(req).await);
        }
    }

    Err(StatusCode::UNAUTHORIZED)
}

fn proxy_key_matches(row: &serde_json::Value, provided_key: &str) -> bool {
    let Some(stored_value) = row.get("access_token").and_then(|value| value.as_str()) else {
        return false;
    };

    if stored_value == provided_key {
        return true;
    }

    if !stored_value.starts_with("Tengra:v1:") {
        return false;
    }

    let Ok(master_key) = crate::security::load_master_key() else {
        return false;
    };

    match crate::security::decrypt_token(stored_value, &master_key) {
        Ok(decrypted) => decrypted == provided_key,
        Err(_) => false,
    }
}

fn extract_auth_candidates(req: &Request<axum::body::Body>) -> Vec<String> {
    let mut candidates = Vec::new();
    append_header_candidate(req.headers().get(AUTHORIZATION), &mut candidates);
    append_header_value(req.headers().get("X-Goog-Api-Key"), &mut candidates);
    append_header_value(req.headers().get("X-Api-Key"), &mut candidates);

    if let Some(query) = req.uri().query() {
        for (key, value) in url::form_urlencoded::parse(query.as_bytes()) {
            if matches!(key.as_ref(), "key" | "auth_token") && !value.trim().is_empty() {
                candidates.push(value.trim().to_string());
            }
        }
    }

    candidates
}

fn append_header_candidate(value: Option<&axum::http::HeaderValue>, candidates: &mut Vec<String>) {
    let Some(value) = value.and_then(|header| header.to_str().ok()) else {
        return;
    };
    if let Some(token) = value.strip_prefix("Bearer ") {
        candidates.push(token.trim().to_string());
        return;
    }
    let trimmed = value.trim();
    if !trimmed.is_empty() {
        candidates.push(trimmed.to_string());
    }
}

fn append_header_value(value: Option<&axum::http::HeaderValue>, candidates: &mut Vec<String>) {
    let Some(value) = value.and_then(|header| header.to_str().ok()) else {
        return;
    };
    let trimmed = value.trim();
    if !trimmed.is_empty() {
        candidates.push(trimmed.to_string());
    }
}

fn matches_local_proxy_keys(provided_keys: &[String]) -> bool {
    let configured_keys = load_local_proxy_keys();
    if configured_keys.is_empty() {
        return false;
    }

    provided_keys
        .iter()
        .any(|provided| configured_keys.iter().any(|stored| stored == provided))
}

fn load_local_proxy_keys() -> Vec<String> {
    let Some(settings_path) = get_settings_path() else {
        return Vec::new();
    };
    let Ok(contents) = std::fs::read_to_string(settings_path) else {
        return Vec::new();
    };
    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&contents) else {
        return Vec::new();
    };

    extract_proxy_keys_from_settings_value(&parsed)
}

fn get_settings_path() -> Option<PathBuf> {
    let app_data = std::env::var("APPDATA").ok()?;
    let base = PathBuf::from(app_data)
        .join("Tengra")
        .join("data")
        .join("config");
    let settings_path = base.join("settings.json");
    if settings_path.exists() {
        return Some(settings_path);
    }

    let legacy_path = PathBuf::from(std::env::var("APPDATA").ok()?)
        .join("tengra")
        .join("data")
        .join("config")
        .join("settings.json");
    legacy_path.exists().then_some(legacy_path)
}

fn extract_proxy_keys_from_settings_value(value: &serde_json::Value) -> Vec<String> {
    let mut keys = Vec::new();
    append_proxy_key(value.get("proxy"), &mut keys);
    append_proxy_key(
        value.get("data").and_then(|nested| nested.get("proxy")),
        &mut keys,
    );
    keys
}

fn append_proxy_key(value: Option<&serde_json::Value>, keys: &mut Vec<String>) {
    let Some(proxy) = value else {
        return;
    };

    for field in ["apiKey", "managementPassword", "key"] {
        let Some(candidate) = proxy.get(field).and_then(|raw| raw.as_str()) else {
            continue;
        };
        let trimmed = candidate.trim();
        if !trimmed.is_empty() && !keys.iter().any(|existing| existing == trimmed) {
            keys.push(trimmed.to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use axum::http::Request;
    use serde_json::json;

    use super::{extract_auth_candidates, extract_proxy_keys_from_settings_value};

    #[test]
    fn extracts_auth_candidates_from_headers_and_query() {
        let request = Request::builder()
            .uri("/v1/models?key=query-key&auth_token=query-token")
            .header("Authorization", "Bearer bearer-key")
            .header("X-Goog-Api-Key", "goog-key")
            .header("X-Api-Key", "anthropic-key")
            .body(axum::body::Body::empty())
            .expect("request");

        let candidates = extract_auth_candidates(&request);
        assert_eq!(
            candidates,
            vec![
                "bearer-key".to_string(),
                "goog-key".to_string(),
                "anthropic-key".to_string(),
                "query-key".to_string(),
                "query-token".to_string()
            ]
        );
    }

    #[test]
    fn extracts_proxy_keys_from_top_level_and_nested_settings() {
        let value = json!({
            "proxy": {
                "apiKey": "runtime-api-key",
                "managementPassword": "runtime-password"
            },
            "data": {
                "proxy": {
                    "key": "legacy-proxy-key",
                    "apiKey": "runtime-api-key"
                }
            }
        });

        let keys = extract_proxy_keys_from_settings_value(&value);
        assert_eq!(
            keys,
            vec![
                "runtime-api-key".to_string(),
                "runtime-password".to_string(),
                "legacy-proxy-key".to_string()
            ]
        );
    }
}
