/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::auth::claude::types::ClaudeAuthQuery;
use crate::auth::common::close_window_html;
use axum::{
    extract::{Query, State},
    routing::get,
    Router,
};
use std::net::SocketAddr;
use tokio::sync::mpsc;

pub async fn start_callback_server(
    port: u16,
    tx: mpsc::Sender<ClaudeAuthQuery>,
) -> anyhow::Result<()> {
    let app = Router::new()
        .route("/callback", get(handle_callback))
        .with_state(tx);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    eprintln!("[LOG] Claude callback server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn handle_callback(
    Query(params): Query<ClaudeAuthQuery>,
    State(tx): State<mpsc::Sender<ClaudeAuthQuery>>,
) -> axum::response::Html<&'static str> {
    let _ = tx.send(params).await;
    close_window_html()
}
