/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
mod anthropic;
mod antigravity;
mod copilot;
mod cursor;
mod gemini;
mod nvidia;
mod openai;
mod static_models;
mod support;

use anthropic::fetch_anthropic_models;
use antigravity::fetch_antigravity_models;
use copilot::fetch_copilot_models;
use cursor::fetch_cursor_models;
use futures::future::join_all;
use gemini::fetch_gemini_models;
use nvidia::fetch_nvidia_models;
use openai::{fetch_codex_models, fetch_openai_style_models};
use reqwest::Client;
use serde_json::Value;
use static_models::{claude_models, codex_models, cursor_fallback_models};
use std::time::Duration;
use support::{dedupe_models, group_provider_rows, map_provider_models, prioritized_rows};

const MODEL_DISCOVERY_TIMEOUT_MS: u64 = 2_500;
const MODEL_DISCOVERY_CONNECT_TIMEOUT_MS: u64 = 800;

#[derive(Debug, Clone)]
pub struct ServedModel {
    pub id: String,
    pub provider: String,
    pub owned_by: String,
    pub created: u64,
    pub name: String,
    pub display_name: String,
    pub description: Option<String>,
    pub context_length: u32,
    pub max_completion_tokens: u32,
    pub thinking_levels: Vec<String>,
    pub quota_info: Option<Value>,
}

#[derive(Debug, Clone)]
pub(super) struct ProviderModel {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) provider: String,
    pub(super) description: Option<String>,
    pub(super) thinking_levels: Option<Vec<String>>,
    pub(super) quota_info: Option<Value>,
}

pub async fn fetch_models_from_rows(rows: &[Value]) -> Vec<ServedModel> {
    let client = Client::builder()
        .timeout(Duration::from_millis(MODEL_DISCOVERY_TIMEOUT_MS))
        .connect_timeout(Duration::from_millis(MODEL_DISCOVERY_CONNECT_TIMEOUT_MS))
        .build()
        .unwrap_or_else(|_| Client::new());
    let fetches = group_provider_rows(rows)
        .into_iter()
        .map(|(provider, provider_rows)| {
            let client = client.clone();
            async move {
                fetch_provider_models(&client, provider.as_str(), provider_rows.as_slice()).await
            }
        });
    let models = join_all(fetches)
        .await
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();

    let mut deduped = dedupe_models(models);
    deduped.sort_by(|left, right| {
        let provider_cmp = left.provider.cmp(&right.provider);
        if provider_cmp == std::cmp::Ordering::Equal {
            left.id.cmp(&right.id)
        } else {
            provider_cmp
        }
    });
    deduped
}

async fn fetch_provider_models(
    client: &Client,
    provider: &str,
    rows: &[Value],
) -> Vec<ServedModel> {
    match provider {
        "copilot" => {
            for row in prioritized_rows(rows) {
                if let Ok(models) = fetch_copilot_models(client, row).await {
                    if !models.is_empty() {
                        return map_provider_models(models);
                    }
                }
            }
            Vec::new()
        }
        "antigravity" => {
            if let Ok(models) = fetch_antigravity_models(client, rows).await {
                if !models.is_empty() {
                    return map_provider_models(models);
                }
            }
            Vec::new()
        }
        "nvidia" => {
            if let Ok(models) = fetch_nvidia_models(client, rows).await {
                if !models.is_empty() {
                    return map_provider_models(models);
                }
            }
            Vec::new()
        }
        "codex" => fetch_codex_models(client, rows)
            .await
            .ok()
            .filter(|models| !models.is_empty())
            .unwrap_or_else(|| map_provider_models(codex_models())),
        "claude" => map_provider_models(claude_models()),
        "cursor" => match fetch_cursor_models(client, rows).await {
            Ok(models) if !models.is_empty() => models,
            _ => map_provider_models(cursor_fallback_models()),
        },
        "openai" => {
            fetch_openai_style_models(client, rows, "https://api.openai.com/v1/models", "openai")
                .await
        }
        "groq" => {
            fetch_openai_style_models(
                client,
                rows,
                "https://api.groq.com/openai/v1/models",
                "groq",
            )
            .await
        }
        "deepseek" => {
            fetch_openai_style_models(
                client,
                rows,
                "https://api.deepseek.com/v1/models",
                "deepseek",
            )
            .await
        }
        "xai" => fetch_openai_style_models(client, rows, "https://api.x.ai/v1/models", "xai").await,
        "mistral" => {
            fetch_openai_style_models(client, rows, "https://api.mistral.ai/v1/models", "mistral")
                .await
        }
        "openrouter" => {
            fetch_openai_style_models(
                client,
                rows,
                "https://openrouter.ai/api/v1/models",
                "openrouter",
            )
            .await
        }
        "anthropic" => fetch_anthropic_models(client, rows)
            .await
            .ok()
            .filter(|models| !models.is_empty())
            .unwrap_or_default(),
        "gemini" => fetch_gemini_models(client, rows)
            .await
            .ok()
            .filter(|models| !models.is_empty())
            .unwrap_or_default(),
        "kimi" | "moonshot" => {
            fetch_openai_style_models(
                client,
                rows,
                "https://api.moonshot.cn/v1/models",
                "kimi",
            )
            .await
        }
        "opencode" => {
            fetch_openai_style_models(
                client,
                rows,
                "https://opencode.ai/zen/v1/models",
                "opencode",
            )
            .await
        }
        _ => Vec::new(),
    }
}
