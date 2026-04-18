/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::proxy::server::AppState;
use crate::tools::{self, ToolDispatchInput, ToolDispatchResponse};
use axum::{extract::State, Json};
use std::sync::Arc;

pub async fn handle_tool_dispatch(
    State(state): State<Arc<AppState>>,
    Json(input): Json<ToolDispatchInput>,
) -> Json<ToolDispatchResponse> {
    let response = tools::dispatch(state, input).await;
    Json(response)
}
