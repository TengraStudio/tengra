// Hide console window on Windows (prevents conhost.exe)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use axum::{
    routing::post,
    Json, Router,
    extract::State,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
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
        let services_dir = std::path::Path::new(&appdata).join("Tandem").join("services");
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
        "nvidia" => fetch_nvidia(&state.client, payload.token).await,
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

async fn fetch_nvidia(client: &Client, token: Option<String>) -> Response {
    let Some(auth_token) = token else {
        return Response { success: false, models: vec![], error: Some("No NVIDIA API key provided".into()) };
    };

    let mut all_models = get_nvidia_fallbacks();

    // Try to fetch dynamic models from API
    let url = "https://integrate.api.nvidia.com/v1/models";
    match client.get(url)
        .header("Authorization", format!("Bearer {}", auth_token))
        .send().await 
    {
        Ok(res) => {
            if res.status().is_success() {
                #[derive(Deserialize)]
                struct NvidiaModelData { id: String }
                #[derive(Deserialize)]
                struct NvidiaResponse { data: Vec<NvidiaModelData> }

                if let Ok(data) = res.json::<NvidiaResponse>().await {
                    for m in data.data {
                        // Avoid duplicates from hardcoded list
                        if !all_models.iter().any(|existing| existing.id == m.id || existing.id == format!("nvidia/{}", m.id)) {
                            all_models.push(ModelInfo {
                                id: if m.id.starts_with("nvidia/") { m.id.clone() } else { format!("nvidia/{}", m.id) },
                                name: m.id.clone(),
                                provider: "nvidia".into(),
                                description: Some("NVIDIA Hosted Model".into()),
                                ..ModelInfo::default()
                            });
                        }
                    }
                }
            }
        },
        Err(e) => {
            eprintln!("Failed to fetch dynamic NVIDIA models: {}", e);
        }
    }

    Response { success: true, models: all_models, error: None }
}

fn get_nvidia_fallbacks() -> Vec<ModelInfo> {
    let mut models = vec![
        // Llama 3.1 / 3.2 / 3.3 Series
        ModelInfo { id: "nvidia/llama-3.1-nemotron-70b-instruct".into(), name: "Llama 3.1 Nemotron 70B".into(), provider: "nvidia".into(), description: Some("NVIDIA's customized Llama 3.1 70B".into()), ..ModelInfo::default() },
        ModelInfo { id: "meta/llama-3.1-405b-instruct".into(), name: "Llama 3.1 405B".into(), provider: "nvidia".into(), description: Some("Meta's largest open source model".into()), ..ModelInfo::default() },
        ModelInfo { id: "meta/llama-3.1-70b-instruct".into(), name: "Llama 3.1 70B".into(), provider: "nvidia".into(), description: Some("High performance LLM".into()), ..ModelInfo::default() },
        ModelInfo { id: "meta/llama-3.1-8b-instruct".into(), name: "Llama 3.1 8B".into(), provider: "nvidia".into(), description: Some("Fast and efficient LLM".into()), ..ModelInfo::default() },
        ModelInfo { id: "meta/llama-3.2-1b-instruct".into(), name: "Llama 3.2 1B".into(), provider: "nvidia".into(), description: Some("Lightweight mobile model".into()), ..ModelInfo::default() },
        ModelInfo { id: "meta/llama-3.2-3b-instruct".into(), name: "Llama 3.2 3B".into(), provider: "nvidia".into(), description: Some("Lightweight mobile model".into()), ..ModelInfo::default() },
        ModelInfo { id: "meta/llama-3.3-70b-instruct".into(), name: "Llama 3.3 70B".into(), provider: "nvidia".into(), description: Some("Next-gen performance model".into()), ..ModelInfo::default() },
        
        // DeepSeek Series
        ModelInfo { id: "deepseek-ai/deepseek-r1-distill-llama-8b".into(), name: "DeepSeek R1 Distill Llama 8B".into(), provider: "nvidia".into(), description: Some("Reasoning model".into()), ..ModelInfo::default() },
        ModelInfo { id: "deepseek-ai/deepseek-r1-distill-qwen-32b".into(), name: "DeepSeek R1 Distill Qwen 32B".into(), provider: "nvidia".into(), description: Some("High-perf reasoning model".into()), ..ModelInfo::default() },
        ModelInfo { id: "deepseek-ai/deepseek-v3.1".into(), name: "DeepSeek V3.1".into(), provider: "nvidia".into(), description: Some("Latest DeepSeek flagship".into()), ..ModelInfo::default() },
        
        // Mistral / Mixtral
        ModelInfo { id: "mistralai/mistral-large-2-instruct".into(), name: "Mistral Large 2".into(), provider: "nvidia".into(), description: Some("Mistral AI's flagship".into()), ..ModelInfo::default() },
        ModelInfo { id: "mistralai/mixtral-8x22b-instruct-v0.1".into(), name: "Mixtral 8x22B".into(), provider: "nvidia".into(), description: Some("High performance MoE".into()), ..ModelInfo::default() },
        ModelInfo { id: "mistralai/codestral-22b-instruct-v0.1".into(), name: "Codestral 22B".into(), provider: "nvidia".into(), description: Some("Specialized code model".into()), ..ModelInfo::default() },

        // Google Gemma
        ModelInfo { id: "google/gemma-2-27b-it".into(), name: "Gemma 2 27B".into(), provider: "nvidia".into(), description: Some("Google's lightweight model".into()), ..ModelInfo::default() },
        ModelInfo { id: "google/gemma-3-1b-it".into(), name: "Gemma 3 1B".into(), provider: "nvidia".into(), description: Some("Ultra-fast Google model".into()), ..ModelInfo::default() },

        // NVIDIA Nemotron Specialty
        ModelInfo { id: "nvidia/llama-3.1-nemoguard-8b-content-safety".into(), name: "NeMo Guard 8B Safety".into(), provider: "nvidia".into(), description: Some("NVIDIA Content Safety model".into()), ..ModelInfo::default() },
        ModelInfo { id: "nvidia/nemotron-4-mini-hindi-4b-instruct".into(), name: "Nemotron 4 Mini Hindi 4B".into(), provider: "nvidia".into(), description: Some("Hindi specialized model".into()), ..ModelInfo::default() },
        
        // Visual / Multimodal
        ModelInfo { id: "black-forest-labs/flux.1-dev".into(), name: "FLUX.1 [dev]".into(), provider: "nvidia".into(), description: Some("Advanced image generation".into()), ..ModelInfo::default() },
        ModelInfo { id: "stabilityai/stable-diffusion-3-medium".into(), name: "Stable Diffusion 3".into(), provider: "nvidia".into(), description: Some("Flagship SD model".into()), ..ModelInfo::default() },
        
        // Healthcare/Science (Special Request)
        ModelInfo { id: "deepmind/alphafold2".into(), name: "AlphaFold 2".into(), provider: "nvidia".into(), description: Some("Protein structure prediction".into()), ..ModelInfo::default() },
        ModelInfo { id: "nvidia/genmol".into(), name: "NVIDIA GenMol".into(), provider: "nvidia".into(), description: Some("Molecular generation".into()), ..ModelInfo::default() },
        ModelInfo { id: "nvidia/vista3d".into(), name: "NVIDIA Vista3D".into(), provider: "nvidia".into(), description: Some("3D medical imaging".into()), ..ModelInfo::default() },

        // Climate / Others
        ModelInfo { id: "nvidia/corrdiff".into(), name: "CorrDiff Climate".into(), provider: "nvidia".into(), description: Some("Climate simulation model".into()), ..ModelInfo::default() },
        ModelInfo { id: "nvidia/cuopt".into(), name: "cuOpt Route optimization".into(), provider: "nvidia".into(), description: Some("Optimization API".into()), ..ModelInfo::default() },
        ModelInfo { id: "nvidia/fourcastnet".into(), name: "FourCastNet".into(), provider: "nvidia".into(), description: Some("Climate simulation API".into()), ..ModelInfo::default() },
        
        // Retrieval / Embedding
        ModelInfo { id: "baai/bge-m3".into(), name: "BGE-M3".into(), provider: "nvidia".into(), description: Some("SOTA embedding model".into()), ..ModelInfo::default() },
        ModelInfo { id: "nvidia/embed-qa-4".into(), name: "Embed QA 4".into(), provider: "nvidia".into(), description: Some("NVIDIA optimized embedding".into()), ..ModelInfo::default() },
        ModelInfo { id: "snowflake/arctic-embed-l".into(), name: "Arctic Embed L".into(), provider: "nvidia".into(), description: Some("Enterprise embedding model".into()), ..ModelInfo::default() },

        // More LLMs
        ModelInfo { id: "google/codegemma-1.1-7b".into(), name: "CodeGemma 1.1 7B".into(), provider: "nvidia".into(), description: Some("Google specialized code model".into()), ..ModelInfo::default() },
        ModelInfo { id: "microsoft/phi-4-mini-instruct".into(), name: "Phi-4 Mini".into(), provider: "nvidia".into(), description: Some("Latest Microsoft SLM".into()), ..ModelInfo::default() },
        ModelInfo { id: "ibm/granite-3_3-8b-instruct".into(), name: "Granite 3.3 8B".into(), provider: "nvidia".into(), description: Some("IBM lightweight model".into()), ..ModelInfo::default() },
        ModelInfo { id: "rakuten/rakutenai-7b-chat".into(), name: "RakutenAI 7B Chat".into(), provider: "nvidia".into(), description: Some("Japanese chat model".into()), ..ModelInfo::default() },
        ModelInfo { id: "thudm/chatglm3-6b".into(), name: "ChatGLM3 6B".into(), provider: "nvidia".into(), description: Some("Bilingual chat model".into()), ..ModelInfo::default() },
    ];

    let extra_model_ids = [
        // LLMs
        "abacusai/dracarys-llama-3.1-70b-instruct",
        "ai21labs/jamba-1.5-mini-instruct",
        "aisingapore/sea-lion-7b-instruct",
        "baichuan-inc/baichuan2-13b-chat",
        "bigcode/starcoder2-7b",
        "bytedance/seed-oss-36b-instruct",
        "deepseek-ai/deepseek-r1-distill-qwen-7b",
        "deepseek-ai/deepseek-r1-distill-qwen-14b",
        "deepseek-ai/deepseek-r1-distill-qwen-32b",
        "deepseek-ai/deepseek-v3.1-terminus",
        "deepseek-ai/deepseek-v3.2",
        "google/codegemma-7b",
        "google/gemma-7b",
        "google/gemma-2-2b-it",
        "google/gemma-2-9b-it",
        "google/gemma-3-1b-it",
        "google/shieldgemma-9b",
        "gotocompany/gemma-2-9b-cpt-sahabatai-instruct",
        "ibm/granite-guardian-3.0-8b",
        "igenius/colosseum_355b_instruct_16k",
        "igenius/italia_10b_instruct_16k",
        "institute-of-science-tokyo/llama-3.1-swallow-70b-instruct-v01",
        "institute-of-science-tokyo/llama-3.1-swallow-8b-instruct-v0.1",
        "marin/marin-8b-instruct",
        "mediatek/breeze-7b-instruct",
        "meta/codellama-70b",
        "meta/llama2-70b",
        "meta/llama3-8b",
        "meta/llama3-70b",
        "meta/llama-3.1-8b-instruct",
        "meta/llama-3.1-70b-instruct",
        "meta/llama-3.2-1b-instruct",
        "meta/llama-3.2-3b-instruct",
        "meta/llama-3.3-70b-instruct",
        "microsoft/phi-3-medium-128k-instruct",
        "microsoft/phi-3-medium-4k-instruct",
        "microsoft/phi-3-mini-128k-instruct",
        "microsoft/phi-3-mini-4k-instruct",
        "microsoft/phi-3-small-128k-instruct",
        "microsoft/phi-3-small-8k-instruct",
        "microsoft/phi-3.5-mini",
        "microsoft/phi-4-mini-instruct",
        "microsoft/phi-4-mini-flash-reasoning",
        "minimaxai/minimax-m2",
        "minimaxai/minimax-m2.1",
        "mistralai/codestral-22b-instruct-v0.1",
        "mistralai/devstral-2-123b-instruct-2512",
        "mistralai/magistral-small-2506",
        "mistralai/mamba-codestral-7b-v0.1",
        "mistralai/mathstral-7b-v01",
        "mistralai/mistral-2-large-instruct",
        "mistralai/mistral-7b-instruct",
        "mistralai/mistral-7b-instruct-v0.3",
        "mistralai/mistral-large",
        "mistralai/mistral-nemotron",
        "mistralai/mistral-small-24b-instruct",
        "mistralai/mixtral-8x7b-instruct",
        "mistralai/mixtral-8x22b-instruct",
        "moonshotai/kimi-k2-instruct",
        "moonshotai/kimi-k2-instruct-0905",
        "moonshotai/kimi-k2-thinking",
        "nvidia/llama3-chatqa-1.5-8b",
        "nvidia/llama-3.1-nemoguard-8b-topic-control",
        "nvidia/llama-3.1-nemotron-nano-8b-v1",
        "nvidia/llama-3.1-nemotron-70b-reward",
        "nvidia/llama-3.1-nemotron-nano-4b-v1_1",
        "nvidia/llama-3_1-nemotron-safety-guard-8b-v3",
        "nvidia/llama-3.1-nemotron-safety-guard-multilingual-8b-v1",
        "nvidia/llama-3.1-nemotron-ultra-253b-v1",
        "nvidia/llama-3.2-nemoretriever-1b-vlm-embed-v1",
        "nvidia/llama-3.3-nemotron-super-49b-v1",
        "nvidia/llama-3.3-nemotron-super-49b-v1.5",
        "nvidia/mistral-nemo-minitron-8b-base",
        "nvidia/nemoguard-jailbreak-detect",
        "nvidia/nemotron-3-nano-30b-a3b",
        "nvidia/nemotron-content-safety-reasoning-4b",
        "nvidia/nemotron-mini-4b-instruct",
        "nvidia/nvidia-nemotron-nano-9b-v2",
        "nvidia/riva-translate-4b-instruct-v1_1",
        "nvidia/usdcode",
        "nvidia/usdsearch",
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
        "opengpt-x/teuken-7b-instruct-commercial-v0.4",
        "qwen/qwen2-7b-instruct",
        "qwen/qwen2.5-7b-instruct",
        "qwen/qwen2.5-coder-7b-instruct",
        "qwen/qwen2.5-coder-32b-instruct",
        "qwen/qwen3-235b-a22b",
        "qwen/qwen3-coder-480b-a35b-instruct",
        "qwen/qwen3-next-80b-a3b-instruct",
        "qwen/qwen3-next-80b-a3b-thinking",
        "qwen/qwq-32b",
        "rakuten/rakutenai-7b-instruct",
        "seallms/seallm-7b-v2.5",
        "sarvamai/sarvam-m",
        "speakleash/bielik-11b-v2_6-instruct",
        "stepfun-ai/step-3-5-flash",
        "stockmark/stockmark-2-100b-instruct",
        "tokyotech-llm/llama-3-swallow-70b-instruct-v01",
        "tiiuae/falcon3-7b-instruct",
        "upstage/solar-10.7b-instruct",
        "utter-project/eurollm-9b-instruct",
        "yentinglin/llama-3-taiwan-70b-instruct",
        "z-ai/glm4.7",

        // Retrieval
        "nvidia/llama-3.2-nemoretriever-300m-embed-v1",
        "nvidia/llama-3.2-nemoretriever-300m-embed-v2",
        "nvidia/llama-3.2-nemoretriever-500m-rerank-v2",
        "nvidia/llama-3.2-nv-embedqa-1b-v1",
        "nvidia/llama-3.2-nv-embedqa-1b-v2",
        "nvidia/llama-3.2-nv-rerankqa-1b-v1",
        "nvidia/llama-3.2-nv-rerankqa-1b-v2",
        "nvidia/nvclip",
        "nvidia/nv-embed-v1",
        "nvidia/nv-embedcode-7b-v1",
        "nvidia/nv-embedqa-e5-v5",
        "nvidia/nv-rerankqa-mistral-4b-v3",
        "nvidia/rerank-qa-mistral-4b",

        // Visual
        "black-forest-labs/flux_1-schnell",
        "google/gemma-3-27b-it",
        "google/gemma-3n-e2b-it",
        "google/gemma-3n-e4b-it",
        "hive/ai-generated-image-detection",
        "hive/deepfake-image-detection",
        "meta/llama-guard-4-12b",
        "microsoft/phi-4-multimodal-instruct",
        "microsoft/trellis",
        "mistralai/mistral-large-3-675b-instruct-2512",
        "mistralai/ministral-14b-instruct-2512",
        "mistralai/mistral-medium-3-instruct",
        "mistralai/mistral-small-3_1-24b-instruct-2503",
        "nvidia/bevformer",
        "nvidia/cosmos-predict1-7b",
        "nvidia/nemoretriever-parse",
        "nvidia/nemotron-nano-12b-v2-vl",
        "nvidia/nemotron-parse",
        "nvidia/nv-dinov2",
        "nvidia/nv-grounding-dino",
        "nvidia/ocdrnet",
        "nvidia/retail-object-detection",
        "nvidia/sparsedrive",
        "nvidia/streampetr",
        "nvidia/vila",
        "nvidia/visual-changenet",
        "stabilityai/stable-diffusion-xl",
        "stabilityai/stable-video-diffusion",

        // Multimodal
        "black-forest-labs/flux.1-kontext-dev",
        "google/paligemma",
        "meta/llama-3.2-11b-vision-instruct",
        "meta/llama-3.2-90b-vision-instruct",
        "meta/llama-4-maverick-17b-128e-instruct",
        "meta/llama-4-scout-17b-16e-instruct",
        "microsoft/phi-3.5-vision-instruct",
        "moonshotai/kimi-k2-5",
        "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",

        // Healthcare
        "arc/evo2-40b",
        "colabfold/msa-search",
        "deepmind/alphafold2-multimer",
        "ipd/proteinmpnn",
        "ipd/rfdiffusion",
        "meta/esmfold",
        "meta/esm2-650m",
        "mit/boltz2",
        "mit/diffdock",
        "nvidia/maisi",
        "nvidia/molmim",
        "openfold/openfold2",
        "openfold/openfold3",
    ];

    for id in extra_model_ids {
        models.push(ModelInfo {
            id: id.into(),
            name: id.into(),
            provider: "nvidia".into(),
            description: Some("Community model".into()),
            ..ModelInfo::default()
        });
    }

    let mut seen: HashSet<String> = HashSet::new();
    models.retain(|m| seen.insert(m.id.clone()));
    models
}

impl ModelInfo {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            provider: String::new(),
            description: None,
            downloads: None,
            thinking_levels: None,
            pricing: None,
            percentage: None,
            reset: None,
            quota_info: None,
        }
    }
}





