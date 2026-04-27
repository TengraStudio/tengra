/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::proxy::model_service::{fetch_models_from_rows, ServedModel};
use axum::Json;
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
pub struct ModelListItem {
    pub id: String,
    pub object: &'static str,
    pub created: u64,
    pub owned_by: String,
    pub provider: String,
    pub name: String,
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quota_info: Option<Value>,
    pub context_length: u32,
    pub max_completion_tokens: u32,
    pub thinking_levels: Vec<String>,
}

#[derive(Serialize)]
pub struct ModelListResponse {
    pub object: &'static str,
    pub data: Vec<ModelListItem>,
}

pub async fn handle_get_models() -> Json<ModelListResponse> {
    let rows = crate::db::get_all_linked_accounts()
        .await
        .unwrap_or_default();
    let data = fetch_models_from_rows(&rows)
        .await
        .into_iter()
        .map(map_served_model)
        .collect();

    Json(ModelListResponse {
        object: "list",
        data,
    })
}

fn map_served_model(model: ServedModel) -> ModelListItem {
    ModelListItem {
        id: model.id,
        object: "model",
        created: model.created,
        owned_by: model.owned_by,
        provider: model.provider,
        name: model.name,
        display_name: model.display_name,
        description: model.description,
        quota_info: model.quota_info,
        context_length: model.context_length,
        max_completion_tokens: model.max_completion_tokens,
        thinking_levels: model.thinking_levels,
    }
}
