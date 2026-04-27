use crate::tools::ToolDispatchResponse;
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
use std::process::Command;

pub async fn handle_action(action: &str, _args: Value) -> ToolDispatchResponse {
    match action {
        "listContainers" => list_containers().await,
        "stats" => stats().await,
        "listImages" => list_images().await,
        _ => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Unknown workspace action: {}", action)),
        },
    }
}

async fn list_containers() -> ToolDispatchResponse {
    match Command::new("docker")
        .arg("ps")
        .arg("-a")
        .arg("--format")
        .arg("{{json .}}")
        .output()
    {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let containers: Vec<Value> = stdout
                .lines()
                .filter_map(|line| serde_json::from_str(line).ok())
                .collect();
            ToolDispatchResponse {
                success: true,
                result: Some(json!(containers)),
                error: None,
            }
        }
        Err(e) => error_response(&format!("Failed to list docker containers: {}", e)),
    }
}

async fn stats() -> ToolDispatchResponse {
    match Command::new("docker")
        .arg("stats")
        .arg("--no-stream")
        .arg("--format")
        .arg("{{json .}}")
        .output()
    {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let stats: Vec<Value> = stdout
                .lines()
                .filter_map(|line| serde_json::from_str(line).ok())
                .collect();
            ToolDispatchResponse {
                success: true,
                result: Some(json!(stats)),
                error: None,
            }
        }
        Err(e) => error_response(&format!("Failed to get docker stats: {}", e)),
    }
}

async fn list_images() -> ToolDispatchResponse {
    match Command::new("docker")
        .arg("images")
        .arg("--format")
        .arg("{{json .}}")
        .output()
    {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let images: Vec<Value> = stdout
                .lines()
                .filter_map(|line| serde_json::from_str(line).ok())
                .collect();
            ToolDispatchResponse {
                success: true,
                result: Some(json!(images)),
                error: None,
            }
        }
        Err(e) => error_response(&format!("Failed to list docker images: {}", e)),
    }
}

fn error_response(msg: &str) -> ToolDispatchResponse {
    ToolDispatchResponse {
        success: false,
        result: None,
        error: Some(msg.into()),
    }
}
