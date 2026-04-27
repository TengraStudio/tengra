use crate::tools::ToolDispatchResponse;
use reqwest::Client;
/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use serde_json::{json, Value};

pub async fn handle_action(action: &str, _args: Value) -> ToolDispatchResponse {
    match action {
        "listModels" => list_models().await,
        "ps" => ps().await,
        _ => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Unknown LLM action: {}", action)),
        },
    }
}

async fn list_models() -> ToolDispatchResponse {
    match Client::new()
        .get("http://localhost:11434/api/tags")
        .send()
        .await
    {
        Ok(resp) => {
            let json_val: Value = resp.json().await.unwrap_or(json!({}));
            ToolDispatchResponse {
                success: true,
                result: Some(json_val),
                error: None,
            }
        }
        Err(e) => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Failed to list Ollama models: {}", e)),
        },
    }
}

async fn ps() -> ToolDispatchResponse {
    match Client::new()
        .get("http://localhost:11434/api/ps")
        .send()
        .await
    {
        Ok(resp) => {
            let json_val: Value = resp.json().await.unwrap_or(json!({}));
            ToolDispatchResponse {
                success: true,
                result: Some(json_val),
                error: None,
            }
        }
        Err(e) => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Failed to get Ollama status: {}", e)),
        },
    }
}
