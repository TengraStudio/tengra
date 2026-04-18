/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

use reqwest::Client;
use scraper::{Html, Selector};
use serde_json::{json, Value};
use crate::tools::ToolDispatchResponse;
use url::Url;
use std::collections::HashSet;

pub async fn handle_action(action: &str, arguments: Value) -> ToolDispatchResponse {
    match action {
        "crawl" => crawl_site(arguments).await,
        _ => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Unknown crawler action: {}", action)),
        },
    }
}

async fn crawl_site(arguments: Value) -> ToolDispatchResponse {
    let url_str = match arguments.get("url").and_then(|v| v.as_str()) {
        Some(u) => u,
        None => return ToolDispatchResponse { success: false, result: None, error: Some("Missing 'url' argument".to_string()) },
    };

    let max_pages = arguments.get("max_pages").and_then(|v| v.as_u64()).unwrap_or(5) as usize;
    let max_depth = arguments.get("max_depth").and_then(|v| v.as_u64()).unwrap_or(2) as usize;
    
    let client = Client::builder()
        .user_agent("TengraProxy/0.1.0")
        .build()
        .unwrap();

    let root_url = match Url::parse(url_str) {
        Ok(u) => u,
        Err(e) => return ToolDispatchResponse { success: false, result: None, error: Some(format!("Invalid URL: {}", e)) },
    };

    let mut visited = HashSet::new();
    let mut queue = vec![(root_url.clone(), 0)];
    let mut results = Vec::new();

    while let Some((current_url, depth)) = queue.pop() {
        if visited.contains(&current_url) || visited.len() >= max_pages || depth > max_depth {
            continue;
        }
        visited.insert(current_url.clone());

        match client.get(current_url.clone()).send().await {
            Ok(resp) => {
                if !resp.status().is_success() { continue; }
                
                let html_text = resp.text().await.unwrap_or_default();
                let document = Html::parse_document(&html_text);
                
                // Extract meaningful text - skip scripts, styles, nav
                let mut clean_text = String::new();
                let main_selector = Selector::parse("main, article, .content, #content, body").unwrap();
                
                if let Some(content) = document.select(&main_selector).next() {
                    for node in content.text() {
                        let trimmed = node.trim();
                        if !trimmed.is_empty() {
                            clean_text.push_str(trimmed);
                            clean_text.push('\n');
                        }
                    }
                }

                results.push(json!({
                    "url": current_url.as_str(),
                    "title": document.select(&Selector::parse("title").unwrap()).next().map(|n| n.inner_html()).unwrap_or_default(),
                    "content": clean_text.chars().take(5000).collect::<String>(),
                }));

                // Find internal links for next depth
                if depth < max_depth {
                    let link_selector = Selector::parse("a[href]").unwrap();
                    for element in document.select(&link_selector) {
                        if let Some(href) = element.value().attr("href") {
                            if let Ok(mut new_url) = root_url.join(href) {
                                new_url.set_fragment(None); // remove fragments
                                if new_url.host_str() == root_url.host_str() && !visited.contains(&new_url) {
                                    queue.insert(0, (new_url, depth + 1));
                                }
                            }
                        }
                    }
                }
            }
            Err(_) => continue,
        }
    }

    ToolDispatchResponse {
        success: true,
        result: Some(json!({
            "pages_crawled": visited.len(),
            "data": results
        })),
        error: None,
    }
}
