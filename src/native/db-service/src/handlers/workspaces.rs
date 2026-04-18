/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

//! Workspace handlers

use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;

use crate::database::Database;
use crate::types::*;

/// GET /api/v1/workspaces - List all workspaces
pub async fn list_workspaces(State(db): State<Arc<Database>>) -> Json<ApiResponse<Vec<Workspace>>> {
    match db.get_workspaces().await {
        Ok(workspaces) => Json(ApiResponse::success(workspaces)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// GET /api/v1/workspaces/:id - Get a single workspace
pub async fn get_workspace(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
) -> Json<ApiResponse<Option<Workspace>>> {
    match db.get_workspace(&id).await {
        Ok(workspace) => Json(ApiResponse::success(workspace)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// POST /api/v1/workspaces - Create a new workspace
pub async fn create_workspace(
    State(db): State<Arc<Database>>,
    Json(req): Json<CreateWorkspaceRequest>,
) -> Json<ApiResponse<Workspace>> {
    match db.create_workspace(req).await {
        Ok(workspace) => Json(ApiResponse::success(workspace)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// PUT /api/v1/workspaces/:id - Update a workspace
pub async fn update_workspace(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
    Json(req): Json<UpdateWorkspaceRequest>,
) -> Json<ApiResponse<bool>> {
    match db.update_workspace(&id, req).await {
        Ok(updated) => Json(ApiResponse::success(updated)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// DELETE /api/v1/workspaces/:id - Delete a workspace
pub async fn delete_workspace(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
) -> Json<ApiResponse<bool>> {
    match db.delete_workspace(&id).await {
        Ok(deleted) => Json(ApiResponse::success(deleted)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}
