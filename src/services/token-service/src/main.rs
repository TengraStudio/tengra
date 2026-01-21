// Force Windows subsystem to prevent console window
#![cfg_attr(windows, windows_subsystem = "windows")]

use axum::{
    routing::{get, post},
    Json, Router,
    extract::State,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use reqwest::Client;
use std::fs::{self, OpenOptions};
use std::io::Write;
use tokio::net::TcpListener;
use std::path::{Path, PathBuf};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

// --- Data Structures ---

#[derive(Serialize, Deserialize, Debug, Clone)]
struct AuthToken {
    id: String,
    provider: String,
    refresh_token: Option<String>,
    access_token: Option<String>,
    expires_at: Option<i64>,
    scope: Option<String>,
    email: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct MonitoredToken {
    token: AuthToken,
    client_id: String,
    client_secret: Option<String>,
    updated_at: i64,
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
    // ID -> MonitoredToken
    tokens: Arc<RwLock<HashMap<String, MonitoredToken>>>,
    store_path: PathBuf,
}

// --- Main ---

#[tokio::main]
async fn main() {
    setup_logging();
    log("Token service starting...");

    if let Err(e) = run().await {
        log(&format!("Token service fatal error: {}", e));
        std::process::exit(1);
    }
}

async fn run() -> Result<(), Box<dyn Error>> {
    let app_data = get_app_data_dir()?;
    let services_dir = app_data.join("services");
    fs::create_dir_all(&services_dir)?;

    let store_path = services_dir.join("tokens.store.json");
    
    // Load existing state
    let tokens = load_state(&store_path).unwrap_or_default();
    log(&format!("Loaded {} tokens from store", tokens.len()));

    let tokens = Arc::new(RwLock::new(tokens));
    let client = Client::new();

    let state = Arc::new(AppState {
        client: client.clone(),
        tokens: tokens.clone(),
        store_path: store_path.clone(),
    });

    // Start background refresh loop
    let loop_state = state.clone();
    tokio::spawn(async move {
        background_refresh_loop(loop_state).await;
    });

    let app = Router::new()
        .route("/refresh", post(handle_refresh)) // Legacy/Direct refresh
        .route("/monitor", post(handle_monitor)) // Register for background monitoring
        .route("/sync", get(handle_sync))       // New: Sync tokens from memory
        .layer(tower_http::cors::CorsLayer::permissive())
        .with_state(state);

    // Bind to ephemeral port
    let addr = SocketAddr::from(([127, 0, 0, 1], 0));
    let listener = match TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            log(&format!("Failed to bind to port: {}", e));
            return Err(e.into());
        }
    };
    
    let local_addr = listener.local_addr()?;
    let port = local_addr.port();

    log(&format!("Token service listening on {}", local_addr));

    // Write port file
    let port_file = services_dir.join("token-service.port");
    if let Err(e) = fs::write(&port_file, port.to_string()) {
        log(&format!("Failed to write port file {}: {}", port_file.display(), e));
        return Err(e.into());
    }

    if let Err(e) = axum::serve(listener, app).await {
        log(&format!("Server error: {}", e));
        return Err(e.into());
    }

    Ok(())
}

// --- Handlers ---

async fn handle_refresh(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RefreshRequest>,
) -> Json<Response> {
    // Direct refresh request (legacy behavior + immediate need)
    let response = execute_refresh(&state.client, payload.token, payload.client_id, payload.client_secret).await;
    Json(response)
}

async fn handle_monitor(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RefreshRequest>,
) -> Json<Response> {
    let mut tokens = state.tokens.write().await;
    
    let monitored = MonitoredToken {
        token: payload.token.clone(),
        client_id: payload.client_id,
        client_secret: payload.client_secret,
        updated_at: chrono::Utc::now().timestamp_millis(),
    };

    tokens.insert(payload.token.id.clone(), monitored);
    
    // Save immediately
    if let Err(e) = save_state(&state.store_path, &tokens) {
        log(&format!("Failed to save state: {}", e));
    }

    // Return success with current token data
    Json(Response {
        success: true, 
        token: Some(payload.token), 
        error: None 
    })
}

async fn handle_sync(
    State(state): State<Arc<AppState>>,
) -> Json<HashMap<String, MonitoredToken>> {
    let tokens = state.tokens.read().await;
    Json(tokens.clone())
}


// --- Logic ---

async fn background_refresh_loop(state: Arc<AppState>) {
    log("Background refresh loop started");
    loop {
        // Sleep first or last? Sleep first to avoid tight loop on error
        tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;

        let mut tokens_to_refresh = Vec::new();
        
        // 1. Identify tokens needing refresh (read lock)
        {
            let tokens = state.tokens.read().await;
            let now = chrono::Utc::now().timestamp_millis();
            let threshold_ms = 30 * 60 * 1000; // 30 minutes

            for (id, m_token) in tokens.iter() {
                if let Some(expires_at) = m_token.token.expires_at {
                    let ttl = expires_at - now;
                    // Refresh if expiring within threshold or already expired
                    if ttl < threshold_ms {
                        tokens_to_refresh.push(id.clone());
                    }
                }
            }
        }

        if tokens_to_refresh.is_empty() {
            continue;
        }

        log(&format!("Checking {} tokens for refresh...", tokens_to_refresh.len()));

        // 2. Refresh tokens
        let mut changes_made = false;
        for id in tokens_to_refresh {
            let (client_id, client_secret, token) = {
                let tokens = state.tokens.read().await;
                if let Some(t) = tokens.get(&id) {
                    (t.client_id.clone(), t.client_secret.clone(), t.token.clone())
                } else {
                    continue;
                }
            };

            log(&format!("Refreshing token for {}", id));
            let response = execute_refresh(&state.client, token, client_id.clone(), client_secret.clone()).await;

            if response.success {
                if let Some(new_token) = response.token {
                    let mut tokens = state.tokens.write().await;
                    if let Some(m_token) = tokens.get_mut(&id) {
                        m_token.token = new_token;
                        m_token.updated_at = chrono::Utc::now().timestamp_millis();
                        changes_made = true;
                        log(&format!("Successfully refreshed token for {}", id));
                    }
                }
            } else {
                log(&format!("Failed to refresh {}: {:?}", id, response.error));
            }
        }

        // 3. Save state if changed
        if changes_made {
            let tokens = state.tokens.read().await;
            if let Err(e) = save_state(&state.store_path, &tokens) {
                log(&format!("Failed to save state during background loop: {}", e));
            }
        }
    }
}

async fn execute_refresh(
    client: &Client, 
    mut token: AuthToken, 
    client_id: String, 
    client_secret: Option<String>
) -> Response {
    let refresh_token_str = match &token.refresh_token {
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
    params.insert("refresh_token", refresh_token_str.clone());
    
    if let Some(secret) = client_secret {
        params.insert("client_secret", secret);
    }

    // Add required headers for Claude
    let mut request_builder = client.post(url)
        .header("Accept", "application/json");

    if token.provider.contains("claude") || token.provider.contains("anthropic") {
        log(&format!("Refreshing Claude token at {} with browser User-Agent", url));
        request_builder = request_builder
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .header("Content-Type", "application/json")
            .json(&params); // Use JSON for Claude
    } else {
        request_builder = request_builder.form(&params); // Use Form for others (Google, etc)
    }

    let res = match request_builder.send().await {
        Ok(r) => r,
        Err(e) => return Response { success: false, token: None, error: Some(e.to_string()) }
    };

    if !res.status().is_success() {
        let status = res.status();
        let error_body = res.text().await.unwrap_or_default();
        log(&format!("Token refresh failed for {} with status {}. Body: {}", token.provider, status, error_body));
        return Response { success: false, token: None, error: Some(format!("HTTP {} - {}", status, error_body)) };
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

// --- Persistence ---

fn load_state(path: &Path) -> Result<HashMap<String, MonitoredToken>, Box<dyn Error>> {
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let content = fs::read_to_string(path)?;
    // Try to decode base64, fallback to plain json for backward compatibility
    let json_content = match BASE64.decode(content.trim()) {
        Ok(decoded) => String::from_utf8(decoded)?,
        Err(_) => content, // Assume legacy plain JSON
    };
    
    let tokens: HashMap<String, MonitoredToken> = serde_json::from_str(&json_content)?;
    Ok(tokens)
}

fn save_state(path: &Path, tokens: &HashMap<String, MonitoredToken>) -> Result<(), Box<dyn Error>> {
    let json_content = serde_json::to_string(tokens)?;
    let encoded = BASE64.encode(json_content);
    fs::write(path, encoded)?;
    Ok(())
}

// --- Utils ---

fn get_app_data_dir() -> Result<PathBuf, Box<dyn Error>> {
    if let Ok(appdata) = std::env::var("APPDATA") {
        Ok(Path::new(&appdata).join("Orbit"))
    } else {
        Err("APPDATA not found".into())
    }
}

fn log(msg: &str) {
    if let Ok(dir) = get_app_data_dir() {
        let log_file = dir.join("services").join("token-service.log");
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
        let line = format!("[{}] {}\n", timestamp, msg);
        // Best effort logging
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_file) {
            let _ = file.write_all(line.as_bytes());
        }
    }
    // Also print to stdout/stderr (will be eaten by windows subsystem if no console, but good for debug runs)
    println!("{}", msg);
}

fn setup_logging() {
    // Basic panic hook to log panics
    std::panic::set_hook(Box::new(|info| {
        let msg = match info.payload().downcast_ref::<&str>() {
            Some(s) => *s,
            None => match info.payload().downcast_ref::<String>() {
                Some(s) => &s[..],
                None => "Box<Any>",
            },
        };
        log(&format!("PANIC: {}", msg));
    }));
}
