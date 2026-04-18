pub mod ast;
pub mod conflict_resolver;
/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
pub mod lsp_manager;

use crate::proxy::server::AppState;
use crate::tools::ToolDispatchResponse;
use serde_json::{json, Value};
use std::sync::Arc;

pub async fn handle_action(
    state: Arc<AppState>,
    action: &str,
    arguments: Value,
) -> ToolDispatchResponse {
    match action {
        "lsp_definition" => lsp_definition(state, arguments).await,
        "get_symbols" => get_symbols(arguments).await,
        "analyze_conflicts" => analyze_conflicts(arguments).await,
        _ => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Unknown analysis action: {}", action)),
        },
    }
}

async fn lsp_definition(state: Arc<AppState>, arguments: Value) -> ToolDispatchResponse {
    let lang = arguments
        .get("language")
        .and_then(|v| v.as_str())
        .unwrap_or("rust");
    let path = arguments.get("path").and_then(|v| v.as_str()).unwrap_or("");
    let line = arguments.get("line").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
    let col = arguments
        .get("column")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as usize;

    let client: Arc<lsp_manager::LspClient> =
        match state.lsp_manager.get_or_start_client(lang, ".").await {
            Ok(c) => c,
            Err(e) => {
                return ToolDispatchResponse {
                    success: false,
                    result: None,
                    error: Some(e),
                }
            }
        };

    let result = client
        .request(
            "textDocument/definition",
            json!({
                "textDocument": { "uri": format!("file://{}", path) },
                "position": { "line": line, "character": col }
            }),
        )
        .await;

    match result {
        Ok(res) => ToolDispatchResponse {
            success: true,
            result: Some(res),
            error: None,
        },
        Err(e) => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(e),
        },
    }
}

async fn get_symbols(arguments: Value) -> ToolDispatchResponse {
    let source = arguments
        .get("source")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let lang = arguments
        .get("language")
        .and_then(|v| v.as_str())
        .unwrap_or("rust");

    let mut analyzer = ast::AstAnalyzer::new();
    match analyzer.get_symbols(source, lang) {
        Ok(symbols) => ToolDispatchResponse {
            success: true,
            result: Some(json!(symbols)),
            error: None,
        },
        Err(e) => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(e),
        },
    }
}

async fn analyze_conflicts(arguments: Value) -> ToolDispatchResponse {
    let source = arguments
        .get("source")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let lang = arguments
        .get("language")
        .and_then(|v| v.as_str())
        .unwrap_or("rust");

    let mut resolver = conflict_resolver::ConflictResolver::new();
    match resolver.analyze(source, lang) {
        Ok(analysis) => ToolDispatchResponse {
            success: true,
            result: Some(json!(analysis)),
            error: None,
        },
        Err(e) => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(e),
        },
    }
}
