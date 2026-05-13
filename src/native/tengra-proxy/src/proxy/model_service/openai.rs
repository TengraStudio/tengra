/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use super::static_models::is_supported_codex_model_id;
use super::support::{
    metadata_string, parse_provider_models_from_payload, prioritized_rows, token_value_from_row,
};
use super::ServedModel;
use reqwest::Client;
use serde_json::Value;

pub(super) async fn fetch_openai_style_models(
    client: &Client,
    rows: &[Value],
    url: &str,
    provider: &str,
) -> Vec<ServedModel> {
    for row in prioritized_rows(rows) {
        let Some(api_key) = token_value_from_row(row, "access_token") else {
            continue;
        };
        let organization = metadata_string(row, "organization");

        let mut request = client
            .get(url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Accept", "application/json")
            .header("User-Agent", "tengra-proxy/1.0");

        if let Some(org) = organization {
            request = request.header("OpenAI-Organization", org);
        }

        let response = match request.send().await {
            Ok(res) => res,
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
            return models;
        }
    }
    Vec::new()
}

pub(super) async fn fetch_codex_models(
    client: &Client,
    rows: &[Value],
) -> Result<Vec<ServedModel>, String> {
    let models =
        fetch_openai_style_models(client, rows, "https://api.openai.com/v1/models", "codex").await;
    Ok(models
        .into_iter()
        .filter(|m| is_supported_codex_model_id(&m.id))
        .collect())
}
