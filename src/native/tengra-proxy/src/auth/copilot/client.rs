/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::auth::copilot::types::{
    CopilotSessionToken, GitHubDeviceCodeResponse, GitHubTokenResponse,
};
use anyhow::{anyhow, Result};
use reqwest::Client;
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};

const GITHUB_CLIENT_ID: &str = "01ab8ac9400c4e429b23";
const GITHUB_DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const COPILOT_TOKEN_V2_URL: &str = "https://api.github.com/copilot_internal/v2/token";
const COPILOT_TOKEN_V1_URL: &str = "https://api.github.com/copilot_internal/v1/token";
const GITHUB_COPILOT_USER_URL: &str = "https://api.github.com/copilot_internal/user";

pub struct CopilotClient {
    client: Client,
}

impl CopilotClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    pub async fn initiate_device_flow(&self) -> Result<GitHubDeviceCodeResponse> {
        let params = [
            ("client_id", GITHUB_CLIENT_ID),
            ("scope", "read:user user:email repo"),
        ];

        let res = self
            .client
            .post(GITHUB_DEVICE_CODE_URL)
            .header("Accept", "application/json")
            .form(&params)
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(anyhow!(
                "GitHub device flow initiation failed: {}",
                res.status()
            ));
        }

        let device_code: GitHubDeviceCodeResponse = res.json().await?;
        Ok(device_code)
    }

    pub async fn poll_for_token(&self, device_code: &str) -> Result<GitHubTokenResponse> {
        let params = [
            ("client_id", GITHUB_CLIENT_ID),
            ("device_code", device_code),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ];

        let res = self
            .client
            .post(GITHUB_ACCESS_TOKEN_URL)
            .header("Accept", "application/json")
            .form(&params)
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(anyhow!("GitHub token polling failed: {}", res.status()));
        }

        let token: GitHubTokenResponse = res.json().await?;
        Ok(token)
    }

    pub async fn exchange_for_copilot_token(
        &self,
        github_token: &str,
    ) -> Result<CopilotSessionToken> {
        let res = self
            .client
            .get(COPILOT_TOKEN_V2_URL)
            .header("Authorization", format!("token {}", github_token))
            .header("User-Agent", "gh-copilot/1.0.0")
            .header("Editor-Version", "gh/2.61.0")
            .header("Editor-Plugin-Version", "gh-copilot/1.0.0")
            .header("X-GitHub-Api-Version", "2026-03-10")
            .header("Accept", "application/json")
            .send()
            .await?;

        if res.status() == reqwest::StatusCode::NOT_FOUND {
            return self.exchange_for_copilot_token_v1(github_token).await;
        }

        if !res.status().is_success() {
            let status = res.status();
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow!(
                "Copilot token exchange failed ({}): {}",
                status,
                err_text
            ));
        }

        let mut token_data: CopilotSessionToken = res.json().await?;

        // If expires_at is not present, calculate a default (25 min)
        if token_data.expires_at == 0 {
            let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
            token_data.expires_at = now + 1500;
        }

        Ok(token_data)
    }

    pub async fn fetch_copilot_plan(&self, github_token: &str) -> Result<String> {
        let res = self
            .client
            .get(GITHUB_COPILOT_USER_URL)
            .header("Authorization", format!("token {}", github_token))
            .header("Accept", "application/json")
            .header("User-Agent", "gh-copilot/1.0.0")
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(anyhow!("Copilot plan detection failed: {}", res.status()));
        }

        let data = res.json::<Value>().await?;
        Ok(data
            .get("copilot_plan")
            .and_then(|value| value.as_str())
            .unwrap_or("individual")
            .to_string())
    }

    async fn exchange_for_copilot_token_v1(
        &self,
        github_token: &str,
    ) -> Result<CopilotSessionToken> {
        let res = self
            .client
            .get(COPILOT_TOKEN_V1_URL)
            .header("Authorization", format!("token {}", github_token))
            .header("User-Agent", "gh-copilot/1.0.0")
            .header("Editor-Version", "gh/2.61.0")
            .header("Editor-Plugin-Version", "gh-copilot/1.0.0")
            .header("X-GitHub-Api-Version", "2026-03-10")
            .header("Accept", "application/json")
            .send()
            .await?;

        if !res.status().is_success() {
            let status = res.status();
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow!(
                "Copilot token v1 fallback failed ({}): {}",
                status,
                err_text
            ));
        }

        let mut token_data: CopilotSessionToken = res.json().await?;
        if token_data.expires_at == 0 {
            let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
            token_data.expires_at = now + 1500;
        }
        Ok(token_data)
    }
}
