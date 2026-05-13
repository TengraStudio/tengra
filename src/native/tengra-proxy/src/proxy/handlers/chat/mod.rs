/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
pub mod antigravity;
pub mod compact;
pub mod compat;
pub mod cursor;
pub mod dispatch;
pub mod headers;
pub mod rate_limit;
pub mod request;
pub mod request_claude;
pub mod request_codex;
pub mod request_gemini;
pub mod request_openai;
pub mod request_support;
pub mod response;
pub mod stream;
pub mod stream_claude;
pub mod stream_copilot;
pub mod stream_cursor;
pub mod stream_gemini;
pub mod stream_support;
pub mod support;

use crate::proxy::handlers::chat::support::*;
use crate::proxy::model_catalog::{providers_for_model, resolve_provider};
use crate::proxy::server::AppState;
use crate::proxy::types::ChatCompletionRequest;
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{sse::Sse, IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};
use std::sync::Arc;

pub async fn handle_chat_completions(
    state: State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<ChatCompletionRequest>,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    execute_chat_completion_payload(state, headers, payload).await
}

pub async fn execute_chat_completion_payload(
    state: State<Arc<AppState>>,
    headers: HeaderMap,
    payload: ChatCompletionRequest,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    // 1. Resolve Provider candidates (to handle duplicate model IDs across providers)
    let requested_provider = payload.provider.clone();
    let resolved_provider = payload
        .provider
        .as_deref()
        .or_else(|| resolve_provider(&payload.model))
        .unwrap_or("codex")
        .to_string();
    let mut provider_candidates = vec![resolved_provider.clone()];
    if requested_provider.is_none() {
        for candidate in providers_for_model(&payload.model) {
            if !provider_candidates.iter().any(|p| p == candidate) {
                provider_candidates.push(candidate.to_string());
            }
        }
        let lower_model = payload.model.to_lowercase();
        if lower_model.starts_with("gpt-")
            || lower_model.starts_with("o1")
            || lower_model.starts_with("o3")
            || lower_model.starts_with("o4")
        {
            for candidate in ["copilot", "codex", "openai", "cursor"] {
                if !provider_candidates.iter().any(|p| p == candidate) {
                    provider_candidates.push(candidate.to_string());
                }
            }
        }
        if lower_model.starts_with("claude-") {
            for candidate in ["cursor", "copilot", "claude"] {
                if !provider_candidates.iter().any(|p| p == candidate) {
                    provider_candidates.push(candidate.to_string());
                }
            }
        }
    }

    let mut cursor_token = None;

    if let Some(test_token) = headers.get("x-test-cursor-token") {
        if let Ok(token) = test_token.to_str() {
            cursor_token = Some(token.to_string());
        }
    }

    let mut provider = resolved_provider.clone();
    let mut accounts = Vec::<serde_json::Value>::new();
    let mut accounts_error: Option<String> = None;
    for candidate in provider_candidates.iter() {
        match crate::db::get_provider_accounts(candidate).await {
            Ok(accs) if !accs.is_empty() => {
                provider = candidate.clone();
                accounts = accs;
                break;
            }
            Ok(_) => {}
            Err(e) => {
                accounts_error = Some(e.to_string());
            }
        }
    }
    if accounts.is_empty() && provider == "cursor" && cursor_token.is_some() {
        accounts = vec![json!({
            "id": "test_account",
            "provider": "cursor",
            "is_active": true,
            "access_token": "",
            "metadata": "{}"
        })];
    }
    if accounts.is_empty() {
        if let Some(error) = accounts_error {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": error})),
            ));
        }
        return Err(openai_error_response(
            StatusCode::UNAUTHORIZED,
            format!("No key for {}", requested_provider.unwrap_or(resolved_provider)),
            "authentication_error",
            Some("missing_account"),
        ));
    }

    let payload = compact::compact_chat_request(provider.as_str(), payload.clone());

    let mut active_keys: Vec<&serde_json::Value> = accounts
        .iter()
        .filter(|k| k["is_active"] == json!(1) || k["is_active"] == json!(true))
        .collect();
    if active_keys.is_empty() && !accounts.is_empty() {
        active_keys.push(&accounts[0]);
    }

    if active_keys.is_empty() {
        return Err(openai_error_response(
            StatusCode::UNAUTHORIZED,
            format!("No key for {}", provider),
            "authentication_error",
            Some("missing_account"),
        ));
    }

    let requested_account_id = requested_account_id(&payload);
    let active_key_row = requested_account_id
        .as_deref()
        .and_then(|account_id| {
            active_keys
                .iter()
                .copied()
                .find(|row| row.get("id").and_then(Value::as_str) == Some(account_id))
                .or_else(|| {
                    accounts
                        .iter()
                        .find(|row| row.get("id").and_then(Value::as_str) == Some(account_id))
                })
        })
        .or_else(|| active_keys.first().copied());
    let Some(active_key_row) = active_key_row else {
        return Err(openai_error_response(
            StatusCode::UNAUTHORIZED,
            format!("No active account for {}", provider),
            "authentication_error",
            Some("missing_active_account"),
        ));
    };

    // 3. Quota check
    if is_quota_exhausted(active_key_row) {
        return Err(openai_error_response(
            StatusCode::TOO_MANY_REQUESTS,
            "Quota exhausted".to_string(),
            "insufficient_quota",
            Some("quota_exhausted"),
        ));
    }

    let raw_token = active_key_row["access_token"].as_str().unwrap_or("");
    let auth_token = match decrypt_if_needed(raw_token) {
        Ok(token) => token,
        Err(_) => {
            return Err(openai_error_response(
                StatusCode::UNAUTHORIZED,
                format!("Failed to decrypt {} credentials", provider),
                "authentication_error",
                Some("token_decrypt_failed"),
            ))
        }
    };

    eprintln!("[PROXY] Handing request for provider: {}", provider);

    dispatch::dispatch_provider_request(
        state,
        headers,
        &provider,
        payload,
        &auth_token,
        active_key_row,
        cursor_token.as_deref(),
    )
    .await
}

async fn execute_upstream_request(
    state: State<Arc<AppState>>,
    payload: ChatCompletionRequest,
    provider: &str,
    auth_token: &str,
    active_key_row: &serde_json::Value,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let provider_str = provider.to_string();
    let prepared_payload =
        prepare_payload(provider, payload.clone(), auth_token, active_key_row).await?;
    let request_body = request::translate_request(provider, &prepared_payload);

    let res = if provider == "antigravity" {
        let state_clone = state.clone();
        let provider_clone = provider.to_string();
        let auth_token_clone = auth_token.to_string();
        let active_key_row_clone = active_key_row.clone();
        let prepared_payload_clone = prepared_payload.clone();
        let request_body_clone = request_body.clone();

        antigravity::execute_antigravity_request(active_key_row, move |base_url| {
            let state = state_clone.clone();
            let provider = provider_clone.clone();
            let auth_token = auth_token_clone.clone();
            let active_key_row = active_key_row_clone.clone();
            let prepared_payload = prepared_payload_clone.clone();
            let request_body = request_body_clone.clone();
            let base_url = base_url.map(|s| s.to_string());
            async move {
                send_upstream_request(
                    state,
                    &provider,
                    &auth_token,
                    &active_key_row,
                    &prepared_payload,
                    &request_body,
                    base_url.as_deref(),
                )
                .await
            }
        })
        .await?
    } else if provider == "cursor" {
        cursor::execute_cursor_request(
            state.clone(),
            auth_token,
            active_key_row,
            &prepared_payload,
            &request_body,
        )
        .await?
    } else {
        send_upstream_request(
            state.clone(),
            provider,
            auth_token,
            active_key_row,
            &prepared_payload,
            &request_body,
            None,
        )
        .await?
    };

    let mut res = res;
    if res.status() == StatusCode::UNAUTHORIZED
        && matches!(provider, "copilot" | "cursor")
    {
        if let Ok(Some(refreshed)) = crate::token::refresh_account_token(active_key_row).await {
            let refreshed_token = refreshed
                .session_token
                .or(refreshed.access_token)
                .unwrap_or_else(|| auth_token.to_string());
            res = send_upstream_request(
                state.clone(),
                provider,
                &refreshed_token,
                active_key_row,
                &prepared_payload,
                &request_body,
                None,
            )
            .await?;
        }
    }

    // 5. Transform Response
    let status = res.status();
    let content_type = res
        .headers()
        .get("content-type")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("unknown");

    eprintln!(
        "[PROXY] Upstream Response: {} (Content-Type: {})",
        status, content_type
    );

    if !status.is_success() {
        let _provider = payload.provider.clone().unwrap_or_default();
        let body = res.text().await.unwrap_or_default();

        // Try to parse as JSON to see if we can extract a better error message
        if let Ok(json_err) = serde_json::from_str::<Value>(&body) {
            if let Some(err_obj) = json_err.get("error") {
                if err_obj.is_object() {
                    let mut normalized = err_obj.clone();
                    if let Some(obj) = normalized.as_object_mut() {
                        obj.insert(
                            "type".to_string(),
                            Value::String(openai_error_type_from_status(status).to_string()),
                        );
                        if status == StatusCode::PAYMENT_REQUIRED {
                            obj.insert(
                                "code".to_string(),
                                Value::String("insufficient_quota".to_string()),
                            );
                        }
                    }
                    return Err((status, Json(json!({ "error": normalized }))));
                }
                return Err(openai_error_response(
                    status,
                    err_obj.to_string(),
                    openai_error_type_from_status(status),
                    None,
                ));
            }
            return Err(openai_error_response(
                status,
                body,
                openai_error_type_from_status(status),
                None,
            ));
        }

        return Err(openai_error_response(
            status,
            body,
            openai_error_type_from_status(status),
            None,
        ));
    }

    if prepared_payload.stream {
        let session_key = generate_session_key(active_key_row, &prepared_payload);
        let sse_stream = if provider_str == "cursor" {
            let content_type = res
                .headers()
                .get("content-type")
                .and_then(|h| h.to_str().ok())
                .unwrap_or("unknown");
            let is_sse = content_type.contains("text/event-stream");

            stream::translate_cursor_stream(res.bytes_stream(), state.clone(), session_key, is_sse)
        } else {
            stream::translate_stream(
                provider_str.to_string(),
                res.bytes_stream(),
                state.clone(),
                session_key,
            )
        };
        Ok(Sse::new(sse_stream).into_response())
    } else {
        let status = res.status();
        let val = res.json::<serde_json::Value>().await.map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
        })?;

        let translated = response::translate_response(provider, val);
        Ok((status, Json(translated)).into_response())
    }
}

fn openai_error_type_from_status(status: StatusCode) -> &'static str {
    match status {
        StatusCode::UNAUTHORIZED => "authentication_error",
        StatusCode::PAYMENT_REQUIRED | StatusCode::TOO_MANY_REQUESTS => "insufficient_quota",
        StatusCode::NOT_FOUND => "invalid_request_error",
        _ => "upstream_error",
    }
}

fn openai_error_response(
    status: StatusCode,
    message: String,
    error_type: &str,
    code: Option<&str>,
) -> (StatusCode, Json<serde_json::Value>) {
    (
        status,
        Json(json!({
            "error": {
                "message": message,
                "type": error_type,
                "code": code
            }
        })),
    )
}

async fn send_upstream_request(
    state: State<Arc<AppState>>,
    provider: &str,
    auth_token: &str,
    active_key_row: &Value,
    payload: &ChatCompletionRequest,
    request_body: &Value,
    base_url_override: Option<&str>,
) -> Result<reqwest::Response, (StatusCode, Json<serde_json::Value>)> {
    let upstream_url = get_upstream_url(provider, payload, active_key_row, base_url_override);

    let session_key = generate_session_key(active_key_row, payload);
    let (session_id, prior_signature) = {
        let mut sid_cache = state.session_id_cache.lock().await;
        let sig_cache = state.signature_cache.lock().await;

        let sid = sid_cache
            .entry(session_key.clone())
            .or_insert_with(|| uuid::Uuid::new_v4().to_string())
            .clone();
        let sig = sig_cache.get(&session_key).cloned();
        (sid, sig)
    };

    let mut request_builder = upstream_http_client().post(upstream_url.clone());
    request_builder = headers::apply_headers(
        request_builder,
        provider,
        auth_token,
        payload.stream,
        active_key_row,
        Some(&session_id),
        prior_signature.as_deref(),
    );

    if provider == "cursor" {
        let body_bytes = serde_json::to_vec(request_body).unwrap();
        let mut full_body = Vec::with_capacity(body_bytes.len() + 5);
        full_body.push(0u8); // Flags: 0 for message
        full_body.extend_from_slice(&(body_bytes.len() as u32).to_be_bytes());
        full_body.extend_from_slice(&body_bytes);

        request_builder.body(full_body).send().await
    } else {
        request_builder.json(request_body).send().await
    }
    .map_err(|error| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": error.to_string()})),
        )
    })
}

async fn prepare_payload(
    provider: &str,
    mut payload: ChatCompletionRequest,
    auth_token: &str,
    active_key_row: &Value,
) -> Result<ChatCompletionRequest, (StatusCode, Json<serde_json::Value>)> {
    if let Some(injection) = crate::proxy::skills::build_skill_injection(provider)
        .await
        .map_err(|error| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to resolve skills: {}", error)})),
            )
        })?
    {
        crate::proxy::skills::inject_skill_prompt(&mut payload, &injection.content).map_err(
            |error| {
                (
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": format!("Failed to inject skills: {}", error)})),
                )
            },
        )?;
    }

    if provider != "antigravity" {
        return Ok(payload);
    }

    let project_id =
        antigravity::resolve_antigravity_project_id(auth_token, active_key_row).await?;
    let mut metadata = payload
        .metadata
        .take()
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    metadata.insert("project_id".to_string(), Value::String(project_id));
    payload.metadata = Some(Value::Object(metadata));
    Ok(payload)
}
