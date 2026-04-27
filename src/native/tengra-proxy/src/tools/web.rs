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
use std::time::Duration;

async fn duckduckgo_search(query: &str, _count: usize) -> anyhow::Result<Vec<Value>> {
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("Mozilla/5.0")
        .build()?;

    let url = format!(
        "https://api.duckduckgo.com/?q={}&format=json",
        urlencoding::encode(query)
    );
    let resp = client.get(url).send().await?;
    let json: Value = resp.json().await?;

    // DuckDuckGo free API returns "RelatedTopics"
    let mut results = Vec::new();
    if let Some(topics) = json.get("RelatedTopics").and_then(|t| t.as_array()) {
        for topic in topics {
            if let Some(text) = topic.get("Text").and_then(|t| t.as_str()) {
                let url = topic.get("FirstURL").and_then(|u| u.as_str()).unwrap_or("");
                results.push(json!({
                    "title": text,
                    "url": url,
                    "snippet": text
                }));
            }
        }
    }

    Ok(results)
}

pub async fn handle_action(action: &str, args: Value) -> ToolDispatchResponse {
    match action {
        "search" => search(args).await,
        "read_page" => read_page(args).await,
        "fetch_view" => read_page(args).await, // Alias for read_page
        "fetch_json" => fetch_json(args).await,
        _ => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Unknown web action: {}", action)),
        },
    }
}

pub async fn search(args: Value) -> ToolDispatchResponse {
    let query = match args.get("query").and_then(|v| v.as_str()) {
        Some(q) => q,
        None => return error_response("Missing 'query' argument"),
    };
    let count = args.get("count").and_then(|v| v.as_u64()).unwrap_or(5) as usize;

    match duckduckgo_search(query, count).await {
        Ok(results) => ToolDispatchResponse {
            success: true,
            result: Some(json!(results)),
            error: None,
        },
        Err(e) => error_response(&format!("Search failed: {}", e)),
    }
}

pub async fn read_page(args: Value) -> ToolDispatchResponse {
    let url = match args.get("url").and_then(|v| v.as_str()) {
        Some(u) => u,
        None => return error_response("Missing 'url' argument"),
    };

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        .build()
        .unwrap();

    match client.get(url).send().await {
        Ok(resp) => {
            let body = resp.text().await.unwrap_or_default();
            // Basic HTML to text conversion could happen here, or just return body
            ToolDispatchResponse {
                success: true,
                result: Some(json!({ "content": body })),
                error: None,
            }
        }
        Err(e) => error_response(&format!("Failed to fetch page: {}", e)),
    }
}

pub async fn fetch_json(args: Value) -> ToolDispatchResponse {
    let url = match args.get("url").and_then(|v| v.as_str()) {
        Some(u) => u,
        None => return error_response("Missing 'url' argument"),
    };

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .unwrap();

    match client.get(url).send().await {
        Ok(resp) => {
            let json_val: Value = resp.json().await.unwrap_or(json!({}));
            ToolDispatchResponse {
                success: true,
                result: Some(json_val),
                error: None,
            }
        }
        Err(e) => error_response(&format!("Failed to fetch JSON: {}", e)),
    }
}

fn error_response(msg: &str) -> ToolDispatchResponse {
    ToolDispatchResponse {
        success: false,
        result: None,
        error: Some(msg.into()),
    }
}
