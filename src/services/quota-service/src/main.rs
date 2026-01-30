// Hide console window on Windows (prevents conhost.exe)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use axum::{
    routing::post,
    Json, Router,
    extract::State,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::error::Error;
use std::net::SocketAddr;
use std::sync::Arc;
use reqwest::Client;
use std::fs;
use tokio::net::TcpListener;

#[derive(Deserialize)]
struct QuotaRequest {
    provider: String,
    #[allow(dead_code)]
    api_key: String,
    session_token: Option<String>,
}

#[derive(Serialize, Clone)]
struct ModelQuota {
    id: String,
    name: String,
    remaining_fraction: f64,
    remaining_quota: Option<f64>,
    total_quota: Option<f64>,
    reset_time: Option<String>,
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
    models: Option<Vec<ModelQuota>>,
    error: Option<String>,
}

struct AppState {
    client: Client,
}

#[tokio::main]
async fn main() {
    if let Err(e) = run().await {
        eprintln!("Quota service fatal error: {}", e);
        std::process::exit(1);
    }
}

async fn run() -> Result<(), Box<dyn Error>> {
    let state = Arc::new(AppState {
        client: Client::new(),
    });

    let app = Router::new()
        .route("/quota", post(get_quota))
        .layer(tower_http::cors::CorsLayer::permissive())
        .with_state(state);

    // Bind to ephemeral port
    let addr = SocketAddr::from(([127, 0, 0, 1], 0));
    let listener = match TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Failed to bind to port: {}", e);
            return Err(e.into());
        }
    };
    
    let local_addr = listener.local_addr()?;
    let port = local_addr.port();

    println!("Quota service listening on {}", local_addr);

    // Port Discovery
    if let Ok(appdata) = std::env::var("APPDATA") {
        let services_dir = std::path::Path::new(&appdata).join("Tandem").join("services");
        if let Err(e) = fs::create_dir_all(&services_dir) {
            eprintln!("Failed to create services directory: {}", e);
            return Err(e.into());
        }
        let port_file = services_dir.join("quota-service.port");
        if let Err(e) = fs::write(&port_file, port.to_string()) {
            eprintln!("Failed to write port file {}: {}", port_file.display(), e);
            return Err(e.into());
        }
    } else {
        eprintln!("APPDATA environment variable not found");
    }

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("Server error: {}", e);
        return Err(e.into());
    }

    Ok(())
}

async fn get_quota(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<QuotaRequest>,
) -> Json<Response> {
    println!("Received quota request for provider: {}", payload.provider);
    
    // Mask sensitive logs
    if let Some(token) = &payload.session_token {
        println!("With Session Token: {}...", token.chars().take(5).collect::<String>());
    }

    if payload.provider == "antigravity" {
        if let Some(token) = payload.session_token {
            let client = &state.client;
            let url = "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels";

            let res = client
                .post(url)
                .bearer_auth(token)
                .header("User-Agent", "antigravity/1.104.0 darwin/arm64")
                .header("Content-Type", "application/json")
                .body("{}")
                .send()
                .await;

            match res {
                Ok(response) => {
                    if response.status().is_success() {
                        let body = response.text().await.unwrap_or_default();
                        println!("Antigravity API response received ({} bytes)", body.len());
                        println!("Antigravity API raw response: {}", body);

                        // Parse the response to extract model quota information
                        match serde_json::from_str::<Value>(&body) {
                            Ok(json) => {
                                let mut models_quota: Vec<ModelQuota> = Vec::new();
                                let mut total_remaining = 0.0;
                                let mut total_quota_sum = 0.0;
                                let mut earliest_reset: Option<String> = None;

                                if let Some(models) = json.get("models").and_then(|m| m.as_object()) {
                                    for (model_id, model_data) in models {
                                        let display_name = model_data.get("displayName")
                                            .and_then(|n| n.as_str())
                                            .unwrap_or(model_id)
                                            .to_string();

                                        let mut remaining_fraction = 1.0;
                                        let mut remaining_quota: Option<f64> = None;
                                        let mut total_quota: Option<f64> = None;
                                        let mut reset_time: Option<String> = None;

                                        if let Some(quota_info) = model_data.get("quotaInfo") {
                                            if let Some(rf) = quota_info.get("remainingFraction").and_then(|v| v.as_f64()) {
                                                remaining_fraction = rf;
                                            }
                                            if let Some(rq) = quota_info.get("remainingQuota").and_then(|v| v.as_f64()) {
                                                remaining_quota = Some(rq);
                                            }
                                            if let Some(tq) = quota_info.get("totalQuota").and_then(|v| v.as_f64()) {
                                                total_quota = Some(tq);
                                            }
                                            if let Some(rt) = quota_info.get("resetTime").and_then(|v| v.as_str()) {
                                                reset_time = Some(rt.to_string());
                                                if earliest_reset.is_none() || reset_time.as_ref() < earliest_reset.as_ref() {
                                                    earliest_reset = reset_time.clone();
                                                }
                                            }
                                        }

                                        // Aggregate totals (use first model with quota as reference)
                                        if let (Some(rq), Some(tq)) = (remaining_quota, total_quota) {
                                            if total_quota_sum == 0.0 {
                                                total_remaining = rq;
                                                total_quota_sum = tq;
                                            }
                                        }

                                        models_quota.push(ModelQuota {
                                            id: model_id.clone(),
                                            name: display_name,
                                            remaining_fraction,
                                            remaining_quota,
                                            total_quota,
                                            reset_time,
                                        });
                                    }
                                }

                                println!("Parsed {} models with quota info", models_quota.len());

                                // Use aggregated quota or default to 100%
                                let (remaining, total) = if total_quota_sum > 0.0 {
                                    (total_remaining, total_quota_sum)
                                } else if !models_quota.is_empty() {
                                    // Use average remaining_fraction if no numeric quota
                                    let avg_fraction: f64 = models_quota.iter()
                                        .map(|m| m.remaining_fraction)
                                        .sum::<f64>() / models_quota.len() as f64;
                                    (avg_fraction * 100.0, 100.0)
                                } else {
                                    (100.0, 100.0)
                                };

                                Json(Response {
                                    success: true,
                                    quota: Some(QuotaInfo {
                                        remaining,
                                        total,
                                        reset_at: earliest_reset,
                                    }),
                                    models: Some(models_quota),
                                    error: None,
                                })
                            }
                            Err(e) => {
                                eprintln!("Failed to parse Antigravity response: {}", e);
                                Json(Response {
                                    success: false,
                                    quota: None,
                                    models: None,
                                    error: Some(format!("Parse error: {}", e)),
                                })
                            }
                        }
                    } else {
                        let status = response.status();
                        let error_text = response.text().await.unwrap_or_default();
                        eprintln!("Antigravity API failed: {} - {}", status, error_text);
                        Json(Response {
                            success: false,
                            quota: None,
                            models: None,
                            error: Some(format!("API Error {}: {}", status, error_text)),
                        })
                    }
                }
                Err(e) => {
                    eprintln!("Request failed: {}", e);
                    Json(Response {
                        success: false,
                        quota: None,
                        models: None,
                        error: Some(format!("Request failed: {}", e)),
                    })
                }
            }
        } else {
             Json(Response {
                success: false,
                quota: None,
                models: None,
                error: Some("Missing session token for Antigravity".into()),
            })
        }
    } else {
        Json(Response {
            success: false,
            quota: None,
            models: None,
            error: Some("Unknown provider".into()),
        })
    }
}

