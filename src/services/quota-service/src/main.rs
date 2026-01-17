// Hide console window on Windows (prevents conhost.exe)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use axum::{
    routing::post,
    Json, Router,
    extract::State,
};
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::net::SocketAddr;
use std::sync::Arc;
use reqwest::Client;
use std::fs;
use tokio::net::TcpListener;

#[derive(Deserialize)]
struct QuotaRequest {
    provider: String,
    api_key: String,
    session_token: Option<String>,
}

#[derive(Serialize)]
struct QuotaInfo {
    remaining: f64,
    total: f64,
    reset_at: Option<String>,
}

#[derive(Serialize)]
struct Response {
    success: bool,
    quota: Option<QuotaInfo>,
    error: Option<String>,
}

struct AppState {
    _client: Client,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let state = Arc::new(AppState {
        _client: Client::new(),
    });

    let app = Router::new()
        .route("/quota", post(get_quota))
        .with_state(state);

    // Bind to ephemeral port
    let addr = SocketAddr::from(([127, 0, 0, 1], 0));
    let listener = TcpListener::bind(addr).await?;
    let local_addr = listener.local_addr()?;
    let port = local_addr.port();

    println!("Quota service listening on {}", local_addr);

    // Port Discovery
    if let Ok(appdata) = std::env::var("APPDATA") {
        let services_dir = std::path::Path::new(&appdata).join("Orbit").join("services");
        fs::create_dir_all(&services_dir)?;
        let port_file = services_dir.join("quota-service.port");
        fs::write(port_file, port.to_string())?;
    }

    axum::serve(listener, app).await?;

    Ok(())
}

async fn get_quota(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<QuotaRequest>,
) -> Json<Response> {
    println!("Received quota request for provider: {}", payload.provider);
    println!("Using API Key: {}...", payload.api_key.chars().take(5).collect::<String>());
    if let Some(token) = &payload.session_token {
        println!("With Session Token: {}...", token.chars().take(5).collect::<String>());
    }

    if payload.provider == "antigravity" {
        // Mock for now
        Json(Response {
            success: true,
            quota: Some(QuotaInfo {
                remaining: 50.0,
                total: 100.0,
                reset_at: None,
            }),
            error: None,
        })
    } else {
        Json(Response {
            success: false,
            quota: None,
            error: Some("Unknown provider".into()),
        })
    }
}
