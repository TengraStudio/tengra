/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::auth::antigravity::types::{AntigravityPaidTier, AntigravityToken};
use crate::static_config;
use anyhow::{anyhow, Result};
use reqwest;
use serde_json::{json, Value};
use std::time::Duration;

pub struct AntigravityClient {
    client: reqwest::Client,
    client_id: String,
    client_secret: String,
    redirect_uri: String,
}

#[derive(Clone)]
pub struct AntigravityProjectContext {
    pub project_id: String,
    pub tier_id: String,
    #[allow(dead_code)]
    pub ai_credits: Option<AntigravityPaidTier>,
}

impl AntigravityClient {
    pub async fn new(redirect_uri: Option<String>) -> Result<Self> {
        let timeout_secs = static_config::oauth_provider_timeout_secs("antigravity")?;
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .build()?;
        Ok(Self {
            client,
            client_id: static_config::ANTIGRAVITY_CLIENT_ID.to_string(),
            client_secret: static_config::ANTIGRAVITY_CLIENT_SECRET.to_string(),
            redirect_uri: redirect_uri
                .unwrap_or_else(|| "http://localhost:51121/oauth-callback".to_string()),
        })
    }

    pub fn generate_auth_url(&self, state: &str) -> String {
        let scopes = [
            "https://www.googleapis.com/auth/cloud-platform",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/cclog",
            "https://www.googleapis.com/auth/experimentsandconfigs",
        ]
        .join(" ");

        format!(
            "https://accounts.google.com/o/oauth2/v2/auth?\
            client_id={}&\
            redirect_uri={}&\
            response_type=code&\
            scope={}&\
            state={}&\
            access_type=offline&\
            prompt=consent",
            self.client_id,
            urlencoding::encode(&self.redirect_uri),
            urlencoding::encode(&scopes),
            state
        )
    }

    pub async fn exchange_code(&self, code: &str) -> Result<AntigravityToken> {
        let params = [
            ("client_id", &self.client_id),
            ("client_secret", &self.client_secret),
            ("code", &code.to_string()),
            ("redirect_uri", &self.redirect_uri),
            ("grant_type", &"authorization_code".to_string()),
        ];

        let res = self
            .client
            .post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .await?;

        if !res.status().is_success() {
            let err_text = res.text().await?;
            return Err(anyhow!("Antigravity Token Exchange failed: {}", err_text));
        }

        let token: AntigravityToken = res.json().await?;
        Ok(token)
    }

    pub async fn get_user_email(&self, access_token: &str) -> Result<String> {
        let res = self
            .client
            .get("https://www.googleapis.com/oauth2/v1/userinfo?alt=json")
            .bearer_auth(access_token)
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(anyhow!("Failed to get user info: {}", res.status()));
        }

        let body: serde_json::Value = res.json().await?;
        Ok(body["email"].as_str().unwrap_or_default().to_string())
    }

    pub async fn discover_project_context(
        &self,
        access_token: &str,
    ) -> Result<AntigravityProjectContext> {
        let res = self
            .client
            .post("https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist")
            .bearer_auth(access_token)
            .header("Content-Type", "application/json")
            .header("User-Agent", "antigravity/1.107.0")
            .header("X-Goog-Api-Client", "google-cloud-sdk vscode_cloudshelleditor/0.1")
            .header(
                "Client-Metadata",
                "{\"ideType\":\"ANTIGRAVITY\",\"platform\":\"PLATFORM_UNSPECIFIED\",\"pluginType\":\"GEMINI\"}",
            )
            .json(&json!({
                "metadata": {
                    "ideType": "ANTIGRAVITY",
                    "platform": "PLATFORM_UNSPECIFIED",
                    "pluginType": "GEMINI"
                }
            }))
            .send()
            .await?;

        if !res.status().is_success() {
            let body = res.text().await?;
            return Err(anyhow!("Failed to discover Antigravity project: {}", body));
        }

        let body: Value = res.json().await?;
        let project_id =
            extract_project_id(&body).ok_or_else(|| anyhow!("Missing cloudaicompanionProject"))?;
        let tier_id = extract_default_tier_id(&body).unwrap_or_else(|| "legacy-tier".to_string());
        let ai_credits = extract_paid_tier(&body);

        Ok(AntigravityProjectContext {
            project_id,
            tier_id,
            ai_credits,
        })
    }

    pub async fn ensure_onboarded(
        &self,
        access_token: &str,
        context: &AntigravityProjectContext,
    ) -> Result<String> {
        let mut attempts = 0;
        while attempts < 6 {
            let res = self
                .client
                .post("https://cloudcode-pa.googleapis.com/v1internal:onboardUser")
                .bearer_auth(access_token)
                .header("Content-Type", "application/json")
                .header("User-Agent", "antigravity/1.107.0")
                .header("X-Goog-Api-Client", "google-cloud-sdk vscode_cloudshelleditor/0.1")
                .header(
                    "Client-Metadata",
                    "{\"ideType\":\"ANTIGRAVITY\",\"platform\":\"PLATFORM_UNSPECIFIED\",\"pluginType\":\"GEMINI\"}",
                )
                .json(&json!({
                    "tierId": context.tier_id,
                    "metadata": {
                        "ideType": "ANTIGRAVITY",
                        "platform": "PLATFORM_UNSPECIFIED",
                        "pluginType": "GEMINI"
                    },
                    "cloudaicompanionProject": context.project_id
                }))
                .send()
                .await?;

            if !res.status().is_success() {
                let body = res.text().await?;
                return Err(anyhow!("Failed to onboard Antigravity user: {}", body));
            }

            let body: Value = res.json().await?;
            if body.get("done").and_then(Value::as_bool) == Some(true) {
                return Ok(extract_onboarded_project_id(&body)
                    .unwrap_or_else(|| context.project_id.clone()));
            }

            attempts += 1;
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }

        Ok(context.project_id.clone())
    }

    /// Fetches the user identity and permissions from the backend.
    #[allow(dead_code)]
    pub async fn fetch_user(&self, access_token: &str) -> Result<Value> {
        let res = self
            .client
            .post("https://cloudcode-pa.googleapis.com/v1internal:fetchUser")
            .bearer_auth(access_token)
            .header("Content-Type", "application/json")
            .header("User-Agent", "antigravity/1.107.0")
            .header("X-Goog-Api-Client", "google-cloud-sdk vscode_cloudshelleditor/0.1")
            .header(
                "Client-Metadata",
                "{\"ideType\":\"ANTIGRAVITY\",\"platform\":\"PLATFORM_UNSPECIFIED\",\"pluginType\":\"GEMINI\"}",
            )
            .json(&json!({
                "metadata": {
                    "ideType": "ANTIGRAVITY",
                    "platform": "PLATFORM_UNSPECIFIED",
                    "pluginType": "GEMINI"
                }
            }))
            .send()
            .await?;

        if !res.status().is_success() {
            let body = res.text().await?;
            return Err(anyhow!("Failed to fetch Antigravity user: {}", body));
        }

        Ok(res.json().await?)
    }

    /// Sets the user settings for the AI Companion.
    #[allow(dead_code)]
    pub async fn set_user_settings(&self, access_token: &str, settings: Value) -> Result<()> {
        let res = self
            .client
            .post("https://cloudcode-pa.googleapis.com/v1internal:setUserSettings")
            .bearer_auth(access_token)
            .header("Content-Type", "application/json")
            .header("User-Agent", "antigravity/1.107.0")
            .header("X-Goog-Api-Client", "google-cloud-sdk vscode_cloudshelleditor/0.1")
            .header(
                "Client-Metadata",
                "{\"ideType\":\"ANTIGRAVITY\",\"platform\":\"PLATFORM_UNSPECIFIED\",\"pluginType\":\"GEMINI\"}",
            )
            .json(&json!({
                "settings": settings,
                "metadata": {
                    "ideType": "ANTIGRAVITY",
                    "platform": "PLATFORM_UNSPECIFIED",
                    "pluginType": "GEMINI"
                }
            }))
            .send()
            .await?;

        if !res.status().is_success() {
            let body = res.text().await?;
            return Err(anyhow!("Failed to set Antigravity user settings: {}", body));
        }

        Ok(())
    }
}

fn extract_project_id(body: &Value) -> Option<String> {
    body.get("cloudaicompanionProject")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| {
            body.get("cloudaicompanionProject")
                .and_then(Value::as_object)
                .and_then(|project| project.get("id"))
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
        })
}

fn extract_default_tier_id(body: &Value) -> Option<String> {
    body.get("allowedTiers")
        .and_then(Value::as_array)
        .and_then(|tiers| {
            tiers.iter().find_map(|tier| {
                let is_default = tier
                    .get("isDefault")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                if !is_default {
                    return None;
                }
                tier.get("id")
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string)
            })
        })
}

fn extract_onboarded_project_id(body: &Value) -> Option<String> {
    body.get("response").and_then(extract_project_id)
}

fn extract_paid_tier(body: &Value) -> Option<AntigravityPaidTier> {
    body.get("paidTier")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{extract_default_tier_id, extract_project_id};

    #[test]
    fn extracts_project_id_from_string_or_object() {
        assert_eq!(
            extract_project_id(&json!({ "cloudaicompanionProject": "project-1" })),
            Some("project-1".to_string())
        );
        assert_eq!(
            extract_project_id(&json!({ "cloudaicompanionProject": { "id": "project-2" } })),
            Some("project-2".to_string())
        );
    }

    #[test]
    fn extracts_default_tier_id() {
        assert_eq!(
            extract_default_tier_id(&json!({
                "allowedTiers": [
                    { "id": "legacy-tier", "isDefault": false },
                    { "id": "default-tier", "isDefault": true }
                ]
            })),
            Some("default-tier".to_string())
        );
    }
}
