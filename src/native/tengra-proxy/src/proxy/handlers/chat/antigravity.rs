/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::proxy::handlers::chat::support::parse_metadata_map;
use axum::{http::StatusCode, Json};
use serde_json::{json, Value};
use tokio::time::{sleep, Duration};

pub async fn execute_antigravity_request<F, Fut>(
    active_key_row: &Value,
    send_request: F,
) -> Result<reqwest::Response, (StatusCode, Json<serde_json::Value>)>
where
    F: Fn(Option<&str>) -> Fut,
    Fut: std::future::Future<
        Output = Result<reqwest::Response, (StatusCode, Json<serde_json::Value>)>,
    >,
{
    let base_url = parse_metadata_map(active_key_row.get("metadata").unwrap_or(&Value::Null))
        .and_then(|metadata| {
            metadata
                .get("base_url")
                .and_then(Value::as_str)
                .map(str::to_string)
        });
    let mut last_error = None;

    for candidate in crate::proxy::antigravity::fallback_base_urls(base_url.as_deref()) {
        let res = send_request(Some(candidate.as_str())).await;

        match res {
            Ok(response) => {
                if response.status() == StatusCode::TOO_MANY_REQUESTS {
                    // Upstream rate limit. Wait 2.2s and retry once.
                    sleep(Duration::from_millis(2200)).await;
                    let retry_res = send_request(Some(candidate.as_str())).await;
                    if let Ok(retry_response) = retry_res {
                        if retry_response.status().is_success() {
                            return Ok(retry_response);
                        }
                        last_error = Some((
                            retry_response.status(),
                            Json(json!({"error": retry_response.text().await.unwrap_or_default()})),
                        ));
                    }
                } else if response.status().is_success() {
                    return Ok(response);
                } else if response.status() == StatusCode::UNAUTHORIZED {
                    // We don't have enough info here to refresh, let the caller handle it or
                    // we could pass more info. But the original logic had it nested.
                    // For now, return the error and let the caller decide.
                    last_error = Some((
                        response.status(),
                        Json(json!({"error": response.text().await.unwrap_or_default()})),
                    ));
                } else {
                    last_error = Some((
                        response.status(),
                        Json(json!({"error": response.text().await.unwrap_or_default()})),
                    ));
                }
            }
            Err(error) => {
                last_error = Some(error);
            }
        }
    }

    Err(last_error.unwrap_or_else(|| {
        (
            StatusCode::BAD_GATEWAY,
            Json(json!({"error": "No Antigravity upstream endpoint succeeded"})),
        )
    }))
}

pub async fn resolve_antigravity_project_id(
    auth_token: &str,
    active_key_row: &Value,
) -> Result<String, (StatusCode, Json<serde_json::Value>)> {
    if let Some(project_id) = antigravity_project_from_row(active_key_row) {
        return Ok(project_id);
    }

    let client = crate::auth::antigravity::client::AntigravityClient::new(None)
        .await
        .map_err(|error| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to initialize Antigravity OAuth client: {}", error)})),
            )
        })?;
    let context = client
        .discover_project_context(auth_token)
        .await
        .map_err(|error| {
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("Failed to resolve Antigravity project: {}", error)})),
            )
        })?;
    let project_id = client
        .ensure_onboarded(auth_token, &context)
        .await
        .map_err(|error| {
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("Failed to resolve Antigravity project: {}", error)})),
            )
        })?;

    if let Some(account_id) = active_key_row.get("id").and_then(Value::as_str) {
        let _ = crate::db::merge_metadata_patch(
            account_id,
            "antigravity",
            json!({ "project_id": project_id, "tier_id": context.tier_id }),
        )
        .await;
    }

    Ok(project_id)
}

pub fn antigravity_project_from_row(active_key_row: &Value) -> Option<String> {
    let metadata = active_key_row
        .get("metadata")
        .and_then(parse_metadata_map)
        .unwrap_or_default();
    metadata
        .get("project_id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != "auto")
        .map(str::to_string)
}
