/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const CURSOR_BACKEND_URL: &str = "https://api2.cursor.sh";
#[allow(dead_code)]
const CURSOR_AUTH_CLIENT_ID: &str = "KTiMj4aOmB5xHnJFVJnwzssPnOxzUACx";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CursorSession {
    pub access_token: String,
    pub refresh_token: String,
    #[serde(default)]
    pub expires_in: u64,
    #[serde(default)]
    pub token_type: String,
    pub user: Option<CursorUser>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CursorUser {
    #[serde(default)]
    pub id: String,
    pub email: Option<String>,
    pub user_metadata: Option<CursorUserMetadata>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CursorUserMetadata {
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
}

/// Response from the Connect-RPC GetEmail endpoint.
#[derive(Debug, Deserialize)]
pub struct GetEmailResponse {
    pub email: Option<String>,
    #[allow(dead_code)]
    #[serde(rename = "jobRole")]
    pub job_role: Option<String>,
}

/// Response from the REST full_stripe_profile endpoint.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct StripeProfile {
    pub email: Option<String>,
    pub membership_type: Option<String>,
    pub subscription_status: Option<String>,
    pub days_remaining_on_trial: Option<i32>,
}

/// Response from the OAuth token refresh endpoint.
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct TokenRefreshResponse {
    pub access_token: Option<String>,
    #[serde(rename = "shouldLogout")]
    pub should_logout: Option<bool>,
}

pub struct CursorClient {
    client: Client,
}

impl CursorClient {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(REQUEST_TIMEOUT)
                .build()
                .unwrap_or_else(|_| Client::new()),
        }
    }

    fn default_headers(&self, access_token: &str) -> Vec<(&'static str, String)> {
        vec![
            ("Authorization", format!("Bearer {}", access_token)),
            ("x-ghost-mode", "false".to_string()),
            (
                "x-cursor-client-version",
                crate::proxy::handlers::chat::headers::detected_cursor_client_version(),
            ),
        ]
    }

    /// Fetches the user's email from Cursor's API.
    /// Strategy:
    ///   1. Try REST: GET /auth/full_stripe_profile
    ///   2. Fallback Connect-RPC: POST /aiserver.v1.AuthService/GetEmail
    ///   3. Final fallback: None
    pub async fn fetch_user_email(&self, access_token: &str) -> Result<Option<String>> {
        // 1. Try full_stripe_profile (REST endpoint)
        match self.fetch_stripe_profile(access_token).await {
            Ok(profile) => {
                if let Some(email) = profile.email.filter(|e| !e.is_empty()) {
                    return Ok(Some(email));
                }
            }
            Err(e) => {
                eprintln!("[WARN] Cursor stripe_profile fetch failed: {}", e);
            }
        }

        // 2. Fallback: Connect-RPC GetEmail
        match self.fetch_email_via_rpc(access_token).await {
            Ok(resp) => {
                if let Some(email) = resp.email.filter(|e| !e.is_empty()) {
                    return Ok(Some(email));
                }
            }
            Err(e) => {
                eprintln!("[WARN] Cursor GetEmail RPC failed: {}", e);
            }
        }

        Ok(None)
    }

    /// Fetches the user's stripe profile from the REST endpoint.
    pub async fn fetch_stripe_profile(&self, access_token: &str) -> Result<StripeProfile> {
        let url = format!("{}/auth/full_stripe_profile", CURSOR_BACKEND_URL);
        let mut req = self.client.get(&url);
        for (key, value) in self.default_headers(access_token) {
            req = req.header(key, value);
        }

        let res = req.send().await?;
        let status = res.status();
        let body = res.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(anyhow!("stripe_profile failed ({}): {}", status, body));
        }

        match serde_json::from_str::<StripeProfile>(&body) {
            Ok(profile) => Ok(profile),
            Err(e) => {
                eprintln!("[DEBUG] stripe_profile response body: {}", body);
                Err(anyhow!(
                    "error decoding response body: {} (Body: {})",
                    e,
                    body
                ))
            }
        }
    }

    /// Fetches the user's email via Connect-RPC (protobuf-compatible JSON).
    pub async fn fetch_email_via_rpc(&self, access_token: &str) -> Result<GetEmailResponse> {
        let url = format!("{}/aiserver.v1.AuthService/GetEmail", CURSOR_BACKEND_URL);
        let mut req = self.client.post(&url);
        for (key, value) in self.default_headers(access_token) {
            req = req.header(key, value);
        }
        req = req.header("Content-Type", "application/json");
        req = req.header("Connect-Protocol-Version", "1");
        req = req.body("{}");

        let res = req.send().await?;
        let status = res.status();
        let body = res.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(anyhow!("GetEmail RPC failed ({}): {}", status, body));
        }

        match serde_json::from_str::<GetEmailResponse>(&body) {
            Ok(resp) => Ok(resp),
            Err(e) => {
                // Log the body to help debug why decoding failed
                eprintln!("[DEBUG] GetEmail response body: {}", body);
                Err(anyhow!(
                    "error decoding response body: {} (Body: {})",
                    e,
                    body
                ))
            }
        }
    }

    /// Refreshes the Cursor access token using a refresh token.
    /// Uses the same OAuth endpoint that the official Cursor IDE uses.
    #[allow(dead_code)]
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<TokenRefreshResponse> {
        let url = format!("{}/oauth/token", CURSOR_BACKEND_URL);

        let res = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "grant_type": "refresh_token",
                "client_id": CURSOR_AUTH_CLIENT_ID,
                "refresh_token": refresh_token
            }))
            .send()
            .await?;

        if !res.status().is_success() {
            let err = res.text().await?;
            return Err(anyhow!("Cursor token refresh failed: {}", err));
        }

        Ok(res.json().await?)
    }

    /// Fetches the list of available models from Cursor's internal API.
    /// Uses the Connect-RPC endpoint: POST /aiserver.v1.AiService/AvailableModels
    pub async fn fetch_available_models(&self, access_token: &str) -> Result<serde_json::Value> {
        let url = format!(
            "{}/aiserver.v1.AiService/AvailableModels",
            CURSOR_BACKEND_URL
        );
        let mut req = self.client.post(&url);
        for (key, value) in self.default_headers(access_token) {
            req = req.header(key, value);
        }
        req = req.header("Content-Type", "application/json");
        req = req.header("Connect-Protocol-Version", "1");
        req = req.body("{}");

        let res = req.send().await?;
        let status = res.status();
        let body = res.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(anyhow!("AvailableModels RPC failed ({}): {}", status, body));
        }

        serde_json::from_str(&body).map_err(|e| {
            anyhow!(
                "Failed to parse AvailableModels response: {} (Body: {})",
                e,
                body
            )
        })
    }
}
