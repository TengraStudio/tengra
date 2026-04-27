/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

//! HTTP server implementation

use axum::{
    body::Body,
    http::{header::AUTHORIZATION, Request, StatusCode},
    middleware::{self, Next},
    response::Response,
    routing::{delete, get, post, put},
    Router,
};
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

use crate::database::Database;
use crate::handlers::{chats, knowledge, system, workspaces};
use crate::types::{ApiResponse, HealthResponse};

/// Create the Axum router with all routes
pub fn create_router(db: Arc<Database>, start_time: std::time::Instant) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api_routes = Router::new()
        .route(
            "/api/v1/chats",
            get(chats::list_chats).post(chats::create_chat),
        )
        .route("/api/v1/chats/:id", get(chats::get_chat))
        .route("/api/v1/chats/:id", put(chats::update_chat))
        .route("/api/v1/chats/:id", delete(chats::delete_chat))
        .route("/api/v1/chats/:id/messages", get(chats::get_messages))
        // Message routes
        .route("/api/v1/messages", post(chats::add_message))
        .route("/api/v1/messages/:id", put(chats::update_message))
        .route("/api/v1/messages/:id", delete(chats::delete_message))
        // Workspace routes
        .route("/api/v1/workspaces", get(workspaces::list_workspaces))
        .route("/api/v1/workspaces", post(workspaces::create_workspace))
        .route("/api/v1/workspaces/:id", get(workspaces::get_workspace))
        .route("/api/v1/workspaces/:id", put(workspaces::update_workspace))
        .route(
            "/api/v1/workspaces/:id",
            delete(workspaces::delete_workspace),
        )
        // Knowledge routes
        .route(
            "/api/v1/knowledge/symbols",
            post(knowledge::store_code_symbol),
        )
        .route(
            "/api/v1/knowledge/symbols/search",
            post(knowledge::search_code_symbols),
        )
        .route(
            "/api/v1/knowledge/fragments",
            post(knowledge::store_semantic_fragment),
        )
        .route(
            "/api/v1/knowledge/fragments/search",
            post(knowledge::search_semantic_fragments),
        )
        // Folder routes
        .route("/api/v1/folders", get(system::list_folders))
        .route("/api/v1/folders", post(system::create_folder))
        .route("/api/v1/folders/:id", put(system::update_folder))
        .route("/api/v1/folders/:id", delete(system::delete_folder))
        // Prompt routes
        .route("/api/v1/prompts", get(system::list_prompts))
        .route("/api/v1/prompts", post(system::create_prompt))
        .route("/api/v1/prompts/:id", put(system::update_prompt))
        .route("/api/v1/prompts/:id", delete(system::delete_prompt))
        // Stats routes
        .route("/api/v1/stats", get(system::get_stats))
        // Raw query
        .route("/api/v1/query", post(system::execute_query))
        .layer(middleware::from_fn(db_service_auth_middleware));

    Router::new()
        // Health check
        .route(
            "/health",
            get({
                let start = start_time;
                move || async move {
                    let uptime = start.elapsed().as_secs();
                    axum::Json(ApiResponse::success(HealthResponse {
                        status: "healthy".to_string(),
                        version: env!("CARGO_PKG_VERSION").to_string(),
                        uptime_seconds: uptime,
                    }))
                }
            }),
        )
        .merge(api_routes)
        // State and middleware
        .with_state(db)
        .layer(cors)
}

async fn db_service_auth_middleware(
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let Some(expected_token) = load_db_service_token() else {
        tracing::error!("DB service token is not configured");
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    };

    let Some(provided_token) = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    if constant_time_eq(provided_token.as_bytes(), expected_token.as_bytes()) {
        return Ok(next.run(req).await);
    }

    Err(StatusCode::UNAUTHORIZED)
}

fn load_db_service_token() -> Option<String> {
    std::env::var("TENGRA_DB_SERVICE_TOKEN")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(read_db_service_token_file)
}

fn read_db_service_token_file() -> Option<String> {
    for candidate in db_service_token_file_candidates() {
        let Ok(contents) = std::fs::read_to_string(candidate) else {
            continue;
        };
        let token = contents.trim().to_string();
        if !token.is_empty() {
            return Some(token);
        }
    }
    None
}

fn db_service_token_file_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(root) = std::env::var("TENGRA_USER_DATA_ROOT") {
        candidates.push(PathBuf::from(root).join("services").join("db-service.token"));
    }

    if let Ok(app_data) = std::env::var("APPDATA") {
        candidates.extend(
            ["Tengra", "tengra"]
                .into_iter()
                .map(|root| {
                    PathBuf::from(&app_data)
                        .join(root)
                        .join("services")
                        .join("db-service.token")
                }),
        );
    }

    candidates
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }

    let mut diff = 0u8;
    for (left_byte, right_byte) in left.iter().zip(right.iter()) {
        diff |= left_byte ^ right_byte;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::constant_time_eq;

    #[test]
    fn constant_time_eq_requires_same_bytes() {
        assert!(constant_time_eq(b"same-token", b"same-token"));
        assert!(!constant_time_eq(b"same-token", b"other-token"));
        assert!(!constant_time_eq(b"same-token", b"same-token-extra"));
    }
}
