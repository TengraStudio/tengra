/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

//! System handlers (folders, prompts, stats, raw queries)

use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;

use crate::database::Database;
use crate::types::*;

// ============================================================================
// Folder Handlers
// ============================================================================

/// GET /api/v1/folders - List all folders
pub async fn list_folders(State(db): State<Arc<Database>>) -> Json<ApiResponse<Vec<Folder>>> {
    match db.get_folders().await {
        Ok(folders) => Json(ApiResponse::success(folders)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// POST /api/v1/folders - Create a new folder
pub async fn create_folder(
    State(db): State<Arc<Database>>,
    Json(req): Json<CreateFolderRequest>,
) -> Json<ApiResponse<Folder>> {
    match db.create_folder(req).await {
        Ok(folder) => Json(ApiResponse::success(folder)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// PUT /api/v1/folders/:id - Update a folder
pub async fn update_folder(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
    Json(req): Json<UpdateFolderRequest>,
) -> Json<ApiResponse<bool>> {
    match db.update_folder(&id, req).await {
        Ok(updated) => Json(ApiResponse::success(updated)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// DELETE /api/v1/folders/:id - Delete a folder
pub async fn delete_folder(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
) -> Json<ApiResponse<bool>> {
    match db.delete_folder(&id).await {
        Ok(deleted) => Json(ApiResponse::success(deleted)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

// ============================================================================
// Prompt Handlers
// ============================================================================

/// GET /api/v1/prompts - List all prompts
pub async fn list_prompts(State(db): State<Arc<Database>>) -> Json<ApiResponse<Vec<Prompt>>> {
    match db.get_prompts().await {
        Ok(prompts) => Json(ApiResponse::success(prompts)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// POST /api/v1/prompts - Create a new prompt
pub async fn create_prompt(
    State(db): State<Arc<Database>>,
    Json(req): Json<CreatePromptRequest>,
) -> Json<ApiResponse<Prompt>> {
    match db.create_prompt(req).await {
        Ok(prompt) => Json(ApiResponse::success(prompt)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// PUT /api/v1/prompts/:id - Update a prompt
pub async fn update_prompt(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
    Json(req): Json<UpdatePromptRequest>,
) -> Json<ApiResponse<bool>> {
    match db.update_prompt(&id, req).await {
        Ok(updated) => Json(ApiResponse::success(updated)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// DELETE /api/v1/prompts/:id - Delete a prompt
pub async fn delete_prompt(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
) -> Json<ApiResponse<bool>> {
    match db.delete_prompt(&id).await {
        Ok(deleted) => Json(ApiResponse::success(deleted)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

// ============================================================================
// Stats Handlers
// ============================================================================

/// GET /api/v1/stats - Get database statistics
pub async fn get_stats(State(db): State<Arc<Database>>) -> Json<ApiResponse<Stats>> {
    match db.get_stats().await {
        Ok(stats) => Json(ApiResponse::success(stats)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

// ============================================================================
// Raw Query Handlers
// ============================================================================

/// POST /api/v1/query - Execute a raw SQL query
pub async fn execute_query(
    State(db): State<Arc<Database>>,
    Json(req): Json<QueryRequest>,
) -> Json<ApiResponse<QueryResponse>> {
    match db.execute_query(req).await {
        Ok(response) => Json(ApiResponse::success(response)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}
