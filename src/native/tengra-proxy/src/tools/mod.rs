use crate::proxy::server::AppState;
/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

pub mod filesystem;
pub mod git;
pub mod internet;
pub mod llm;
pub mod network;
pub mod system;
pub mod terminal;
pub mod web;
pub mod workspace;

#[derive(Debug, Deserialize)]
pub struct ToolDispatchInput {
    pub service: String,
    pub action: String,
    pub arguments: Value,
}

#[derive(Debug, Serialize)]
pub struct ToolDispatchResponse {
    pub success: bool,
    pub result: Option<Value>,
    pub error: Option<String>,
}

pub async fn dispatch(state: Arc<AppState>, input: ToolDispatchInput) -> ToolDispatchResponse {
    match input.service.as_str() {
        "filesystem" => filesystem::handle_action(&input.action, input.arguments).await,
        "terminal" => terminal::handle_action(state, &input.action, input.arguments).await,
        "git" => git::handle_action(&input.action, input.arguments).await,
        "system" => system::handle_action(&input.action, input.arguments).await,
        "web" => web::handle_action(&input.action, input.arguments).await,
        "network" => network::handle_action(&input.action, input.arguments).await,
        "internet" => internet::handle_action(&input.action, input.arguments).await,
        "workspace" => workspace::handle_action(&input.action, input.arguments).await,
        "docker" => workspace::handle_action(&input.action, input.arguments).await, // Alias
        "llm" => llm::handle_action(&input.action, input.arguments).await,
        "ollama" => llm::handle_action(&input.action, input.arguments).await, // Alias
        "analysis" => crate::analysis::handle_action(state, &input.action, input.arguments).await,
        _ => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Unknown service: {}", input.service)),
        },
    }
}
