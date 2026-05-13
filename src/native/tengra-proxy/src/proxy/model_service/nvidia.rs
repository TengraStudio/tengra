/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use super::support::{prioritized_rows, token_value_from_row};
use super::ProviderModel;
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;

pub(super) const NVIDIA_LIVE_MODELS_URL: &str = "https://integrate.api.nvidia.com/v1/models";

pub(super) async fn fetch_nvidia_models(
    client: &Client,
    rows: &[Value],
) -> Result<Vec<ProviderModel>, String> {
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

async fn fetch_nvidia_live_models(
    client: &Client,
    api_key: &str,
) -> Result<Vec<ProviderModel>, String> {
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
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_nvidia_model_ids_correctly() {
        assert_eq!(
            normalize_nvidia_model_id("meta / llama-3.1-405b-instruct"),
            "meta/llama-3.1-405b-instruct"
        );
        assert_eq!(
            normalize_nvidia_model_id("meta/llama-3.1-405b-instruct "),
            "meta/llama-3.1-405b-instruct"
        );
        assert_eq!(
            normalize_nvidia_model_id(" nvidia / mixtral-8x7b-instruct-v0.1"),
            "nvidia/mixtral-8x7b-instruct-v0.1"
        );
    }
}
