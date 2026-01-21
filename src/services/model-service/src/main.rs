// Hide console window on Windows (prevents conhost.exe)
// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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
struct ModelRequest {
    provider: String,
    token: Option<String>,
    proxy_port: Option<u16>,
    proxy_key: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct Pricing {
    input: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    cached_input: Option<f64>, // Maps to Cache Hits / OpenAI Cached
    #[serde(skip_serializing_if = "Option::is_none")]
    cache_write_5m: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cache_write_1h: Option<f64>,
    output: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct ModelInfo {
    id: String,
    name: String,
    provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    downloads: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    thinking_levels: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pricing: Option<Pricing>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub percentage: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reset: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quota_info: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct Response {
    success: bool,
    models: Vec<ModelInfo>,
    error: Option<String>,
}

struct AppState {
    client: Client,
}

#[tokio::main]
async fn main() {
    if let Err(e) = run().await {
        eprintln!("Model service fatal error: {}", e);
        std::process::exit(1);
    }
}

async fn run() -> Result<(), Box<dyn Error>> {
    let state = Arc::new(AppState {
        client: Client::new(),
    });

    let app = Router::new()
        .route("/fetch", post(fetch_models))
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

    println!("Model service listening on {}", local_addr);

    // Port Discovery
    if let Ok(appdata) = std::env::var("APPDATA") {
        let services_dir = std::path::Path::new(&appdata).join("Orbit").join("services");
        if let Err(e) = fs::create_dir_all(&services_dir) {
            eprintln!("Failed to create services directory: {}", e);
            return Err(e.into());
        }
        let port_file = services_dir.join("model-service.port");
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

async fn fetch_models(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ModelRequest>,
) -> Json<Response> {
    let response = match payload.provider.as_str() {
        "ollama" => fetch_ollama(&state.client).await,
        "huggingface" => fetch_huggingface(&state.client).await,
        "copilot" => fetch_copilot(&state.client, payload.token).await,
        "antigravity" => fetch_antigravity(&state.client, payload.token.clone(), payload.proxy_port, payload.proxy_key).await,
        "codex" => fetch_codex(&state.client, payload.proxy_port, payload.proxy_key).await,
        "claude" => fetch_claude(&state.client, payload.proxy_port, payload.proxy_key).await,
        "opencode" => fetch_opencode(&state.client).await,
        _ => Response { success: false, models: vec![], error: Some("Unknown provider".into()) }
    };
    Json(response)
}

async fn fetch_ollama(client: &Client) -> Response {
    let url = "http://127.0.0.1:11434/api/tags";
    match client.get(url).send().await {
        Ok(res) => {
             if !res.status().is_success() {
                return Response { success: false, models: vec![], error: Some(format!("Ollama HTTP {}", res.status())) };
             }
             
             #[derive(Deserialize)]
             struct OllamaModel { name: String, size: u64 }
             #[derive(Deserialize)]
             struct OllamaResponse { models: Vec<OllamaModel> }

             match res.json::<OllamaResponse>().await {
                 Ok(data) => {
                     let models = data.models.into_iter().map(|m| ModelInfo {
                         id: format!("ollama/{}", m.name),
                         name: m.name,
                         provider: "ollama".into(),
                         description: Some(format!("Size: {:.1}GB", m.size as f64 / 1024.0 / 1024.0 / 1024.0)),
                         downloads: None,
                         pricing: None,
                         thinking_levels: None,
                         percentage: None,
                         reset: None,
                         quota_info: None,
                     }).collect();
                     Response { success: true, models, error: None }
                 },
                 Err(e) => Response { success: false, models: vec![], error: Some(e.to_string()) }
             }
        },
        Err(e) => Response { success: false, models: vec![], error: Some(format!("Failed to connect to Ollama: {}", e)) }
    }
}

async fn fetch_huggingface(client: &Client) -> Response {
    let url = "https://huggingface.co/api/models?filter=gguf&sort=downloads&limit=20";
    match client.get(url).send().await {
        Ok(res) => {
            #[derive(Deserialize)]
            struct HFModel { 
                #[serde(rename = "modelId")]
                model_id: String, 
                downloads: u32, 
                likes: u32 
            }
            
             match res.json::<Vec<HFModel>>().await {
                 Ok(data) => {
                     let models = data.into_iter().map(|m| ModelInfo {
                         id: m.model_id.clone(),
                         name: m.model_id,
                         provider: "huggingface".into(),
                         description: Some(format!("Likes: {}", m.likes)),
                         downloads: Some(m.downloads as u64),
                         pricing: None,
                         thinking_levels: None,
                         percentage: None,
                         reset: None,
                         quota_info: None,
                     }).collect();
                     Response { success: true, models, error: None }
                 },
                 Err(e) => Response { success: false, models: vec![], error: Some(e.to_string()) }
             }
        },
        Err(e) => Response { success: false, models: vec![], error: Some(e.to_string()) }
    }
}

async fn fetch_copilot(client: &Client, token: Option<String>) -> Response {
    let Some(token) = token else {
        return Response { success: false, models: vec![], error: Some("No token provided for Copilot".into()) };
    };

    let url = "https://api.githubcopilot.com/models";
    
    match client.get(url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/json")
        .header("User-Agent", "GithubCopilot/1.155.0")
        .header("Copilot-Integration-Id", "vscode-chat")
        .send().await 
    {
        Ok(res) => {
             if !res.status().is_success() {
                return Response { success: false, models: vec![], error: Some(format!("Copilot HTTP {}", res.status())) };
             }

             #[derive(Deserialize)]
             struct CopilotModelData { id: String, name: Option<String> }
             
             #[derive(Deserialize)]
             struct CopilotResponse { data: Vec<CopilotModelData> }

             match res.json::<CopilotResponse>().await {
                 Ok(data) => {
                     let models = data.data.into_iter().map(|m| ModelInfo {
                         id: m.id.clone(),
                         name: m.name.unwrap_or(m.id),
                         provider: "copilot".into(),
                         description: Some("GitHub Copilot Model".into()),
                         downloads: None,
                         pricing: None,
                         thinking_levels: None,
                         percentage: None,
                         reset: None,
                         quota_info: None,
                     }).collect();
                     Response { success: true, models, error: None }
                 },
                 Err(e) => Response { success: false, models: vec![], error: Some(e.to_string()) }
             }
        },
        Err(e) => Response { success: false, models: vec![], error: Some(e.to_string()) }
    }
}

async fn fetch_antigravity(client: &Client, token: Option<String>, _port: Option<u16>, _key: Option<String>) -> Response {
    // Use token parameter directly (sent from TypeScript auth)
    let Some(auth_token) = token else {
         return Response { success: false, models: vec![], error: Some("No Antigravity token provided (required for dynamic fetch)".into()) };
    };

    // Use the stable endpoint as seen in the Go proxy
    let url = "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels";
    
    let res = client.post(url)
        .header("Authorization", format!("Bearer {}", auth_token))
        .header("Content-Type", "application/json")
        .header("User-Agent", "antigravity/1.104.0 darwin/arm64")
        .body("{}")
        .send()
        .await;

    match res {
        Ok(resp) => {
            if !resp.status().is_success() {
                 let status = resp.status();
                 let error_body = resp.text().await.unwrap_or_else(|_| "Failed to read error body".into());
                 return Response { success: false, models: vec![], error: Some(format!("Antigravity API Error: {} - {}", status, error_body)) };
            }

            #[derive(Deserialize)]
            struct AntigravityModelData {
                #[serde(rename = "displayName")]
                display_name: Option<String>,
                description: Option<String>,
                #[serde(rename = "quotaInfo")]
                quota_info: Option<serde_json::Value>,
            }

            #[derive(Deserialize)]
            struct AntigravityResponse {
                models: std::collections::HashMap<String, AntigravityModelData>,
            }

            match resp.json::<AntigravityResponse>().await {
                Ok(data) => {
                    let mut models: Vec<ModelInfo> = data.models.into_iter()
                        .filter(|(id, _)| {
                            // Global internal model filtering
                            !["chat_23310", "chat_20706", "rev19-uic3-1p", "tab_flash_lite_preview"].contains(&id.as_str())
                        })
                        .map(|(mut id, info)| {
                        // Normalize IDs to match proxy expectations
                        if id == "claude-opus-4-5-thinking" || id == "claude-opus-4.5-thinking" { id = "claude-opus-4-5-thinking".into(); }
                        else if id == "claude-sonnet-4-5-thinking" || id == "claude-4.5-sonnet-thinking" { id = "claude-sonnet-4-5-thinking".into(); }
                        else if id == "claude-opus-4.5" || id == "claude-opus-4-5-20251101" { id = "claude-opus-4-5".into(); }
                        else if id == "claude-sonnet-4.5" || id == "claude-sonnet-4-5-20250929" { id = "claude-sonnet-4-5".into(); }
                        
                        let (thinking_levels, pricing) = get_antigravity_metadata(&id);

                        let mut percentage = None;
                        let mut reset = None;

                        if let Some(ref q) = info.quota_info {
                            if let Some(rf) = q.get("remainingFraction").and_then(|v| v.as_f64()) {
                                percentage = Some((rf * 100.0) as u8);
                            } else if let (Some(rq), Some(tq)) = (q.get("remainingQuota").and_then(|v| v.as_f64()), q.get("totalQuota").and_then(|v| v.as_f64())) {
                                if tq > 0.0 {
                                    percentage = Some(((rq / tq) * 100.0) as u8);
                                }
                            }

                            if let Some(rt) = q.get("resetTime").and_then(|v| v.as_str()) {
                                reset = Some(rt.to_string());
                            }
                        }

                        let mut name = info.display_name.unwrap_or_else(|| id.clone());
                        if id.contains("claude") {
                            name = name.replace("Gemini ", "");
                        }

                        ModelInfo {
                            id: id.clone(),
                            name,
                            provider: "antigravity".into(),
                            description: info.description,
                            downloads: None,
                            thinking_levels,
                            pricing,
                            percentage,
                            reset,
                            quota_info: info.quota_info.clone(),
                        }
                    }).collect();
                    
                    // Sort for consistency
                    models.sort_by(|a, b| a.id.cmp(&b.id));

                    Response { success: true, models, error: None }
                }
                Err(e) => Response { success: false, models: vec![], error: Some(format!("Failed to parse Antigravity response: {}", e)) }
            }
        },
        Err(e) => Response { success: false, models: vec![], error: Some(format!("Network error: {}", e)) }
    }
}

fn get_antigravity_metadata(id: &str) -> (Option<Vec<String>>, Option<Pricing>) {
    match id {
         "gemini-3-pro-preview" | "gemini-3-pro-high" => (
            Some(vec!["low".into(), "high".into()]),
            Some(Pricing { input: 1.25, cached_input: Some(0.31), cache_write_5m: None, cache_write_1h: None, output: 5.00 })
        ),
        "gemini-3-flash-preview" | "gemini-3-flash" => (
            Some(vec!["minimal".into(), "low".into(), "medium".into(), "high".into()]),
            Some(Pricing { input: 0.10, cached_input: Some(0.025), cache_write_5m: None, cache_write_1h: None, output: 0.40 })
        ),
        "gemini-2.5-pro" | "models/gemini-2.5-pro" => (
            Some(vec!["low".into(), "medium".into(), "high".into()]),
            Some(Pricing { input: 1.25, cached_input: Some(0.31), cache_write_5m: None, cache_write_1h: None, output: 5.00 })
        ),
        "gemini-2.5-flash" | "models/gemini-2.5-flash" => (
            Some(vec!["low".into(), "medium".into(), "high".into()]),
             Some(Pricing { input: 0.10, cached_input: Some(0.025), cache_write_5m: None, cache_write_1h: None, output: 0.40 })
        ),
        "gemini-2.5-flash-lite" | "models/gemini-2.5-flash-lite" => (
            Some(vec!["low".into(), "medium".into(), "high".into()]),
            Some(Pricing { input: 0.075, cached_input: Some(0.018), cache_write_5m: None, cache_write_1h: None, output: 0.30 })
        ),
        "gemini-2.5-computer-use-preview-10-2025" | "rev19-uic3-1p" => (
            Some(vec!["low".into(), "medium".into(), "high".into()]),
            Some(Pricing { input: 1.25, cached_input: Some(0.31), cache_write_5m: None, cache_write_1h: None, output: 5.00 })
        ),
        "gemini-3-pro-image-preview" | "gemini-3-pro-image" => (
            Some(vec!["low".into(), "high".into()]),
             Some(Pricing { input: 1.25, cached_input: Some(0.31), cache_write_5m: None, cache_write_1h: None, output: 5.00 })
        ),
        "gpt-oss-120b-medium" | "models/gpt-oss-120b-medium" => (
            None,
            Some(Pricing { input: 0.60, cached_input: Some(0.15), cache_write_5m: None, cache_write_1h: None, output: 2.40 })
        ),
        _ => (None, None)
    }
}

async fn fetch_codex(_client: &Client, _port: Option<u16>, _key: Option<String>) -> Response {
    let models = vec![
        // GPT-5 Series
        ModelInfo { 
            id: "gpt-5".into(), 
            name: "GPT 5".into(), 
            provider: "codex".into(), 
            description: Some("Stable version of GPT 5, The best model for coding and agentic tasks across domains.".into()), 
            downloads: None,
            thinking_levels: Some(vec!["minimal".into(), "low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { input: 1.25, cached_input: Some(0.125), cache_write_5m: None, cache_write_1h: None, output: 10.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "gpt-5-codex".into(), 
            name: "GPT 5 Codex".into(), 
            provider: "codex".into(), 
            description: Some("Stable version of GPT 5 Codex, The best model for coding and agentic tasks across domains.".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { input: 1.25, cached_input: Some(0.125), cache_write_5m: None, cache_write_1h: None, output: 10.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "gpt-5-codex-mini".into(), 
            name: "GPT 5 Codex Mini".into(), 
            provider: "codex".into(), 
            description: Some("Stable version of GPT 5 Codex Mini: cheaper, faster, but less capable version of GPT 5 Codex.".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { input: 0.25, cached_input: Some(0.025), cache_write_5m: None, cache_write_1h: None, output: 2.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "gpt-5.1".into(), 
            name: "GPT 5.1".into(), 
            provider: "codex".into(), 
            description: Some("Stable version of GPT 5, The best model for coding and agentic tasks across domains.".into()), 
            downloads: None,
            thinking_levels: Some(vec!["none".into(), "low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { input: 1.25, cached_input: Some(0.125), cache_write_5m: None, cache_write_1h: None, output: 10.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "gpt-5.1-codex".into(), 
            name: "GPT 5.1 Codex".into(), 
            provider: "codex".into(), 
            description: Some("Stable version of GPT 5.1 Codex, The best model for coding and agentic tasks across domains.".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { input: 1.25, cached_input: Some(0.125), cache_write_5m: None, cache_write_1h: None, output: 10.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "gpt-5.1-codex-mini".into(), 
            name: "GPT 5.1 Codex Mini".into(), 
            provider: "codex".into(), 
            description: Some("Stable version of GPT 5.1 Codex Mini: cheaper, faster, but less capable version of GPT 5.1 Codex.".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { input: 0.25, cached_input: Some(0.025), cache_write_5m: None, cache_write_1h: None, output: 2.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "gpt-5.1-codex-max".into(), 
            name: "GPT 5.1 Codex Max".into(), 
            provider: "codex".into(), 
            description: Some("Stable version of GPT 5.1 Codex Max".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into(), "xhigh".into()]),
            pricing: Some(Pricing { input: 1.25, cached_input: Some(0.125), cache_write_5m: None, cache_write_1h: None, output: 10.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "gpt-5.2".into(), 
            name: "GPT 5.2".into(), 
            provider: "codex".into(), 
            description: Some("Stable version of GPT 5.2".into()), 
            downloads: None,
            thinking_levels: Some(vec!["none".into(), "low".into(), "medium".into(), "high".into(), "xhigh".into()]),
            pricing: Some(Pricing { input: 1.75, cached_input: Some(0.175), cache_write_5m: None, cache_write_1h: None, output: 14.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "gpt-5.2-codex".into(), 
            name: "GPT 5.2 Codex".into(), 
            provider: "codex".into(), 
            description: Some("Stable version of GPT 5.2 Codex, The best model for coding and agentic tasks across domains.".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into(), "xhigh".into()]),
            pricing: Some(Pricing { input: 1.75, cached_input: Some(0.175), cache_write_5m: None, cache_write_1h: None, output: 14.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        
        // Standard Models
        ModelInfo { 
            id: "gpt-4o".into(), 
            name: "GPT-4o".into(), 
            provider: "codex".into(), 
            description: Some("OpenAI's high-intelligence flagship model".into()), 
            downloads: None,
            thinking_levels: None,
            pricing: Some(Pricing { input: 2.50, cached_input: Some(1.25), cache_write_5m: None, cache_write_1h: None, output: 10.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "gpt-4o-mini".into(), 
            name: "GPT-4o Mini".into(), 
            provider: "codex".into(), 
            description: Some("Small, fast, and intelligent model".into()), 
            downloads: None,
            thinking_levels: None,
            pricing: Some(Pricing { input: 0.15, cached_input: Some(0.075), cache_write_5m: None, cache_write_1h: None, output: 0.60 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        // Pro and Reasoning Models
        ModelInfo { 
            id: "gpt-5.2-pro".into(), 
            name: "GPT 5.2 Pro".into(), 
            provider: "codex".into(), 
            description: Some("High-performance GPT 5.2 Pro".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into(), "xhigh".into()]),
            pricing: Some(Pricing { input: 21.00, cached_input: None, cache_write_5m: None, cache_write_1h: None, output: 168.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "gpt-5-pro".into(), 
            name: "GPT 5 Pro".into(), 
            provider: "codex".into(), 
            description: Some("Flagship GPT 5 Pro".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { input: 15.00, cached_input: None, cache_write_5m: None, cache_write_1h: None, output: 120.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "gpt-4.1".into(), 
            name: "GPT 4.1".into(), 
            provider: "codex".into(), 
            description: Some("Iterative improvement over GPT 4".into()), 
            downloads: None,
            thinking_levels: None,
            pricing: Some(Pricing { input: 2.00, cached_input: Some(0.50), cache_write_5m: None, cache_write_1h: None, output: 8.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "gpt-4.1-mini".into(), 
            name: "GPT 4.1 Mini".into(), 
            provider: "codex".into(), 
            description: Some("Fast GPT 4.1 Mini".into()), 
            downloads: None,
            thinking_levels: None,
            pricing: Some(Pricing { input: 0.40, cached_input: Some(0.10), cache_write_5m: None, cache_write_1h: None, output: 1.60 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        
        // OpenAI o-series Reasoning
        ModelInfo { 
            id: "o1".into(), 
            name: "OpenAI o1".into(), 
            provider: "codex".into(), 
            description: Some("Reasoning model for complex tasks".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { input: 15.00, cached_input: Some(7.50), cache_write_5m: None, cache_write_1h: None, output: 60.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "o1-pro".into(), 
            name: "OpenAI o1-pro".into(), 
            provider: "codex".into(), 
            description: Some("Professional reasoning model".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into(), "xhigh".into()]),
            pricing: Some(Pricing { input: 150.00, cached_input: None, cache_write_5m: None, cache_write_1h: None, output: 600.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "o1-mini".into(), 
            name: "OpenAI o1-mini".into(), 
            provider: "codex".into(), 
            description: Some("Faster reasoning model".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { input: 1.10, cached_input: Some(0.55), cache_write_5m: None, cache_write_1h: None, output: 4.40 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "o3".into(), 
            name: "OpenAI o3".into(), 
            provider: "codex".into(), 
            description: Some("Advanced next-gen reasoning model".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { input: 2.00, cached_input: Some(0.50), cache_write_5m: None, cache_write_1h: None, output: 8.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "o3-pro".into(), 
            name: "OpenAI o3-pro".into(), 
            provider: "codex".into(), 
            description: Some("Professional level o3 reasoning".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into(), "xhigh".into()]),
            pricing: Some(Pricing { input: 20.00, cached_input: None, cache_write_5m: None, cache_write_1h: None, output: 80.00 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "o3-mini".into(), 
            name: "OpenAI o3-mini".into(), 
            provider: "codex".into(), 
            description: Some("Advanced reasoning with improved efficiency.".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { input: 1.10, cached_input: Some(0.55), cache_write_5m: None, cache_write_1h: None, output: 4.40 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
    ];
    Response { success: true, models, error: None }
}

async fn fetch_opencode(_client: &Client) -> Response {
    let models = vec![
        ModelInfo {
            id: "gpt-5-nano".into(),
            name: "GPT-5 Nano".into(),
            provider: "opencode".into(),
            description: Some("GPT-5 Nano model".into()),
            downloads: None,
            thinking_levels: None,
            pricing: Some(Pricing { input: 0.05, cached_input: Some(0.005), cache_write_5m: None, cache_write_1h: None, output: 0.40 }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo {
            id: "grok-code".into(),
            name: "Grok Code Fast 1".into(),
            provider: "opencode".into(),
            description: Some("Grok code fast model".into()),
            downloads: None,
            thinking_levels: None,
            pricing: None,
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo {
            id: "glm-4.7-free".into(),
            name: "GLM 4.7".into(),
            provider: "opencode".into(),
            description: Some("GLM 4.7 free model".into()),
            downloads: None,
            thinking_levels: None,
            pricing: None,
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo {
            id: "minimax-m2.1-free".into(),
            name: "MiniMax M2.1".into(),
            provider: "opencode".into(),
            description: Some("MiniMax M2.1 free model".into()),
            downloads: None,
            thinking_levels: None,
            pricing: None,
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo {
            id: "big-pickle".into(),
            name: "Big Pickle".into(),
            provider: "opencode".into(),
            description: Some("Big Pickle model".into()),
            downloads: None,
            thinking_levels: None,
            pricing: None,
            percentage: None,
            reset: None,
            quota_info: None,
        },
    ];
    Response { success: true, models, error: None }
}

async fn fetch_claude(_client: &Client, _port: Option<u16>, _key: Option<String>) -> Response {
    let models = vec![
        // Claude 4 Series
        ModelInfo { 
            id: "claude-haiku-4-5-20251001".into(), 
            name: "Claude 4.5 Haiku".into(), 
            provider: "claude".into(), 
            description: None, 
            downloads: None,
            thinking_levels: None,
            pricing: Some(Pricing { 
                input: 1.00, 
                cache_write_5m: Some(1.25), 
                cache_write_1h: Some(2.00), 
                cached_input: Some(0.10), 
                output: 5.00 
            }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "claude-sonnet-4-5-20250929".into(), 
            name: "Claude 4.5 Sonnet".into(), 
            provider: "claude".into(), 
            description: None, 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { 
                input: 3.00, 
                cache_write_5m: Some(3.75), 
                cache_write_1h: Some(6.00), 
                cached_input: Some(0.30), 
                output: 15.00 
            }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "claude-opus-4-5-20251101".into(), 
            name: "Claude 4.5 Opus".into(), 
            provider: "claude".into(), 
            description: Some("Premium model combining maximum intelligence with practical performance".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { 
                input: 5.00, 
                cache_write_5m: Some(6.25), 
                cache_write_1h: Some(10.00), 
                cached_input: Some(0.50), 
                output: 25.00 
            }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "claude-opus-4-1-20250805".into(), 
            name: "Claude 4.1 Opus".into(), 
            provider: "claude".into(), 
            description: None, 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { 
                input: 15.00, 
                cache_write_5m: Some(18.75), 
                cache_write_1h: Some(30.00), 
                cached_input: Some(1.50), 
                output: 75.00 
            }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "claude-opus-4-20250514".into(), 
            name: "Claude 4 Opus".into(), 
            provider: "claude".into(), 
            description: None, 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { 
                input: 15.00, 
                cache_write_5m: Some(18.75), 
                cache_write_1h: Some(30.00), 
                cached_input: Some(1.50), 
                output: 75.00 
            }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "claude-sonnet-4-20250514".into(), 
            name: "Claude 4 Sonnet".into(), 
            provider: "claude".into(), 
            description: None, 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { 
                input: 3.00, 
                cache_write_5m: Some(3.75), 
                cache_write_1h: Some(6.00), 
                cached_input: Some(0.30), 
                output: 15.00 
            }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        
        // Claude 3 Series
        ModelInfo { 
            id: "claude-3-7-sonnet-20250219".into(), 
            name: "Claude 3.7 Sonnet".into(), 
            provider: "claude".into(), 
            description: None, 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { 
                input: 3.00, 
                cache_write_5m: Some(3.75), 
                cache_write_1h: Some(6.00), 
                cached_input: Some(0.30), 
                output: 15.00 
            }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "claude-3-5-sonnet-20241022".into(), 
            name: "Claude 3.5 Sonnet".into(), 
            provider: "claude".into(), 
            description: Some("Anthropic's most intelligent model".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { 
                input: 3.00, 
                cache_write_5m: Some(3.75), 
                cache_write_1h: Some(6.00), 
                cached_input: Some(0.30), 
                output: 15.00 
            }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "claude-3-5-haiku-20241022".into(), 
            name: "Claude 3.5 Haiku".into(), 
            provider: "claude".into(), 
            description: Some("Anthropic's fastest model".into()), 
            downloads: None,
            thinking_levels: None,
            pricing: Some(Pricing { 
                input: 0.80, 
                cache_write_5m: Some(1.00), 
                cache_write_1h: Some(1.60), 
                cached_input: Some(0.08), 
                output: 4.00 
            }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
        ModelInfo { 
            id: "claude-3-opus-20240229".into(), 
            name: "Claude 3 Opus".into(), 
            provider: "claude".into(), 
            description: Some("Top-level performance for complex tasks".into()), 
            downloads: None,
            thinking_levels: Some(vec!["low".into(), "medium".into(), "high".into()]),
            pricing: Some(Pricing { 
                input: 15.00, 
                cache_write_5m: Some(18.75), 
                cache_write_1h: Some(30.00), 
                cached_input: Some(1.50), 
                output: 75.00 
            }),
            percentage: None,
            reset: None,
            quota_info: None,
        },
    ];
    Response { success: true, models, error: None }
}




