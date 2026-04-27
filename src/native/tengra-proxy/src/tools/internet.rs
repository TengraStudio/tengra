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

pub async fn handle_action(action: &str, args: Value) -> ToolDispatchResponse {
    match action {
        "weather" => weather(args).await,
        _ => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Unknown internet action: {}", action)),
        },
    }
}

async fn weather(args: Value) -> ToolDispatchResponse {
    let location = args.get("location").and_then(|v| v.as_str()).unwrap_or("");
    let url = format!("https://wttr.in/{}?format=j1", location);

    match Client::new().get(&url).send().await {
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
            error: Some(format!("Failed to fetch weather: {}", e)),
        },
    }
}
