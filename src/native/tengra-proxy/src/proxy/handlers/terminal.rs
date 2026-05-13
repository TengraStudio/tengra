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
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::IntoResponse,
    Json,
};
use futures::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Deserialize)]
pub struct CreateTerminalRequest {
    pub cwd: Option<String>,
    pub shell: Option<String>,
    pub args: Option<Vec<String>>,
}

#[derive(Serialize)]
pub struct CreateTerminalResponse {
    pub id: String,
}

#[derive(Deserialize)]
pub struct ResizeTerminalRequest {
    pub rows: u16,
    pub cols: u16,
}

pub async fn create_terminal(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateTerminalRequest>,
) -> impl IntoResponse {
    match state
        .terminal_manager
        .create_session(payload.cwd, payload.shell, payload.args)
    {
        Ok(id) => (
            axum::http::StatusCode::CREATED,
            Json(CreateTerminalResponse { id }),
        )
            .into_response(),
        Err(e) => {
            let body = Json(serde_json::json!({ "error": e.to_string() }));
            (axum::http::StatusCode::INTERNAL_SERVER_ERROR, body).into_response()
        }
    }
}

pub async fn resize_terminal(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(payload): Json<ResizeTerminalRequest>,
) -> impl IntoResponse {
    match state.terminal_manager.get_session(&session_id) {
        Some(session) => match session.resize(payload.rows, payload.cols) {
            Ok(_) => axum::http::StatusCode::OK.into_response(),
            Err(e) => {
                let body = Json(serde_json::json!({ "error": e.to_string() }));
                (axum::http::StatusCode::INTERNAL_SERVER_ERROR, body).into_response()
            }
        },
        None => axum::http::StatusCode::NOT_FOUND.into_response(),
    }
}

pub async fn delete_terminal(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    state.terminal_manager.remove_session(&session_id);
    axum::http::StatusCode::OK
}

pub async fn list_terminals(State(state): State<Arc<AppState>>) -> Json<Vec<String>> {
    Json(state.terminal_manager.list_sessions())
}

pub async fn terminal_ws_handler(
    ws: WebSocketUpgrade,
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, session_id, state))
}

async fn handle_socket(socket: WebSocket, session_id: String, state: Arc<AppState>) {
    let session = match state.terminal_manager.get_session(&session_id) {
        Some(s) => s,
        None => return,
    };

    let (mut sink, mut stream) = socket.split();
    let mut terminal_rx = session.tx.subscribe();

    // Task to read from terminal sessions broadcaster and send to WebSocket
    let mut send_task = tokio::spawn(async move {
        while let Ok(data) = terminal_rx.recv().await {
            if sink.send(Message::Binary(data)).await.is_err() {
                break;
            }
        }
    });

    // Task to read from WebSocket and write to terminal master PTY
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = stream.next().await {
            match msg {
                Message::Text(t) => {
                    let _ = session.write(t.as_bytes());
                }
                Message::Binary(b) => {
                    let _ = session.write(&b);
                }
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };
}
