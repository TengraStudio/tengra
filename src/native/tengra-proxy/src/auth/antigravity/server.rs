use crate::auth::antigravity::types::AuthQuery;
use axum::{
    extract::{Query, State},
    routing::get,
    Router,
};
use std::net::SocketAddr;
use tokio::sync::mpsc;

pub async fn start_callback_server(port: u16, tx: mpsc::Sender<AuthQuery>) -> anyhow::Result<()> {
    let app = Router::new()
        .route("/oauth-callback", get(handle_callback))
        .with_state(tx);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    eprintln!("[LOG] Antigravity callback server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn handle_callback(
    Query(params): Query<AuthQuery>,
    State(tx): State<mpsc::Sender<AuthQuery>>,
) -> axum::response::Html<&'static str> {
    let _ = tx.send(params).await;
    crate::auth::common::close_window_html()
}
