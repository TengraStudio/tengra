/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use super::{generate_session_key, get_upstream_url, headers, parse_metadata_map, request, stream};
use crate::proxy::server::AppState;
use crate::proxy::types::ChatCompletionRequest;
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{sse::Sse, IntoResponse, Response},
    Json,
};
use bytes::Buf;
use reqwest::Client;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

static CURSOR_HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

pub(super) async fn execute_cursor_request(
    _state: State<Arc<AppState>>,
    auth_token: &str,
    active_key_row: &Value,
    payload: &ChatCompletionRequest,
    request_body: &Value,
) -> Result<reqwest::Response, (StatusCode, Json<serde_json::Value>)> {
    let (ids, _) = resolve_cursor_ids(active_key_row, None);
    let res = send_cursor_upstream_request(&ids, auth_token, active_key_row, payload, request_body)
        .await?;

    if res.status() == StatusCode::UNAUTHORIZED {
        if let Some(retry_response) =
            retry_cursor_after_refresh(active_key_row, payload, request_body).await?
        {
            return Ok(retry_response);
        }
    }

    Ok(res)
}

pub(super) async fn handle_cursor_completions(
    state: State<Arc<AppState>>,
    headers_map: HeaderMap,
    payload: ChatCompletionRequest,
    auth_token: &str,
    active_key_row: &Value,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let request_body = json!(request::translate_cursor(&payload));
    let override_machine_id = headers_map
        .get("x-test-cursor-machine-id")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let ((machine_id, mac_machine_id, sqm_id, dev_device_id), should_save) =
        resolve_cursor_ids(active_key_row, override_machine_id);
    let ids = (
        machine_id.clone(),
        mac_machine_id.clone(),
        sqm_id.clone(),
        dev_device_id.clone(),
    );

    if should_save {
        persist_cursor_ids(
            active_key_row,
            &machine_id,
            &mac_machine_id,
            &sqm_id,
            &dev_device_id,
        )
        .await?;
    }

    let response =
        send_cursor_upstream_request(&ids, auth_token, active_key_row, &payload, &request_body)
            .await?;

    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_default();
        return Err((
            status,
            Json(json!({"error": format!("Upstream Cursor error: {}", error_body)})),
        ));
    }

    if payload.stream {
        let session_key = generate_session_key(active_key_row, &payload);
        let is_sse = response
            .headers()
            .get("content-type")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.contains("text/event-stream"))
            .unwrap_or(false);

        let translated =
            stream::translate_cursor_stream(response.bytes_stream(), state, session_key, is_sse);
        Ok(Sse::new(translated).into_response())
    } else {
        let bytes = response.bytes().await.map_err(internal_error)?;
        let translated = translate_cursor_non_stream_response(&bytes, &payload.model);
        Ok((StatusCode::OK, Json(translated)).into_response())
    }
}

fn translate_cursor_non_stream_response(bytes: &[u8], model: &str) -> Value {
    if let Ok(val) = serde_json::from_slice::<Value>(bytes) {
        return crate::proxy::handlers::chat::response::translate_response("cursor", val);
    }

    let mut buffer = bytes::BytesMut::from(bytes);
    let mut content = String::new();
    while let Some((_flags, payload)) = take_next_cursor_frame(&mut buffer) {
        if let Ok(value) = serde_json::from_slice::<Value>(&payload) {
            if let Some(text) = value.get("text").and_then(Value::as_str) {
                content.push_str(text);
            }
            if let Some(choices) = value.get("choices").and_then(Value::as_array) {
                for choice in choices {
                    if let Some(delta) = choice.get("delta").and_then(Value::as_object) {
                        if let Some(text) = delta.get("content").and_then(Value::as_str) {
                            content.push_str(text);
                        }
                    }
                }
            }
        }
    }

    json!({
        "id": format!("chatcmpl-{}", uuid::Uuid::new_v4()),
        "object": "chat.completion",
        "created": chrono::Utc::now().timestamp(),
        "model": model,
        "choices": [{
            "index": 0,
            "message": { "role": "assistant", "content": content },
            "finish_reason": "stop"
        }],
        "usage": { "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0 }
    })
}

fn take_next_cursor_frame(buffer: &mut bytes::BytesMut) -> Option<(u8, Vec<u8>)> {
    if buffer.len() < 5 {
        return None;
    }
    let flags = buffer[0];
    let len = u32::from_be_bytes([buffer[1], buffer[2], buffer[3], buffer[4]]) as usize;
    if buffer.len() < 5 + len {
        return None;
    }
    buffer.advance(5);
    let payload = buffer.split_to(len).to_vec();
    Some((flags, payload))
}

fn cursor_http_client() -> &'static Client {
    CURSOR_HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .http1_only()
            .timeout(std::time::Duration::from_secs(600))
            .connect_timeout(std::time::Duration::from_secs(15))
            .pool_max_idle_per_host(8)
            .tcp_keepalive(std::time::Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

async fn retry_cursor_after_refresh(
    active_key_row: &Value,
    payload: &ChatCompletionRequest,
    request_body: &Value,
) -> Result<Option<reqwest::Response>, (StatusCode, Json<serde_json::Value>)> {
    let refreshed = crate::token::refresh_account_token(active_key_row)
        .await
        .map_err(|error| (StatusCode::BAD_GATEWAY, Json(json!({"error": error}))))?;

    let Some(token) = refreshed.and_then(|value| value.access_token) else {
        return Ok(None);
    };

    let (ids, _) = resolve_cursor_ids(active_key_row, None);
    let response =
        send_cursor_upstream_request(&ids, token.as_str(), active_key_row, payload, request_body)
            .await?;
    if response.status().is_success() {
        return Ok(Some(response));
    }
    Ok(None)
}

async fn send_cursor_upstream_request(
    ids: &(String, String, String, String),
    auth_token: &str,
    active_key_row: &Value,
    payload: &ChatCompletionRequest,
    request_body: &Value,
) -> Result<reqwest::Response, (StatusCode, Json<serde_json::Value>)> {
    let upstream_url = get_upstream_url("cursor", payload, active_key_row, None);
    let mut request_builder = cursor_http_client().post(upstream_url);
    request_builder = request_builder
        .header("Content-Type", "application/connect+json")
        .header("Accept", "application/connect+json")
        .header("Connect-Protocol-Version", "1");
    request_builder =
        headers::apply_cursor_headers(request_builder, &ids.0, &ids.1, &ids.2, &ids.3, auth_token);

    let body_bytes = serde_json::to_vec(request_body).unwrap();
    let mut full_body = Vec::with_capacity(body_bytes.len() + 5);
    full_body.push(0u8);
    full_body.extend_from_slice(&(body_bytes.len() as u32).to_be_bytes());
    full_body.extend_from_slice(&body_bytes);

    request_builder
        .body(full_body)
        .send()
        .await
        .map_err(internal_error)
}

async fn persist_cursor_ids(
    active_key_row: &Value,
    machine_id: &str,
    mac_machine_id: &str,
    sqm_id: &str,
    dev_device_id: &str,
) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    if let Some(account_id) = active_key_row.get("id").and_then(Value::as_str) {
        crate::db::merge_metadata_patch(
            account_id,
            "cursor",
            json!({
                "machineId": machine_id,
                "macMachineId": mac_machine_id,
                "sqmId": sqm_id,
                "devDeviceId": dev_device_id
            }),
        )
        .await
        .map_err(|error| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to persist Cursor IDs: {}", error)})),
            )
        })?;
    }
    Ok(())
}

fn resolve_cursor_ids(
    active_key_row: &Value,
    override_machine_id: Option<String>,
) -> ((String, String, String, String), bool) {
    if let Some(machine_id) = override_machine_id {
        return (
            (machine_id.clone(), machine_id, String::new(), String::new()),
            false,
        );
    }

    if let Some(ids) = cursor_ids_from_metadata(active_key_row) {
        return (ids, false);
    }

    if let Some(ids) = discover_local_cursor_ids() {
        return (ids, true);
    }

    (headers::generate_cursor_install_ids(), true)
}

fn cursor_ids_from_metadata(active_key_row: &Value) -> Option<(String, String, String, String)> {
    let metadata = active_key_row
        .get("metadata")
        .and_then(parse_metadata_map)?;
    let machine_id = metadata.get("machineId").and_then(Value::as_str)?;
    let mac_machine_id = metadata.get("macMachineId").and_then(Value::as_str)?;
    let sqm_id = metadata.get("sqmId").and_then(Value::as_str)?;
    let dev_device_id = metadata.get("devDeviceId").and_then(Value::as_str)?;

    if [machine_id, mac_machine_id, sqm_id, dev_device_id]
        .iter()
        .any(|value| value.is_empty())
    {
        return None;
    }

    Some((
        machine_id.to_string(),
        mac_machine_id.to_string(),
        sqm_id.to_string(),
        dev_device_id.to_string(),
    ))
}

fn discover_local_cursor_ids() -> Option<(String, String, String, String)> {
    for path in cursor_storage_paths() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(value) = serde_json::from_str::<Value>(&content) {
                let machine_id = value.get("telemetry.machineId").and_then(Value::as_str);
                let mac_machine_id = value.get("telemetry.macMachineId").and_then(Value::as_str);
                let sqm_id = value.get("telemetry.sqmId").and_then(Value::as_str);
                let dev_device_id = value.get("telemetry.devDeviceId").and_then(Value::as_str);

                if let (Some(machine_id), Some(mac_machine_id), Some(sqm_id), Some(dev_device_id)) =
                    (machine_id, mac_machine_id, sqm_id, dev_device_id)
                {
                    return Some((
                        machine_id.to_string(),
                        mac_machine_id.to_string(),
                        sqm_id.to_string(),
                        dev_device_id.to_string(),
                    ));
                }
            }
        }
    }

    None
}

fn cursor_storage_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if cfg!(target_os = "windows") {
        if let Ok(appdata) = std::env::var("APPDATA") {
            paths.push(
                PathBuf::from(&appdata)
                    .join("Cursor")
                    .join("User")
                    .join("globalStorage")
                    .join("storage.json"),
            );
        }
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            paths.push(
                PathBuf::from(user_profile)
                    .join("AppData")
                    .join("Roaming")
                    .join("Cursor")
                    .join("User")
                    .join("globalStorage")
                    .join("storage.json"),
            );
        }
    } else if cfg!(target_os = "macos") {
        if let Ok(home) = std::env::var("HOME") {
            paths.push(
                PathBuf::from(home)
                    .join("Library")
                    .join("Application Support")
                    .join("Cursor")
                    .join("User")
                    .join("globalStorage")
                    .join("storage.json"),
            );
        }
    } else if let Ok(home) = std::env::var("HOME") {
        paths.push(
            PathBuf::from(&home)
                .join(".config")
                .join("Cursor")
                .join("User")
                .join("globalStorage")
                .join("storage.json"),
        );
        paths.push(
            PathBuf::from(home)
                .join(".cursor")
                .join("User")
                .join("globalStorage")
                .join("storage.json"),
        );
    }

    paths
}

fn internal_error(error: impl std::fmt::Display) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": error.to_string()})),
    )
}

#[cfg(test)]
mod tests {
    use super::{cursor_ids_from_metadata, cursor_storage_paths};
    use serde_json::json;

    #[test]
    fn reads_complete_cursor_ids_from_object_metadata() {
        let row = json!({
            "metadata": {
                "machineId": "m",
                "macMachineId": "mac",
                "sqmId": "{SQM}",
                "devDeviceId": "dev"
            }
        });

        assert_eq!(
            cursor_ids_from_metadata(&row),
            Some((
                "m".to_string(),
                "mac".to_string(),
                "{SQM}".to_string(),
                "dev".to_string()
            ))
        );
    }

    #[test]
    fn rejects_partial_cursor_metadata() {
        let row = json!({
            "metadata": {
                "machineId": "m",
                "macMachineId": "mac"
            }
        });

        assert!(cursor_ids_from_metadata(&row).is_none());
    }

    #[test]
    fn emits_platform_storage_candidates() {
        let paths = cursor_storage_paths();
        assert!(!paths.is_empty());
        assert!(paths.iter().all(|path| path.ends_with("storage.json")));
    }
}
