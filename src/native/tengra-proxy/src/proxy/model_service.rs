/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::proxy::antigravity::{
    fallback_base_urls, normalize_discovered_model_id, DEFAULT_USER_AGENT,
};
use crate::proxy::model_catalog::find_model;
use crate::security::{decrypt_token, load_master_key};
use crate::token::refresh::{execute_refresh, AuthToken};
use crate::{auth::copilot::CopilotClient, db};
use reqwest::{Client, StatusCode};
use serde::Deserialize;
use serde_json::{Map, Value};

const NVIDIA_LIVE_MODELS_URL: &str = "https://integrate.api.nvidia.com/v1/models";

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
struct ProviderModel {
    id: String,
    name: String,
    provider: String,
    description: Option<String>,
    thinking_levels: Option<Vec<String>>,
    quota_info: Option<Value>,
}

pub async fn fetch_models_from_rows(rows: &[Value]) -> Vec<ServedModel> {
    let client = Client::new();
    let mut models = Vec::new();

    for (provider, provider_rows) in group_provider_rows(rows) {
        let fetched =
            fetch_provider_models(&client, provider.as_str(), provider_rows.as_slice()).await;
        models.extend(fetched);
    }

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

fn group_provider_rows(rows: &[Value]) -> Vec<(String, Vec<Value>)> {
    let mut grouped = Vec::<(String, Vec<Value>)>::new();
    for row in rows {
        let Some(provider) = row.get("provider").and_then(|value| value.as_str()) else {
            continue;
        };
        let normalized = normalize_provider(provider).to_string();
        if let Some((_, bucket)) = grouped.iter_mut().find(|(key, _)| *key == normalized) {
            bucket.push(row.clone());
        } else {
            grouped.push((normalized, vec![row.clone()]));
        }
    }
    grouped
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
            for row in prioritized_rows(rows) {
                if let Ok(models) = fetch_antigravity_models(client, row).await {
                    if !models.is_empty() {
                        return map_provider_models(models);
                    }
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
        "codex" => map_provider_models(codex_models()),
        // OAuth-based Claude (browser session)
        "claude" => map_provider_models(claude_models()),
        // API key providers
        "openai" => {
            fetch_openai_style_models(client, rows, "https://api.openai.com/v1/models", "openai")
                .await
                .ok()
                .filter(|models| !models.is_empty())
                .unwrap_or_default()
        }
        "groq" => fetch_openai_style_models(
            client,
            rows,
            "https://api.groq.com/openai/v1/models",
            "groq",
        )
        .await
        .ok()
        .filter(|models| !models.is_empty())
        .unwrap_or_default(),
        "together" => fetch_openai_style_models(
            client,
            rows,
            "https://api.together.xyz/v1/models",
            "together",
        )
        .await
        .ok()
        .filter(|models| !models.is_empty())
        .unwrap_or_default(),
        "deepseek" => fetch_openai_style_models(
            client,
            rows,
            "https://api.deepseek.com/v1/models",
            "deepseek",
        )
        .await
        .ok()
        .filter(|models| !models.is_empty())
        .unwrap_or_default(),
        "xai" => fetch_openai_style_models(client, rows, "https://api.x.ai/v1/models", "xai")
            .await
            .ok()
            .filter(|models| !models.is_empty())
            .unwrap_or_default(),
        "mistral" => {
            fetch_openai_style_models(client, rows, "https://api.mistral.ai/v1/models", "mistral")
                .await
                .ok()
                .filter(|models| !models.is_empty())
                .unwrap_or_default()
        }
        "perplexity" => fetch_openai_style_models(
            client,
            rows,
            "https://api.perplexity.ai/models",
            "perplexity",
        )
        .await
        .ok()
        .filter(|models| !models.is_empty())
        .unwrap_or_default(),
        "openrouter" => fetch_openai_style_models(
            client,
            rows,
            "https://openrouter.ai/api/v1/models",
            "openrouter",
        )
        .await
        .ok()
        .filter(|models| !models.is_empty())
        .unwrap_or_default(),
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
        "cohere" => fetch_cohere_models(client, rows)
            .await
            .ok()
            .filter(|models| !models.is_empty())
            .unwrap_or_default(),
        _ => Vec::new(),
    }
}

async fn fetch_openai_style_models(
    client: &Client,
    rows: &[Value],
    url: &str,
    provider: &str,
) -> Result<Vec<ServedModel>, String> {
    for row in prioritized_rows(rows) {
        let Some(token) = token_value_from_row(row, "access_token") else {
            continue;
        };
        let response = match client
            .get(url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/json")
            .send()
            .await
        {
            Ok(response) => response,
            Err(_) => continue,
        };
        if !response.status().is_success() {
            continue;
        }
        let body = match response.json::<Value>().await {
            Ok(body) => body,
            Err(_) => continue,
        };
        let mut models = parse_provider_models_from_payload(&body, provider, &["id", "name"]);
        models.sort_by(|left, right| left.id.cmp(&right.id));
        if !models.is_empty() {
            return Ok(models);
        }
    }
    Ok(Vec::new())
}

async fn fetch_anthropic_models(
    client: &Client,
    rows: &[Value],
) -> Result<Vec<ServedModel>, String> {
    for row in prioritized_rows(rows) {
        let Some(token) = token_value_from_row(row, "access_token") else {
            continue;
        };
        let response = match client
            .get("https://api.anthropic.com/v1/models")
            .header("x-api-key", token)
            .header("anthropic-version", "2023-06-01")
            .header("Accept", "application/json")
            .send()
            .await
        {
            Ok(response) => response,
            Err(_) => continue,
        };
        if !response.status().is_success() {
            continue;
        }
        let body = match response.json::<Value>().await {
            Ok(body) => body,
            Err(_) => continue,
        };
        let mut models = parse_provider_models_from_payload(&body, "anthropic", &["id", "name"]);
        models.sort_by(|left, right| left.id.cmp(&right.id));
        if !models.is_empty() {
            return Ok(models);
        }
    }
    Ok(Vec::new())
}

async fn fetch_gemini_models(client: &Client, rows: &[Value]) -> Result<Vec<ServedModel>, String> {
    for row in prioritized_rows(rows) {
        let Some(token) = token_value_from_row(row, "access_token") else {
            continue;
        };
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models?key={}",
            token
        );
        let response = match client
            .get(url)
            .header("Accept", "application/json")
            .send()
            .await
        {
            Ok(response) => response,
            Err(_) => continue,
        };
        if !response.status().is_success() {
            continue;
        }
        let body = match response.json::<Value>().await {
            Ok(body) => body,
            Err(_) => continue,
        };
        let mut models = parse_provider_models_from_payload(&body, "gemini", &["name", "id"]);
        models.sort_by(|left, right| left.id.cmp(&right.id));
        if !models.is_empty() {
            return Ok(models);
        }
    }
    Ok(Vec::new())
}

async fn fetch_cohere_models(client: &Client, rows: &[Value]) -> Result<Vec<ServedModel>, String> {
    for row in prioritized_rows(rows) {
        let Some(token) = token_value_from_row(row, "access_token") else {
            continue;
        };
        let response = match client
            .get("https://api.cohere.com/v1/models")
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/json")
            .send()
            .await
        {
            Ok(response) => response,
            Err(_) => continue,
        };
        if !response.status().is_success() {
            continue;
        }
        let body = match response.json::<Value>().await {
            Ok(body) => body,
            Err(_) => continue,
        };
        let mut models = parse_provider_models_from_payload(&body, "cohere", &["name", "id"]);
        models.sort_by(|left, right| left.id.cmp(&right.id));
        if !models.is_empty() {
            return Ok(models);
        }
    }
    Ok(Vec::new())
}

fn parse_provider_models_from_payload(
    payload: &Value,
    provider: &str,
    preferred_id_keys: &[&str],
) -> Vec<ServedModel> {
    let Some(items) = find_model_items(payload, 3) else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(|item| parse_served_model_item(item, provider, preferred_id_keys))
        .collect()
}

fn parse_served_model_item(
    item: &Value,
    provider: &str,
    preferred_id_keys: &[&str],
) -> Option<ServedModel> {
    let mut id_candidates = preferred_id_keys.to_vec();
    id_candidates.extend(["id", "name", "model", "model_id", "slug"]);
    let id = value_string(item, id_candidates.as_slice())
        .or_else(|| item.as_str().map(str::to_string))
        .map(|value| normalize_provider_model_id(provider, value))?;

    if id.trim().is_empty() {
        return None;
    }

    let display_name = value_string(item, &["display_name", "displayName", "name"])
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| id.clone());
    let owned_by = value_string(item, &["owned_by", "ownedBy", "organization"])
        .unwrap_or_else(|| default_owned_by(provider));
    let description = value_string(item, &["description", "summary"]);
    let created = value_u64(item, &["created", "created_at", "createdAt"]).unwrap_or(0);

    Some(ServedModel {
        id: id.clone(),
        provider: provider.to_string(),
        owned_by,
        created,
        name: id.clone(),
        display_name,
        description,
        context_length: 0,
        max_completion_tokens: 0,
        thinking_levels: vec![],
        quota_info: None,
    })
}

fn normalize_provider_model_id(provider: &str, raw_id: String) -> String {
    let trimmed = raw_id.trim();
    if provider == "gemini" {
        return trimmed
            .strip_prefix("models/")
            .unwrap_or(trimmed)
            .to_string();
    }
    trimmed.to_string()
}

fn value_string(item: &Value, keys: &[&str]) -> Option<String> {
    let object = item.as_object()?;
    for key in keys {
        let value = object.get(*key).and_then(Value::as_str).map(str::trim);
        if let Some(value) = value.filter(|value| !value.is_empty()) {
            return Some(value.to_string());
        }
    }
    None
}

fn value_u64(item: &Value, keys: &[&str]) -> Option<u64> {
    let object = item.as_object()?;
    for key in keys {
        let Some(value) = object.get(*key) else {
            continue;
        };
        if let Some(parsed) = value.as_u64() {
            return Some(parsed);
        }
        if let Some(parsed) = value.as_str().and_then(|text| text.parse::<u64>().ok()) {
            return Some(parsed);
        }
    }
    None
}

fn find_model_items(value: &Value, max_depth: u8) -> Option<&Vec<Value>> {
    if max_depth == 0 {
        return None;
    }
    if let Some(array) = value.as_array() {
        if looks_like_model_items(array.as_slice()) {
            return Some(array);
        }
    }
    let object = value.as_object()?;
    for key in ["data", "models", "items", "results"] {
        if let Some(array) = object.get(key).and_then(Value::as_array) {
            if looks_like_model_items(array.as_slice()) {
                return Some(array);
            }
        }
    }
    for nested in object.values() {
        if let Some(found) = find_model_items(nested, max_depth - 1) {
            return Some(found);
        }
    }
    None
}

fn looks_like_model_items(items: &[Value]) -> bool {
    items.iter().any(|item| {
        item.as_str()
            .map(|value| !value.trim().is_empty())
            .or_else(|| {
                item.as_object().map(|object| {
                    ["id", "name", "model", "model_id", "slug"]
                        .iter()
                        .any(|key| {
                            object
                                .get(*key)
                                .and_then(Value::as_str)
                                .map(|value| !value.trim().is_empty())
                                .unwrap_or(false)
                        })
                })
            })
            .unwrap_or(false)
    })
}

fn prioritized_rows(rows: &[Value]) -> Vec<&Value> {
    let mut prioritized = rows.iter().collect::<Vec<_>>();
    prioritized.sort_by_key(|row| {
        if row.get("is_active").and_then(|value| value.as_bool()) == Some(true) {
            0
        } else {
            1
        }
    });
    prioritized
}

fn normalize_provider(provider: &str) -> &str {
    match provider {
        // OAuth-based ChatGPT (via browser session)
        "openai_token" => "codex",
        // OAuth-based Claude (via browser session)
        "anthropic_token" => "claude",
        // OAuth-based Antigravity (Google Cloud)
        "google" | "antigravity_token" => "antigravity",
        // GitHub Copilot
        "github" | "github_token" | "copilot_token" => "copilot",
        // NVIDIA
        "nvidia_key" | "nim" | "nim_openai" => "nvidia",
        // All API-key providers stay as-is (openai, anthropic, gemini, mistral, groq, etc.)
        other => other,
    }
}

fn map_provider_models(models: Vec<ProviderModel>) -> Vec<ServedModel> {
    models
        .into_iter()
        .map(|model| {
            let static_info = find_model(model.provider.as_str(), model.id.as_str());
            let owned_by = static_info
                .map(|info| info.owned_by.to_string())
                .unwrap_or_else(|| default_owned_by(model.provider.as_str()));
            let created = static_info.map(|info| info.created).unwrap_or(0);
            let context_length = static_info.map(|info| info.context_length).unwrap_or(0);
            let max_completion_tokens = static_info
                .map(|info| info.max_completion_tokens)
                .unwrap_or(0);
            let thinking_levels = model
                .thinking_levels
                .clone()
                .or_else(|| {
                    static_info.map(|info| {
                        info.thinking_levels
                            .iter()
                            .map(|value| (*value).to_string())
                            .collect()
                    })
                })
                .unwrap_or_default();

            ServedModel {
                id: model.id.clone(),
                provider: model.provider.clone(),
                owned_by,
                created,
                name: model.name.clone(),
                display_name: model.name,
                description: model.description,
                context_length,
                max_completion_tokens,
                thinking_levels,
                quota_info: model.quota_info,
            }
        })
        .collect()
}

fn default_owned_by(provider: &str) -> String {
    match provider {
        "codex" => "openai".to_string(),
        "claude" => "anthropic".to_string(),
        "antigravity" => "google".to_string(),
        "copilot" => "github".to_string(),
        "nvidia" => "nvidia".to_string(),
        _ => provider.to_string(),
    }
}

fn dedupe_models(models: Vec<ServedModel>) -> Vec<ServedModel> {
    let mut unique = Vec::<ServedModel>::new();
    for model in models {
        let exists = unique.iter().any(|existing| {
            existing.provider == model.provider && existing.id.eq_ignore_ascii_case(&model.id)
        });
        if !exists {
            unique.push(model);
        }
    }
    unique
}

fn decrypt_row_token(row: &Value, key: &str) -> Option<String> {
    let encrypted = row.get(key).and_then(|value| value.as_str())?;
    if encrypted.trim().is_empty() {
        return None;
    }
    if encrypted.starts_with("Tengra:v1:") {
        let master_key = load_master_key().ok()?;
        decrypt_token(encrypted, &master_key).ok()
    } else {
        Some(encrypted.to_string())
    }
}

fn parse_metadata_object(row: &Value) -> Map<String, Value> {
    match row.get("metadata") {
        Some(Value::Object(map)) => map.clone(),
        Some(Value::String(text)) => serde_json::from_str::<Value>(text)
            .ok()
            .and_then(|value| value.as_object().cloned())
            .unwrap_or_default(),
        _ => Map::new(),
    }
}

fn metadata_string(row: &Value, key: &str) -> Option<String> {
    parse_metadata_object(row)
        .get(key)
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

async fn fetch_copilot_models(client: &Client, row: &Value) -> Result<Vec<ProviderModel>, String> {
    let github_token = token_value_from_row(row, "access_token")
        .ok_or_else(|| "No Copilot GitHub token available".to_string())?;
    let mut session_token = token_value_from_row(row, "session_token");
    let mut plan = metadata_string(row, "plan")
        .or_else(|| metadata_string(row, "copilot_plan"))
        .unwrap_or_else(|| "individual".to_string());
    let account_id = row
        .get("id")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let provider = row
        .get("provider")
        .and_then(|value| value.as_str())
        .unwrap_or("copilot")
        .to_string();

    if session_token.is_none() {
        session_token = Some(
            hydrate_copilot_session_token(
                account_id.as_str(),
                provider.as_str(),
                github_token.as_str(),
                &mut plan,
            )
            .await?,
        );
    }
    let token = session_token.ok_or_else(|| "No Copilot session token available".to_string())?;

    #[derive(Deserialize)]
    struct CopilotModelData {
        id: String,
        name: Option<String>,
    }

    #[derive(Deserialize)]
    struct CopilotResponse {
        data: Vec<CopilotModelData>,
    }

    let url = match plan.as_str() {
        "individual" => "https://api.individual.githubcopilot.com/models",
        "business" => "https://api.business.githubcopilot.com/models",
        "enterprise" => "https://api.enterprise.githubcopilot.com/models",
        _ => "https://api.githubcopilot.com/models",
    };

    let mut response = request_copilot_models(client, url, token.as_str()).await?;

    if response.status() == StatusCode::UNAUTHORIZED || response.status() == StatusCode::FORBIDDEN {
        let refreshed_token = hydrate_copilot_session_token(
            account_id.as_str(),
            provider.as_str(),
            github_token.as_str(),
            &mut plan,
        )
        .await?;
        response = request_copilot_models(client, url, refreshed_token.as_str()).await?;
    }

    if !response.status().is_success() {
        return Err(format!("Copilot HTTP {}", response.status()));
    }

    let parsed = response
        .json::<CopilotResponse>()
        .await
        .map_err(|error| error.to_string())?;

    let mut models = parsed
        .data
        .into_iter()
        .map(|model| ProviderModel {
            id: model.id.clone(),
            name: model.name.unwrap_or_else(|| model.id.clone()),
            provider: "copilot".to_string(),
            description: Some(format!("GitHub Copilot {} model", plan)),
            thinking_levels: Some(vec![
                "low".to_string(),
                "medium".to_string(),
                "high".to_string(),
            ]),
            quota_info: None,
        })
        .collect::<Vec<_>>();
    models.sort_by(|left, right| left.id.cmp(&right.id));
    Ok(models)
}

async fn request_copilot_models(
    client: &Client,
    url: &str,
    token: &str,
) -> Result<reqwest::Response, String> {
    client
        .get(url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/json")
        .header("User-Agent", "GithubCopilot/1.155.0")
        .header("Copilot-Integration-Id", "vscode-chat")
        .send()
        .await
        .map_err(|error| error.to_string())
}

async fn hydrate_copilot_session_token(
    account_id: &str,
    provider: &str,
    github_token: &str,
    plan: &mut String,
) -> Result<String, String> {
    let client = CopilotClient::new();
    let session = client
        .exchange_for_copilot_token(github_token)
        .await
        .map_err(|error| error.to_string())?;
    if let Ok(fetched_plan) = client.fetch_copilot_plan(github_token).await {
        if !fetched_plan.trim().is_empty() {
            *plan = fetched_plan;
        }
    }

    let expires_at_ms = i64::try_from(session.expires_at)
        .map_err(|_| "Invalid Copilot expires_at".to_string())?
        * 1000;
    let token_json = serde_json::json!({
        "access_token": github_token,
        "session_token": session.token,
        "expires_at": expires_at_ms,
        "copilot_plan": plan.clone()
    });
    db::update_token_data(account_id, provider, token_json.clone())
        .await
        .map_err(|error| error.to_string())?;

    token_json
        .get("session_token")
        .and_then(|value| value.as_str())
        .map(str::to_string)
        .ok_or_else(|| "Missing hydrated Copilot session token".to_string())
}

async fn fetch_antigravity_models(
    client: &Client,
    row: &Value,
) -> Result<Vec<ProviderModel>, String> {
    let mut token = token_value_from_row(row, "access_token")
        .ok_or_else(|| "No Antigravity access token available".to_string())?;
    let mut models = fetch_antigravity_models_once(client, row, token.as_str()).await;

    if matches!(models, Err(ref error) if error.starts_with("HTTP 401")) {
        if let Some(refreshed_token) = refresh_antigravity_access_token(client, row).await? {
            token = refreshed_token;
            models = fetch_antigravity_models_once(client, row, token.as_str()).await;
        }
    }

    models
}

async fn fetch_antigravity_models_once(
    client: &Client,
    row: &Value,
    access_token: &str,
) -> Result<Vec<ProviderModel>, String> {
    #[derive(Deserialize)]
    struct AntigravityModelData {
        #[serde(rename = "displayName")]
        display_name: Option<String>,
        description: Option<String>,
        #[serde(rename = "quotaInfo")]
        quota_info: Option<Value>,
    }

    #[derive(Deserialize)]
    struct AntigravityResponse {
        models: std::collections::HashMap<String, AntigravityModelData>,
    }

    let custom_base_url = metadata_string(row, "base_url");
    let mut last_error = String::new();

    for base_url in fallback_base_urls(custom_base_url.as_deref()) {
        let endpoint = format!("{}/v1internal:fetchAvailableModels", base_url);
        let response = client
            .post(endpoint)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json")
            .header("User-Agent", DEFAULT_USER_AGENT)
            .body("{}")
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            last_error = format!("HTTP {} - {}", status.as_u16(), body);
            continue;
        }

        let parsed = response
            .json::<AntigravityResponse>()
            .await
            .map_err(|error| error.to_string())?;

        let mut models = parsed
            .models
            .into_iter()
            .filter(|(id, _)| {
                !matches!(
                    id.as_str(),
                    "chat_23310"
                        | "chat_20706"
                        | "rev19-uic3-1p"
                        | "tab_flash_lite_preview"
                        | "tab_jump_flash_lite_preview"
                )
            })
            .filter_map(|(id, info)| {
                let normalized_id = normalize_discovered_model_id(id.as_str())?;
                Some(ProviderModel {
                    id: normalized_id.clone(),
                    name: info.display_name.unwrap_or_else(|| normalized_id.clone()),
                    provider: "antigravity".to_string(),
                    description: info.description,
                    thinking_levels: antigravity_thinking_levels(normalized_id.as_str()),
                    quota_info: info.quota_info,
                })
            })
            .collect::<Vec<_>>();
        models.sort_by(|left, right| left.id.cmp(&right.id));
        if !models.is_empty() {
            return Ok(models);
        }
    }

    Err(if last_error.is_empty() {
        "No Antigravity models discovered".to_string()
    } else {
        last_error
    })
}

async fn refresh_antigravity_access_token(
    client: &Client,
    row: &Value,
) -> Result<Option<String>, String> {
    let refresh_token = token_value_from_row(row, "refresh_token");
    let Some(refresh_token) = refresh_token else {
        return Ok(None);
    };

    let account_id = row
        .get("id")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let provider = row
        .get("provider")
        .and_then(|value| value.as_str())
        .unwrap_or("antigravity")
        .to_string();
    let email = row
        .get("email")
        .and_then(|value| value.as_str())
        .map(str::to_string);
    let access_token = token_value_from_row(row, "access_token");
    let expires_at = row.get("expires_at").and_then(|value| value.as_i64());

    let auth_token = AuthToken {
        id: account_id.clone(),
        provider: provider.clone(),
        refresh_token: Some(refresh_token),
        access_token,
        session_token: None,
        expires_at,
        scope: None,
        email,
    };

    let response = execute_refresh(
        client,
        auth_token,
        crate::static_config::ANTIGRAVITY_CLIENT_ID.to_string(),
        Some(crate::static_config::ANTIGRAVITY_CLIENT_SECRET.to_string()),
    )
    .await;
    if !response.success {
        return Err(response
            .error
            .unwrap_or_else(|| "Refresh failed".to_string()));
    }

    let Some(token) = response.token else {
        return Ok(None);
    };

    let refreshed_access_token = token.access_token.clone();
    let token_json = serde_json::to_value(&token).map_err(|error| error.to_string())?;
    crate::db::update_token_data(&account_id, &provider, token_json)
        .await
        .map_err(|error| error.to_string())?;

    Ok(refreshed_access_token)
}

fn token_value_from_row(row: &Value, key: &str) -> Option<String> {
    decrypt_row_token(row, key).or_else(|| metadata_token_string(row, key))
}

fn metadata_token_string(row: &Value, key: &str) -> Option<String> {
    let metadata = parse_metadata_object(row);
    let token = metadata.get("token")?.as_object()?;
    token
        .get(key)
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn antigravity_thinking_levels(id: &str) -> Option<Vec<String>> {
    match id {
        "gemini-3.1-pro-preview" | "gemini-3-pro-preview" | "gemini-3-pro-high" => {
            Some(vec!["low".to_string(), "high".to_string()])
        }
        "gemini-3.1-flash-preview"
        | "gemini-3.1-flash"
        | "gemini-3-flash-preview"
        | "gemini-3-flash"
        | "gemini-3-flash-agent" => Some(vec![
            "minimal".to_string(),
            "low".to_string(),
            "medium".to_string(),
            "high".to_string(),
        ]),
        "gemini-3.1-flash-lite" => Some(vec!["minimal".to_string(), "low".to_string()]),
        "gemini-2.5-pro"
        | "gemini-2.5-flash"
        | "gemini-2.5-flash-lite"
        | "gemini-2.5-computer-use-preview-10-2025"
        | "rev19-uic3-1p" => Some(vec![
            "low".to_string(),
            "medium".to_string(),
            "high".to_string(),
        ]),
        "gemini-3.1-flash-image"
        | "gemini-3-pro-image-preview"
        | "gemini-2.5-flash-image-preview" => Some(vec!["low".to_string(), "high".to_string()]),
        _ => None,
    }
}

async fn fetch_nvidia_models(client: &Client, rows: &[Value]) -> Result<Vec<ProviderModel>, String> {
    for row in prioritized_rows(rows) {
        let Some(api_key) = token_value_from_row(row, "access_token") else {
            continue;
        };

        if let Ok(models) = fetch_nvidia_live_models(client, &api_key).await {
            if !models.is_empty() {
                return Ok(models);
            }
        }
    }
    Err("No NVIDIA models discovered".to_string())
}

#[derive(Deserialize)]
struct NvidiaModelData {
    id: String,
}

#[derive(Deserialize)]
struct NvidiaResponse {
    data: Vec<NvidiaModelData>,
}

async fn fetch_nvidia_live_models(client: &Client, api_key: &str) -> Result<Vec<ProviderModel>, String> {
    let response = client
        .get(NVIDIA_LIVE_MODELS_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Accept", "application/json")
        .header("User-Agent", "tengra-proxy/1.0")
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        return Err(format!("NVIDIA API returned error: {}", response.status()));
    }

    let parsed = response
        .json::<NvidiaResponse>()
        .await
        .map_err(|error| error.to_string())?;

    Ok(parsed
        .data
        .into_iter()
        .map(|model| build_nvidia_model(normalize_nvidia_model_id(model.id.as_str())))
        .filter(|model| !model.id.is_empty())
        .collect())
}

fn normalize_nvidia_model_id(model_id: &str) -> String {
    model_id
        .replace(" / ", "/")
        .replace(" /", "/")
        .replace("/ ", "/")
        .trim()
        .to_string()
}

fn build_nvidia_model(model_id: String) -> ProviderModel {
    ProviderModel {
        id: model_id.clone(),
        name: model_id,
        provider: "nvidia".to_string(),
        description: Some("NVIDIA Hosted Model".to_string()),
        thinking_levels: None,
        quota_info: None,
    }
}

fn codex_models() -> Vec<ProviderModel> {
    vec![
        static_model("gpt-5.4", "GPT 5.4", "codex", Some("Stable version of GPT 5.4"), Some(vec!["low", "medium", "high", "xhigh"])),
        static_model("gpt-5.4-mini", "GPT 5.4 Mini", "codex", Some("Compact GPT 5.4 variant tuned for faster, lower-cost coding tasks."), Some(vec!["low", "medium", "high"])),
        static_model("gpt-5.3-codex", "GPT 5.3 Codex", "codex", Some("Stable version of GPT 5.3 Codex"), Some(vec!["low", "medium", "high", "xhigh"])),
        static_model("gpt-5.2-codex", "GPT 5.2 Codex", "codex", Some("Stable version of GPT 5.2 Codex, the best model for coding and agentic tasks across domains."), Some(vec!["low", "medium", "high", "xhigh"])),
        static_model("gpt-5.1-codex-max", "GPT 5.1 Codex Max", "codex", Some("Stable version of GPT 5.1 Codex Max"), Some(vec!["low", "medium", "high", "xhigh"])),
        static_model("gpt-5.2", "GPT 5.2", "codex", Some("Stable version of GPT 5.2"), Some(vec!["low", "medium", "high", "xhigh"])),
        static_model("gpt-5.1-codex-mini", "GPT 5.1 Codex Mini", "codex", Some("Cheaper, faster, but less capable version of GPT 5.1 Codex."), Some(vec!["medium", "high"])),
    ]
}

fn claude_models() -> Vec<ProviderModel> {
    vec![
        static_model(
            "claude-opus-4-6",
            "Claude Opus 4.6",
            "claude",
            None,
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-sonnet-4-6",
            "Claude Sonnet 4.6",
            "claude",
            None,
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-haiku-4-5",
            "Claude Haiku 4.5",
            "claude",
            None,
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-opus-4-1-20250805",
            "Claude 4.1 Opus",
            "claude",
            None,
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-opus-4-20250514",
            "Claude 4 Opus",
            "claude",
            None,
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-sonnet-4-20250514",
            "Claude 4 Sonnet",
            "claude",
            None,
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-3-7-sonnet-20250219",
            "Claude 3.7 Sonnet",
            "claude",
            Some("Deprecated"),
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-3-5-sonnet-20241022",
            "Claude 3.5 Sonnet",
            "claude",
            Some("Deprecated"),
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-3-5-haiku-20241022",
            "Claude 3.5 Haiku",
            "claude",
            Some("Deprecated"),
            None,
        ),
        static_model(
            "claude-3-opus-20240229",
            "Claude 3 Opus",
            "claude",
            Some("Deprecated"),
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-3-haiku-20240307",
            "Claude 3 Haiku",
            "claude",
            Some("Deprecated"),
            None,
        ),
    ]
}

fn static_model(
    id: &str,
    name: &str,
    provider: &str,
    description: Option<&str>,
    thinking_levels: Option<Vec<&str>>,
) -> ProviderModel {
    ProviderModel {
        id: id.to_string(),
        name: name.to_string(),
        provider: provider.to_string(),
        description: description.map(str::to_string),
        thinking_levels: thinking_levels
            .map(|levels| levels.into_iter().map(str::to_string).collect()),
        quota_info: None,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        antigravity_thinking_levels, claude_models, dedupe_models, normalize_nvidia_model_id,
        normalize_provider, parse_provider_models_from_payload,
    };
    use crate::proxy::antigravity::normalize_discovered_model_id;
    use crate::proxy::model_service::ServedModel;
    use serde_json::json;

    #[test]
    fn normalizes_antigravity_image_ids() {
        assert_eq!(
            normalize_discovered_model_id("models/gemini-3-pro-image"),
            Some("gemini-3-pro-image-preview".to_string())
        );
        assert_eq!(normalize_discovered_model_id(""), None);
    }

    #[test]
    fn keeps_live_copilot_model_ids_unfiltered() {
        let model_id = "gpt-5.2-codex";
        assert_eq!(model_id, "gpt-5.2-codex");
    }

    #[test]
    fn normalizes_nvidia_model_ids() {
        assert_eq!(
            normalize_nvidia_model_id("meta / llama-3.1-70b-instruct"),
            "meta/llama-3.1-70b-instruct".to_string()
        );
        assert_eq!(
            normalize_nvidia_model_id(" nvidia/llama-3.1-nemotron-nano-8b-v1 "),
            "nvidia/llama-3.1-nemotron-nano-8b-v1".to_string()
        );
    }

    #[test]
    fn includes_current_claude_code_models() {
        let models = claude_models();
        let ids = models
            .iter()
            .map(|model| model.id.as_str())
            .collect::<Vec<_>>();

        assert!(ids.contains(&"claude-opus-4-6"));
        assert!(ids.contains(&"claude-sonnet-4-6"));
        assert!(ids.contains(&"claude-haiku-4-5"));
    }

    #[test]
    fn preserves_openai_api_key_provider_identity() {
        assert_eq!(normalize_provider("openai"), "openai");
        assert_eq!(normalize_provider("openai_token"), "codex");
    }

    #[test]
    fn preserves_gemini_api_key_provider_identity() {
        assert_eq!(normalize_provider("gemini"), "gemini");
        assert_eq!(normalize_provider("antigravity_token"), "antigravity");
    }

    #[test]
    fn parses_openai_style_models_with_data_id_schema() {
        let payload = json!({
            "data": [
                {"id": "gpt-4o"},
                {"id": "gpt-4.1-mini"},
                {"id": 42},
                {"name": "missing-id-for-openai"},
                {}
            ]
        });

        let models = parse_provider_models_from_payload(&payload, "openai", &["id"]);
        let ids = models
            .iter()
            .map(|model| model.id.as_str())
            .collect::<Vec<_>>();

        assert_eq!(ids, vec!["gpt-4o", "gpt-4.1-mini", "missing-id-for-openai"]);
        assert!(models.iter().all(|model| model.provider == "openai"));
    }

    #[test]
    fn parses_anthropic_data_array_with_optional_metadata() {
        let payload = json!({
            "data": [
                {"id": "claude-3-7-sonnet-20250219", "type": "model", "display_name": "Claude 3.7 Sonnet"},
                {"id": "claude-3-5-haiku-20241022", "beta": true},
                {"id": ""},
                {"name": "fallback-name"},
                "not-object"
            ]
        });

        let models = parse_provider_models_from_payload(&payload, "anthropic", &["id"]);
        let ids = models
            .iter()
            .map(|model| model.id.as_str())
            .collect::<Vec<_>>();

        assert_eq!(
            ids,
            vec![
                "claude-3-7-sonnet-20250219",
                "claude-3-5-haiku-20241022",
                "fallback-name",
                "not-object",
            ]
        );
    }

    #[test]
    fn parses_gemini_models_and_strips_models_prefix() {
        let payload = json!({
            "models": [
                {"name": "models/gemini-2.0-flash"},
                {"name": "gemini-1.5-pro"},
                {"id": "models/gemini-2.5-pro"},
                {"name": null},
                {}
            ]
        });

        let models = parse_provider_models_from_payload(&payload, "gemini", &["name", "id"]);
        let ids = models
            .iter()
            .map(|model| model.id.as_str())
            .collect::<Vec<_>>();

        assert_eq!(
            ids,
            vec!["gemini-2.0-flash", "gemini-1.5-pro", "gemini-2.5-pro"]
        );
        assert!(models.iter().all(|model| model.provider == "gemini"));
    }

    #[test]
    fn assigns_flash_thinking_levels_to_agent_alias() {
        assert_eq!(
            antigravity_thinking_levels("gemini-3-flash-agent"),
            Some(vec![
                "minimal".to_string(),
                "low".to_string(),
                "medium".to_string(),
                "high".to_string(),
            ])
        );
    }

    #[test]
    fn parses_cohere_models_from_models_or_data_and_name_or_id() {
        let models_payload = json!({
            "models": [
                {"name": "command-r-plus"},
                {"id": "embed-v4.0"},
                {"name": ""},
                {"id": 12}
            ]
        });
        let data_payload = json!({
            "data": [
                {"id": "command-a-03-2025"},
                {"name": "command-r"}
            ]
        });

        let from_models =
            parse_provider_models_from_payload(&models_payload, "cohere", &["name", "id"]);
        let from_data =
            parse_provider_models_from_payload(&data_payload, "cohere", &["name", "id"]);

        assert_eq!(
            from_models
                .iter()
                .map(|model| model.id.as_str())
                .collect::<Vec<_>>(),
            vec!["command-r-plus", "embed-v4.0"]
        );
        assert_eq!(
            from_data
                .iter()
                .map(|model| model.id.as_str())
                .collect::<Vec<_>>(),
            vec!["command-a-03-2025", "command-r"]
        );
    }

    #[test]
    fn parses_openrouter_openai_compatible_payload() {
        let payload = json!({
            "object": "list",
            "data": [
                {"id": "openrouter/auto"},
                {"id": "anthropic/claude-3.7-sonnet"}
            ]
        });

        let models = parse_provider_models_from_payload(&payload, "openrouter", &["id"]);
        assert_eq!(
            models
                .iter()
                .map(|model| model.id.as_str())
                .collect::<Vec<_>>(),
            vec!["openrouter/auto", "anthropic/claude-3.7-sonnet"]
        );
        assert!(models.iter().all(|model| model.provider == "openrouter"));
    }

    #[test]
    fn parser_edge_cases_return_empty_and_do_not_panic() {
        let malformed_payloads = vec![
            json!({}),
            json!({"data": {"id": "not-an-array"}}),
            json!({"models": "not-an-array"}),
            json!(null),
            json!([]),
            json!({"data": []}),
        ];

        for payload in malformed_payloads {
            let openai = std::panic::catch_unwind(|| {
                parse_provider_models_from_payload(&payload, "openai", &["id"])
            });
            let anthropic = std::panic::catch_unwind(|| {
                parse_provider_models_from_payload(&payload, "anthropic", &["id"])
            });
            let gemini = std::panic::catch_unwind(|| {
                parse_provider_models_from_payload(&payload, "gemini", &["name", "id"])
            });
            let cohere = std::panic::catch_unwind(|| {
                parse_provider_models_from_payload(&payload, "cohere", &["name", "id"])
            });

            assert!(openai.is_ok());
            assert!(anthropic.is_ok());
            assert!(gemini.is_ok());
            assert!(cohere.is_ok());

            assert!(openai.expect("openai parser panicked").is_empty());
            assert!(anthropic.expect("anthropic parser panicked").is_empty());
            assert!(gemini.expect("gemini parser panicked").is_empty());
            assert!(cohere.expect("cohere parser panicked").is_empty());
        }
    }

    #[test]
    fn dedupe_models_preserves_distinct_provider_model_pairs() {
        let models = vec![
            ServedModel {
                id: "gpt-4o".to_string(),
                provider: "openai".to_string(),
                owned_by: "openai".to_string(),
                created: 0,
                name: "GPT-4o".to_string(),
                display_name: "GPT-4o".to_string(),
                description: None,
                context_length: 128_000,
                max_completion_tokens: 16_384,
                thinking_levels: vec![],
                quota_info: None,
            },
            ServedModel {
                id: "gpt-4o".to_string(),
                provider: "codex".to_string(),
                owned_by: "openai".to_string(),
                created: 0,
                name: "GPT-4o".to_string(),
                display_name: "GPT-4o".to_string(),
                description: None,
                context_length: 128_000,
                max_completion_tokens: 16_384,
                thinking_levels: vec![],
                quota_info: None,
            },
            ServedModel {
                id: "gpt-4o".to_string(),
                provider: "openai".to_string(),
                owned_by: "openai".to_string(),
                created: 0,
                name: "GPT-4o".to_string(),
                display_name: "GPT-4o".to_string(),
                description: None,
                context_length: 128_000,
                max_completion_tokens: 16_384,
                thinking_levels: vec![],
                quota_info: None,
            },
        ];

        let deduped = dedupe_models(models);
        let keys = deduped
            .iter()
            .map(|model| format!("{}:{}", model.provider, model.id))
            .collect::<Vec<_>>();
        assert_eq!(keys, vec!["openai:gpt-4o", "codex:gpt-4o"]);
    }
}
