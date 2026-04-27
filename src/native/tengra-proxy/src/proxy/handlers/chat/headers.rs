/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use reqwest::RequestBuilder;
use serde_json::Value;

use crate::proxy::antigravity::DEFAULT_USER_AGENT;

pub fn apply_headers(
    mut builder: RequestBuilder,
    provider: &str,
    auth_token: &str,
    is_stream: bool,
    active_key_row: &serde_json::Value,
    session_id: Option<&str>,
    prior_signature: Option<&str>,
) -> RequestBuilder {
    match provider {
        "claude" => {
            builder = builder
                .header("X-Api-Key", auth_token)
                .header("Anthropic-Version", "2023-06-01")
                .header(
                    "Anthropic-Beta",
                    "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14,ccr-byoc-2025-07-29"
                )
                .header("Anthropic-Dangerous-Direct-Browser-Access", "true")
                .header("User-Agent", "claude-code/0.2.29 (Windows; x64)")
                .header("x-anthropic-billing-header", build_anthropic_billing_header())
                .header("X-App", "claude-code")
                .header("X-Stainless-Runtime", "node")
                .header("X-Stainless-Lang", "js")
                .header("Connection", "keep-alive")
                .header("Accept", "application/json");

            if let Some(sid) = session_id {
                builder = builder.header("X-Claude-Code-Session-Id", sid);
            }
            if let Some(sig) = prior_signature {
                builder = builder.header("X-Anthropic-Prior-Signature", sig);
            }
        }
        "antigravity" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("User-Agent", antigravity_user_agent(active_key_row))
                .header("Connection", "keep-alive")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        "copilot" => {
            let final_token = extract_session_token(auth_token, active_key_row);
            builder = builder
                .header("Authorization", format!("Bearer {}", final_token))
                .header("User-Agent", "gh-copilot/1.0.0")
                .header("Copilot-Integration-Id", "gh-copilot")
                .header("Editor-Version", "gh/2.61.0")
                .header("Editor-Plugin-Version", "gh-copilot/1.0.0")
                .header("Openai-Intent", "conversation-panel")
                .header("X-GitHub-Api-Version", "2026-03-10")
                .header("X-Request-Id", uuid::Uuid::new_v4().to_string())
                .header("Openai-Organization", "github-copilot")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        "codex" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Version", "0.21.0")
                .header("Openai-Beta", "responses=experimental")
                .header("User-Agent", "codex_cli_rs/1.0.1 (Windows 10; x64)")
                .header("Originator", "codex_cli_rs")
                .header("Accept", "*/*");

            // Extract Chatgpt-Account-Id from metadata
            if let Some(metadata) = active_key_row.get("metadata").and_then(|v| v.as_str()) {
                if let Ok(meta_json) = serde_json::from_str::<Value>(metadata) {
                    if let Some(account_id) = meta_json.get("account_id").and_then(|v| v.as_str()) {
                        builder = builder.header("Chatgpt-Account-Id", account_id);
                    }
                }
            }
        }
        // OpenAI API (sk-... keys)
        "openai" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        // Google Gemini API
        "gemini" => {
            builder = builder
                .header("x-goog-api-key", auth_token)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json");
        }
        // Mistral AI
        "mistral" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        // Groq
        "groq" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        // Together AI
        "together" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        // Perplexity AI
        "perplexity" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        // Cohere
        "cohere" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        // xAI (Grok)
        "xai" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        // DeepSeek
        "deepseek" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        // OpenRouter
        "openrouter" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header("HTTP-Referer", "https://tengra.app")
                .header("X-Title", "Tengra")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        // NVIDIA NIM
        "nvidia" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        _ => {
            // Default: OpenAI-compatible
            builder = builder.header("Authorization", format!("Bearer {}", auth_token));
        }
    }

    builder
}

fn build_anthropic_billing_header() -> String {
    let version = "0.2.29.tengra";
    let entrypoint = "cli";
    let cch = "00000"; // Placeholder for Bun-style attestation
    format!(
        "cc_version={}; cc_entrypoint={}; cch={};",
        version, entrypoint, cch
    )
}

fn antigravity_user_agent(row: &Value) -> String {
    if let Some(metadata_str) = row.get("metadata").and_then(Value::as_str) {
        if let Ok(meta_json) = serde_json::from_str::<Value>(metadata_str) {
            if let Some(user_agent) = meta_json.get("user_agent").and_then(Value::as_str) {
                let trimmed = user_agent.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            }
        }
    }
    DEFAULT_USER_AGENT.to_string()
}

fn extract_session_token(raw_token: &str, row: &Value) -> String {
    if let Some(metadata_str) = row.get("metadata").and_then(|v| v.as_str()) {
        if let Ok(meta_json) = serde_json::from_str::<Value>(metadata_str) {
            if let Some(session_token) = meta_json.get("session_token").and_then(|v| v.as_str()) {
                return session_token.to_string();
            } else if let Some(token) = meta_json.get("token").and_then(|v| v.as_str()) {
                return token.to_string();
            }
        }
    }
    raw_token.to_string()
}
