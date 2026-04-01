//! HTTP server implementation

use axum::{
    routing::{delete, get, post, put},
    Router,
};
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
        // Chat routes
        .route("/api/v1/chats", get(chats::list_chats))
        .route("/api/v1/chats", post(chats::create_chat))
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
        // State and middleware
        .with_state(db)
        .layer(cors)
}
