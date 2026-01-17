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

#[derive(Serialize, Deserialize, Debug, Clone)]
struct AuthToken {
    id: String,
    provider: String,
    refresh_token: Option<String>,
    access_token: Option<String>,
    expires_at: Option<i64>,
}

#[derive(Deserialize)]
struct RefreshRequest {
    token: AuthToken,
    client_id: String,
    client_secret: Option<String>,
}

#[derive(Serialize)]
struct Response {
    success: bool,
    token: Option<AuthToken>,
    error: Option<String>,
}

struct AppState {
    client: Client,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let state = Arc::new(AppState {
        client: Client::new(),
    });

    let app = Router::new()
        .route("/refresh", post(handle_refresh))
        .with_state(state);

    // Bind to ephemeral port
    let addr = SocketAddr::from(([127, 0, 0, 1], 0));
    let listener = TcpListener::bind(addr).await?;
    let local_addr = listener.local_addr()?;
    let port = local_addr.port();

    println!("Token service listening on {}", local_addr);

    // Port Discovery
    if let Ok(appdata) = std::env::var("APPDATA") {
        let services_dir = std::path::Path::new(&appdata).join("Orbit").join("services");
        fs::create_dir_all(&services_dir)?;
        let port_file = services_dir.join("token-service.port");
        fs::write(port_file, port.to_string())?;
    }

    axum::serve(listener, app).await?;

    Ok(())
}

async fn handle_refresh(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RefreshRequest>,
) -> Json<Response> {
    let response = refresh_token(&state.client, payload.token, payload.client_id, payload.client_secret).await;
    Json(response)
}

async fn refresh_token(
    client: &Client, 
    mut token: AuthToken, 
    client_id: String, 
    client_secret: Option<String>
) -> Response {
    let refresh_token = match &token.refresh_token {
        Some(rt) => rt,
        None => return Response { success: false, token: None, error: Some("No refresh token".into()) }
    };

    let url = if token.provider.contains("google") || token.provider.contains("antigravity") {
        "https://oauth2.googleapis.com/token"
    } else if token.provider.contains("codex") || token.provider.contains("openai") {
        "https://auth.openai.com/oauth/token"
    } else if token.provider.contains("claude") || token.provider.contains("anthropic") {
        "https://console.anthropic.com/v1/oauth/token"
    } else {
        return Response { success: false, token: None, error: Some("Unknown provider".into()) }
    };

    let mut params = std::collections::HashMap::new();
    params.insert("client_id", client_id);
    params.insert("grant_type", "refresh_token".to_string());
    params.insert("refresh_token", refresh_token.clone());
    
    if let Some(secret) = client_secret {
        params.insert("client_secret", secret);
    }

    let res = match client.post(url).form(&params).send().await {
        Ok(r) => r,
        Err(e) => return Response { success: false, token: None, error: Some(e.to_string()) }
    };

    if !res.status().is_success() {
        return Response { success: false, token: None, error: Some(format!("HTTP {}", res.status())) };
    }

    #[derive(Deserialize)]
    struct OAuthResponse {
        access_token: String,
        expires_in: i64,
        refresh_token: Option<String>,
    }

    match res.json::<OAuthResponse>().await {
        Ok(data) => {
            token.access_token = Some(data.access_token);
            if let Some(new_rt) = data.refresh_token {
                token.refresh_token = Some(new_rt);
            }
            token.expires_at = Some(chrono::Utc::now().timestamp_millis() + (data.expires_in * 1000));
            
            Response { success: true, token: Some(token), error: None }
        },
        Err(e) => Response { success: false, token: None, error: Some(format!("Parse error: {}", e)) }
    }
}
