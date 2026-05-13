/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use super::support::{parse_provider_models_from_payload, prioritized_rows, token_value_from_row};
use super::ServedModel;
use reqwest::Client;
use serde_json::Value;

pub(super) async fn fetch_gemini_models(
    client: &Client,
    rows: &[Value],
) -> Result<Vec<ServedModel>, String> {
    for row in prioritized_rows(rows) {
        let Some(api_key) = token_value_from_row(row, "access_token") else {
            continue;
        };

        let response = client
            .get("https://generativelanguage.googleapis.com/v1beta/models")
            .query(&[("key", &api_key)])
            .header("Accept", "application/json")
            .header("User-Agent", "tengra-proxy/1.0")
            .send()
            .await;

        let response = match response {
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
        let mut models = parse_provider_models_from_payload(&body, "gemini", &["name", "id"]);
        models.sort_by(|left, right| left.id.cmp(&right.id));
        if !models.is_empty() {
            return Ok(models);
        }
    }
    Ok(Vec::new())
}
