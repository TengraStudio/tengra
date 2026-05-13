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
use crate::auth::cursor::client::CursorClient;
use reqwest::Client;
use serde_json::Value;

pub(super) async fn fetch_cursor_models(
    _client: &Client,
    rows: &[Value],
) -> Result<Vec<ServedModel>, String> {
    for row in prioritized_rows(rows) {
        let Some(token) = token_value_from_row(row, "access_token") else {
            continue;
        };

        let cursor_client = CursorClient::new();
        let body = match cursor_client.fetch_available_models(&token).await {
            Ok(body) => body,
            Err(e) => {
                eprintln!("[WARN] Cursor AvailableModels fetch failed: {}", e);
                continue;
            }
        };

        let mut models = parse_provider_models_from_payload(&body, "cursor", &["id", "name"]);
        models.sort_by(|left, right| left.id.cmp(&right.id));

        if !models.is_empty() {
            eprintln!(
                "[INFO] Cursor AvailableModels: fetched {} models from API",
                models.len()
            );
            return Ok(models);
        }
    }
    Ok(Vec::new())
}
