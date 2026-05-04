/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::proxy::server::AppState;
use crate::tools::mcp::McpPluginConfig;

#[derive(Deserialize)]
pub struct RegisterMcpRequest {
    pub name: String,
    pub description: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: Option<std::collections::HashMap<String, String>>,
}

#[derive(Deserialize)]
pub struct CallMcpRequest {
    pub plugin_name: String,
    pub tool_name: String,
    pub arguments: Value,
}

pub async fn handle_register_mcp(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterMcpRequest>,
) -> Json<Value> {
    let config = McpPluginConfig {
        name: req.name,
        description: req.description,
        command: req.command,
        args: req.args,
        env: req.env,
    };

    match state.mcp_manager.register_plugin(config).await {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

pub async fn handle_call_mcp(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CallMcpRequest>,
) -> Json<Value> {
    match state.mcp_manager.call_tool(&req.plugin_name, &req.tool_name, req.arguments).await {
        Ok(res) => Json(json!({ "success": true, "result": res })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

pub async fn handle_list_mcp(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let plugins = state.mcp_manager.list_plugins().await;
    Json(json!({ "success": true, "plugins": plugins }))
}
