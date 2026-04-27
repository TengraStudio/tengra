use crate::proxy::server::AppState;
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
use std::sync::Arc;

pub async fn handle_action(
    state: Arc<AppState>,
    action: &str,
    arguments: Value,
) -> ToolDispatchResponse {
    match action {
        "run_command" => run_command(state, arguments).await,
        "list_sessions" => list_sessions(state).await,
        "resize" => resize(state, arguments).await,
        "kill_session" => kill_session(state, arguments).await,
        _ => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Unknown action: {}", action)),
        },
    }
}

async fn run_command(state: Arc<AppState>, arguments: Value) -> ToolDispatchResponse {
    let command = match arguments.get("command").and_then(|v| v.as_str()) {
        Some(c) => c,
        None => {
            return ToolDispatchResponse {
                success: false,
                result: None,
                error: Some("Missing 'command' argument".to_string()),
            }
        }
    };

    let cwd = arguments
        .get("cwd")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let session_id = arguments.get("session_id").and_then(|v| v.as_str());

    let session: Arc<crate::terminal::TerminalSession> = if let Some(id) = session_id {
        if let Some(s) = state.terminal_manager.get_session(id) {
            s
        } else {
            // Session IDs can go stale (app reload / cleanup). Fall back to a fresh session.
            match state.terminal_manager.create_session(cwd, None, None) {
                Ok(new_id) => match state.terminal_manager.get_session(&new_id) {
                    Some(s) => s,
                    None => {
                        return ToolDispatchResponse {
                            success: false,
                            result: None,
                            error: Some("Terminal session not found".to_string()),
                        }
                    }
                },
                Err(e) => {
                    return ToolDispatchResponse {
                        success: false,
                        result: None,
                        error: Some(format!("Failed to create terminal session: {}", e)),
                    }
                }
            }
        }
    } else {
        match state.terminal_manager.create_session(cwd, None, None) {
            Ok(id) => match state.terminal_manager.get_session(&id) {
                Some(s) => s,
                None => {
                    return ToolDispatchResponse {
                        success: false,
                        result: None,
                        error: Some("Terminal session not found".to_string()),
                    }
                }
            },
            Err(e) => {
                return ToolDispatchResponse {
                    success: false,
                    result: None,
                    error: Some(format!("Failed to create terminal session: {}", e)),
                }
            }
        }
    };

    let mut rx = session.tx.subscribe();

    // We write the command to the PTY
    let full_command = format!("{}\n", command);
    if let Err(e) = session.write(full_command.as_bytes()) {
        return ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Failed to write to terminal: {}", e)),
        };
    }

    // Capture a short initial burst of output for the LLM/UI.
    // Some commands need a bit more than 1s to flush output on Windows.
    let mut output_bytes = Vec::new();
    let timeout = tokio::time::sleep(std::time::Duration::from_millis(1500));
    tokio::pin!(timeout);

    loop {
        tokio::select! {
            res = rx.recv() => {
                match res {
                    Ok(data) => {
                        output_bytes.extend_from_slice(&data);
                        if output_bytes.len() > 5000 { break; }
                    }
                    Err(_) => break,
                }
            }
            _ = &mut timeout => break,
        }
    }

    let output_text = String::from_utf8_lossy(&output_bytes).to_string();

    ToolDispatchResponse {
        success: true,
        result: Some(json!({
            "session_id": session.id,
            "output": output_text,
            "message": "Command executed. Terminal session is persistent."
        })),
        error: None,
    }
}

async fn list_sessions(state: Arc<AppState>) -> ToolDispatchResponse {
    let sessions = state.terminal_manager.list_sessions();
    ToolDispatchResponse {
        success: true,
        result: Some(json!(sessions)),
        error: None,
    }
}

async fn resize(state: Arc<AppState>, arguments: Value) -> ToolDispatchResponse {
    let session_id = match arguments.get("session_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => {
            return ToolDispatchResponse {
                success: false,
                result: None,
                error: Some("Missing 'session_id' argument".to_string()),
            }
        }
    };

    let rows = arguments.get("rows").and_then(|v| v.as_u64()).unwrap_or(24) as u16;
    let cols = arguments.get("cols").and_then(|v| v.as_u64()).unwrap_or(80) as u16;

    let session: Arc<crate::terminal::TerminalSession> =
        match state.terminal_manager.get_session(session_id) {
            Some(s) => s,
            None => {
                return ToolDispatchResponse {
                    success: false,
                    result: None,
                    error: Some("Terminal session not found".to_string()),
                }
            }
        };

    match session.resize(rows, cols) {
        Ok(_) => ToolDispatchResponse {
            success: true,
            result: Some(json!({ "message": "Terminal resized" })),
            error: None,
        },
        Err(e) => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Failed to resize terminal: {}", e)),
        },
    }
}

async fn kill_session(state: Arc<AppState>, arguments: Value) -> ToolDispatchResponse {
    let session_id = match arguments.get("session_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => {
            return ToolDispatchResponse {
                success: false,
                result: None,
                error: Some("Missing 'session_id' argument".to_string()),
            }
        }
    };

    state.terminal_manager.remove_session(session_id);

    ToolDispatchResponse {
        success: true,
        result: Some(json!({ "message": format!("Session {} killed", session_id) })),
        error: None,
    }
}
