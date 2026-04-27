/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::proxy::server::AppState;
use crate::proxy::skills::{
    delete_skill, get_skill, install_marketplace_skill_input, list_marketplace_skills, list_skills,
    toggle_skill, upsert_skill, InstallMarketplaceSkillInput, ToggleSkillInput, UpsertSkillInput,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::json;
use std::sync::Arc;

pub async fn handle_list_skills(
    _state: State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let skills = list_skills()
        .await
        .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    Ok(Json(json!({ "items": skills })))
}

pub async fn handle_get_skill(
    _state: State<Arc<AppState>>,
    Path(skill_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let item = get_skill(&skill_id)
        .await
        .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    if let Some(skill) = item {
        return Ok(Json(json!({ "item": skill })));
    }
    Err((StatusCode::NOT_FOUND, "Skill not found".to_string()))
}

pub async fn handle_upsert_skill(
    _state: State<Arc<AppState>>,
    Json(payload): Json<UpsertSkillInput>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let skill = upsert_skill(payload)
        .await
        .map_err(|error| (StatusCode::BAD_REQUEST, error.to_string()))?;
    Ok(Json(json!({ "item": skill })))
}

pub async fn handle_toggle_skill(
    _state: State<Arc<AppState>>,
    Path(skill_id): Path<String>,
    Json(payload): Json<ToggleSkillInput>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let skill = toggle_skill(&skill_id, payload.enabled)
        .await
        .map_err(|error| (StatusCode::BAD_REQUEST, error.to_string()))?;
    if let Some(item) = skill {
        return Ok(Json(json!({ "item": item })));
    }
    Err((StatusCode::NOT_FOUND, "Skill not found".to_string()))
}

pub async fn handle_delete_skill(
    _state: State<Arc<AppState>>,
    Path(skill_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    delete_skill(&skill_id)
        .await
        .map_err(|error| (StatusCode::BAD_REQUEST, error.to_string()))?;
    Ok(Json(json!({ "success": true })))
}

pub async fn handle_list_marketplace_skills(
    _state: State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let items = list_marketplace_skills()
        .await
        .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    Ok(Json(json!({ "items": items })))
}

pub async fn handle_install_marketplace_skill(
    _state: State<Arc<AppState>>,
    Json(payload): Json<InstallMarketplaceSkillInput>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let installed = install_marketplace_skill_input(payload)
        .await
        .map_err(|error| (StatusCode::BAD_REQUEST, error.to_string()))?;
    Ok(Json(json!({ "item": installed })))
}
