/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use axum::{http::StatusCode, response::Response, Json};
use chrono::Utc;
use serde_json::json;
use std::sync::OnceLock;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

pub const COPILOT_MIN_API_INTERVAL_MS: i64 = 1000;
pub const COPILOT_MAX_QUEUED_REQUESTS: usize = 30;

pub const ANTIGRAVITY_MIN_API_INTERVAL_MS: i64 = 2000;
pub const ANTIGRAVITY_MAX_QUEUED_REQUESTS: usize = 12;

#[derive(Default)]
pub struct CopilotRateLimitState {
    pub last_api_call_at_ms: i64,
    pub pending_requests: usize,
}

#[derive(Default)]
pub struct AntigravityRateLimitState {
    pub last_api_call_at_ms: i64,
    pub pending_requests: usize,
}

static COPILOT_RATE_LIMITER: OnceLock<Mutex<CopilotRateLimitState>> = OnceLock::new();
static ANTIGRAVITY_RATE_LIMITER: OnceLock<Mutex<AntigravityRateLimitState>> = OnceLock::new();

pub fn copilot_rate_limiter() -> &'static Mutex<CopilotRateLimitState> {
    COPILOT_RATE_LIMITER.get_or_init(|| Mutex::new(CopilotRateLimitState::default()))
}

pub fn antigravity_rate_limiter() -> &'static Mutex<AntigravityRateLimitState> {
    ANTIGRAVITY_RATE_LIMITER.get_or_init(|| Mutex::new(AntigravityRateLimitState::default()))
}

pub async fn execute_antigravity_rate_limited<F, Fut>(
    f: F,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<Response, (StatusCode, Json<serde_json::Value>)>>,
{
    let wait_ms = {
        let limiter = antigravity_rate_limiter();
        let mut state = limiter.lock().await;

        if state.pending_requests >= ANTIGRAVITY_MAX_QUEUED_REQUESTS {
            return Err((
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({
                    "error": "Antigravity request queue full"
                })),
            ));
        }

        state.pending_requests += 1;
        let now = Utc::now().timestamp_millis();
        let wait_ms = (state.last_api_call_at_ms + ANTIGRAVITY_MIN_API_INTERVAL_MS - now).max(0);
        state.last_api_call_at_ms = now + wait_ms;
        wait_ms
    };

    if wait_ms > 0 {
        sleep(Duration::from_millis(wait_ms as u64)).await;
    }

    let result = f().await;

    {
        let limiter = antigravity_rate_limiter();
        let mut state = limiter.lock().await;
        state.pending_requests = state.pending_requests.saturating_sub(1);
    }

    result
}

pub async fn execute_copilot_rate_limited<F, Fut>(
    f: F,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<Response, (StatusCode, Json<serde_json::Value>)>>,
{
    let wait_ms = {
        let limiter = copilot_rate_limiter();
        let mut state = limiter.lock().await;
        if state.pending_requests >= COPILOT_MAX_QUEUED_REQUESTS {
            return Err((
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({
                    "error": "Copilot request queue full"
                })),
            ));
        }

        state.pending_requests += 1;
        let now = chrono::Utc::now().timestamp_millis();
        let wait_ms = (state.last_api_call_at_ms + COPILOT_MIN_API_INTERVAL_MS - now).max(0);
        state.last_api_call_at_ms = now + wait_ms;
        wait_ms
    };

    if wait_ms > 0 {
        sleep(Duration::from_millis(wait_ms as u64)).await;
    }

    let result = f().await;

    {
        let limiter = copilot_rate_limiter();
        let mut state = limiter.lock().await;
        state.pending_requests = state.pending_requests.saturating_sub(1);
    }

    result
}
