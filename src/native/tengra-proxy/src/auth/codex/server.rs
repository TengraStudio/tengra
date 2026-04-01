use axum::{
    extract::{Query, State},
    routing::get,
    Router,
};
use serde::Deserialize;
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

    let addr = format!("127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    println!("OAuth callback server listening on {}", addr);
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
