//! Project handlers

use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;

use crate::database::Database;
use crate::types::*;

/// GET /api/v1/projects - List all projects
pub async fn list_projects(
    State(db): State<Arc<Database>>,
) -> Json<ApiResponse<Vec<Project>>> {
    match db.get_projects().await {
        Ok(projects) => Json(ApiResponse::success(projects)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// GET /api/v1/projects/:id - Get a single project
pub async fn get_project(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
) -> Json<ApiResponse<Option<Project>>> {
    match db.get_project(&id).await {
        Ok(project) => Json(ApiResponse::success(project)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// POST /api/v1/projects - Create a new project
pub async fn create_project(
    State(db): State<Arc<Database>>,
    Json(req): Json<CreateProjectRequest>,
) -> Json<ApiResponse<Project>> {
    match db.create_project(req).await {
        Ok(project) => Json(ApiResponse::success(project)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// PUT /api/v1/projects/:id - Update a project
pub async fn update_project(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
    Json(req): Json<UpdateProjectRequest>,
) -> Json<ApiResponse<bool>> {
    match db.update_project(&id, req).await {
        Ok(updated) => Json(ApiResponse::success(updated)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// DELETE /api/v1/projects/:id - Delete a project
pub async fn delete_project(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
) -> Json<ApiResponse<bool>> {
    match db.delete_project(&id).await {
        Ok(deleted) => Json(ApiResponse::success(deleted)),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}
