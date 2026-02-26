//! Chat and message handlers

use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;

use crate::database::Database;
use crate::types::*;

/// GET /api/v1/chats - List all chats
pub async fn list_chats(
    State(db): State<Arc<Database>>,
) -> Json<ApiResponse<Vec<Chat>>> {
    match db.get_all_chats().await {
        Ok(chats) => Json(ApiResponse::success(chats)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// GET /api/v1/chats/:id - Get a single chat
pub async fn get_chat(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
) -> Json<ApiResponse<Option<Chat>>> {
    match db.get_chat(&id).await {
        Ok(chat) => Json(ApiResponse::success(chat)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// POST /api/v1/chats - Create a new chat
pub async fn create_chat(
    State(db): State<Arc<Database>>,
    Json(req): Json<CreateChatRequest>,
) -> Json<ApiResponse<Chat>> {
    match db.create_chat(req).await {
        Ok(chat) => Json(ApiResponse::success(chat)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// PUT /api/v1/chats/:id - Update a chat
pub async fn update_chat(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
    Json(req): Json<UpdateChatRequest>,
) -> Json<ApiResponse<bool>> {
    match db.update_chat(&id, req).await {
        Ok(updated) => Json(ApiResponse::success(updated)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// DELETE /api/v1/chats/:id - Delete a chat
pub async fn delete_chat(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
) -> Json<ApiResponse<bool>> {
    match db.delete_chat(&id).await {
        Ok(deleted) => Json(ApiResponse::success(deleted)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// GET /api/v1/chats/:id/messages - Get messages for a chat
pub async fn get_messages(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
) -> Json<ApiResponse<Vec<Message>>> {
    match db.get_messages(&id).await {
        Ok(messages) => Json(ApiResponse::success(messages)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// POST /api/v1/messages - Add a message
pub async fn add_message(
    State(db): State<Arc<Database>>,
    Json(req): Json<CreateMessageRequest>,
) -> Json<ApiResponse<Message>> {
    match db.add_message(req).await {
        Ok(message) => Json(ApiResponse::success(message)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// PUT /api/v1/messages/:id - Update a message
pub async fn update_message(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
    Json(req): Json<UpdateMessageRequest>,
) -> Json<ApiResponse<bool>> {
    match db.update_message(&id, req).await {
        Ok(updated) => Json(ApiResponse::success(updated)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// DELETE /api/v1/messages/:id - Delete a message
pub async fn delete_message(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
) -> Json<ApiResponse<bool>> {
    match db.delete_message(&id).await {
        Ok(deleted) => Json(ApiResponse::success(deleted)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}
