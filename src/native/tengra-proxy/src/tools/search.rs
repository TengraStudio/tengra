/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

use grep::regex::RegexMatcher;
use grep::searcher::{BinaryDetection, SearcherBuilder};
use grep::searcher::sinks::Lossy;
use ignore::WalkBuilder;
use serde_json::{json, Value};
use crate::tools::ToolDispatchResponse;

pub async fn handle_action(action: &str, arguments: Value) -> ToolDispatchResponse {
    match action {
        "grep" => grep_search(arguments).await,
        _ => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Unknown search action: {}", action)),
        },
    }
}

async fn grep_search(arguments: Value) -> ToolDispatchResponse {
    let query = match arguments.get("query").and_then(|v| v.as_str()) {
        Some(q) => q,
        None => return ToolDispatchResponse {
            success: false,
            result: None,
            error: Some("Missing 'query' argument".to_string()),
        },
    };

    let path = arguments.get("path").and_then(|v| v.as_str()).unwrap_or(".");
    
    let matcher = match RegexMatcher::new(query) {
        Ok(m) => m,
        Err(e) => return ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Invalid regex: {}", e)),
        },
    };

    let mut results = Vec::new();
    let mut searcher = SearcherBuilder::new()
        .binary_detection(BinaryDetection::quit(b'\x00'))
        .build();

    for result in WalkBuilder::new(path).build() {
        let entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };
        if !entry.file_type().map_or(false, |ft| ft.is_file()) {
            continue;
        }

        let path = entry.path().to_path_buf();
        let _ = searcher.search_path(
            &matcher,
            &path,
            Lossy(|line_num, line| {
                results.push(json!({
                    "file": path.to_string_lossy(),
                    "line": line_num,
                    "content": line.trim(),
                }));
                Ok(true)
            }),
        );

        if results.len() > 100 { break; } // limit results
    }

    ToolDispatchResponse {
        success: true,
        result: Some(json!(results)),
        error: None,
    }
}
