/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use super::static_models::antigravity_thinking_levels;
use super::support::{prioritized_rows, token_value_from_row};
use super::ProviderModel;
use crate::proxy::antigravity::{
    fallback_base_urls, normalize_discovered_model_id, DEFAULT_USER_AGENT,
};
use crate::token::refresh::{execute_refresh, AuthToken};
use reqwest::{Client, StatusCode};
use serde_json::Value;

pub(super) async fn fetch_antigravity_models(
    client: &Client,
    rows: &[Value],
) -> Result<Vec<ProviderModel>, String> {
    for row in prioritized_rows(rows) {
        let Some(access_token) = token_value_from_row(row, "access_token") else {
            continue;
        };

        match fetch_antigravity_models_once(client, row, &access_token).await {
            Ok(models) => return Ok(models),
            Err(e) if e.contains("401") || e.contains("unauthorized") => {
                // Try refresh
                if let Ok(refreshed) = refresh_antigravity_access_token(client, row).await {
                    if let Ok(models) = fetch_antigravity_models_once(client, row, &refreshed).await
                    {
                        return Ok(models);
                    }
                }
            }
            _ => continue,
        }
    }
    Err("No Antigravity models discovered".to_string())
}

async fn fetch_antigravity_models_once(
    client: &Client,
    row: &Value,
    access_token: &str,
) -> Result<Vec<ProviderModel>, String> {
    use super::support::metadata_string;

    let custom_base_url = metadata_string(row, "base_url");

    for base_url in fallback_base_urls(custom_base_url.as_deref()) {
        let url = format!("{}/v1beta/models", base_url);
        let response = client
            .get(url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("User-Agent", DEFAULT_USER_AGENT)
            .send()
            .await;

        let response = match response {
            Ok(res) => res,
            Err(_) => continue,
        };

        if !response.status().is_success() {
            let status = response.status();
            if status == StatusCode::UNAUTHORIZED {
                return Err("401 unauthorized".to_string());
            }
            continue;
        }

        let body = match response.json::<Value>().await {
            Ok(body) => body,
            Err(_) => continue,
        };

        let Some(models_array) = body.get("models").and_then(|v| v.as_array()) else {
            continue;
        };

        return Ok(models_array
            .iter()
            .filter_map(|m| {
                let id_raw = m.get("name").and_then(|v| v.as_str())?;
                let id = normalize_discovered_model_id(id_raw)?;
                let display_name = m.get("displayName").and_then(|v| v.as_str()).unwrap_or(&id);
                let description = m.get("description").and_then(|v| v.as_str());

                Some(ProviderModel {
                    id: id.clone(),
                    name: display_name.to_string(),
                    provider: "antigravity".to_string(),
                    description: description.map(|s| s.to_string()),
                    thinking_levels: antigravity_thinking_levels(&id),
                    quota_info: m.get("quotaInfo").cloned(),
                })
            })
            .collect());
    }
    Err("Failed to fetch Antigravity models from all base URLs".to_string())
}

async fn refresh_antigravity_access_token(client: &Client, row: &Value) -> Result<String, String> {
    let account_id = row
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "No account ID for refresh".to_string())?;
    let provider = row
        .get("provider")
        .and_then(|v| v.as_str())
        .unwrap_or("antigravity");
    let refresh_token = token_value_from_row(row, "refresh_token")
        .ok_or_else(|| "No refresh token available".to_string())?;

    let auth_token = AuthToken {
        id: account_id.to_string(),
        provider: provider.to_string(),
        refresh_token: Some(refresh_token),
        access_token: token_value_from_row(row, "access_token"),
        session_token: None,
        expires_at: row.get("expires_at").and_then(|v| v.as_i64()),
        scope: None,
        email: row
            .get("email")
            .and_then(|v| v.as_str())
            .map(str::to_string),
    };

    let refreshed = execute_refresh(
        client,
        auth_token,
        crate::static_config::ANTIGRAVITY_CLIENT_ID.to_string(),
        Some(crate::static_config::ANTIGRAVITY_CLIENT_SECRET.to_string()),
    )
    .await;

    if !refreshed.success {
        return Err(refreshed
            .error
            .unwrap_or_else(|| "Refresh failed".to_string()));
    }

    let token = refreshed
        .token
        .ok_or_else(|| "No token in refresh response".to_string())?;
    let access_token = token
        .access_token
        .clone()
        .ok_or_else(|| "No access token in refresh response".to_string())?;

    let token_json = serde_json::to_value(&token).map_err(|e| e.to_string())?;

    crate::db::update_token_data(account_id, provider, token_json)
        .await
        .map_err(|e| e.to_string())?;

    Ok(access_token)
}
