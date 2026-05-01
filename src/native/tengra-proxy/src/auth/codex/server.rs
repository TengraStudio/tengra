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
    extract::{Query, State},
    routing::get,
    Router,
};
use serde::Deserialize;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::mpsc;

#[derive(Debug, Deserialize)]
pub struct CallbackParams {
    pub code: String,
    pub state: String,
}

pub struct AuthServerState {
    pub tx: mpsc::Sender<CallbackParams>,
}

pub async fn start_callback_server(
    port: u16,
    tx: mpsc::Sender<CallbackParams>,
) -> anyhow::Result<()> {
    let state = Arc::new(AuthServerState { tx });

    let app = Router::new()
        .route("/auth/callback", get(handle_callback))
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    axum::serve(listener, app).await?;

    Ok(())
}

async fn handle_callback(
    Query(params): Query<CallbackParams>,
    State(state): State<Arc<AuthServerState>>,
) -> axum::response::Html<&'static str> {
    let _ = state.tx.send(params).await;
    crate::auth::common::close_window_html()
}
