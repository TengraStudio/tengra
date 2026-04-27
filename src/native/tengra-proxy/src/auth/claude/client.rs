/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::auth::claude::types::ClaudeTokenResponse;
use crate::auth::codex::pkce::PKCECodes; // PKCE logic is same
use crate::static_config;
use reqwest::Client;
use serde_json::{Map, Value};
use std::time::Duration;
use url::Url;

pub struct ClaudeClient {
    client: Client,
    client_id: String,
}

impl ClaudeClient {
    pub async fn new() -> anyhow::Result<Self> {
        let timeout_secs = static_config::oauth_provider_timeout_secs("claude")?;
        let client = Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .build()?;
        Ok(Self {
            client,
            client_id: static_config::ANTHROPIC_OAUTH_CLIENT_ID.to_string(),
        })
    }

    pub fn generate_auth_url(&self, state: &str, pkce: &PKCECodes) -> String {
        let Ok(mut url) = Url::parse("https://claude.ai/oauth/authorize") else {
            return "https://claude.ai/oauth/authorize".to_string();
        };
        url.query_pairs_mut()
            .append_pair("client_id", &self.client_id)
            .append_pair("response_type", "code")
            .append_pair("redirect_uri", "http://localhost:54545/callback")
            .append_pair("scope", "org:create_api_key user:profile user:inference")
            .append_pair("state", state)
            .append_pair("code_challenge", &pkce.code_challenge)
            .append_pair("code_challenge_method", "S256");

        url.to_string()
    }

    pub async fn exchange_code(
        &self,
        code: &str,
        verifier: &str,
    ) -> anyhow::Result<ClaudeTokenResponse> {
        let params = [
            ("grant_type", "authorization_code"),
            ("client_id", &self.client_id),
            ("code", code),
            ("redirect_uri", "http://localhost:54545/callback"),
            ("code_verifier", verifier),
        ];

        let resp = self
            .client
            .post("https://console.anthropic.com/v1/oauth/token")
            .form(&params)
            .send()
            .await?;

        if !resp.status().is_success() {
            let error_text = resp.text().await?;
            return Err(anyhow::anyhow!(
                "Claude token exchange failed: {}",
                error_text
            ));
        }

        let token_resp: ClaudeTokenResponse = resp.json().await?;
        Ok(token_resp)
    }

    pub async fn fetch_profile_metadata(&self, access_token: &str) -> anyhow::Result<Value> {
        let trimmed = access_token.trim();
        if trimmed.is_empty() {
            return Err(anyhow::anyhow!(
                "Missing Anthropic access token for profile enrichment"
            ));
        }

        let mut profile = Map::new();
        let mut organizations = Vec::<Value>::new();

        let org_response = self
            .client
            .get("https://api.anthropic.com/api/organizations")
            .bearer_auth(trimmed)
            .send()
            .await;

        if let Ok(response) = org_response {
            if response.status().is_success() {
                if let Ok(value) = response.json::<Value>().await {
                    if let Some(items) = value.as_array() {
                        for item in items {
                            if let Some(item_object) = item.as_object() {
                                organizations.push(Value::Object(item_object.clone()));
                            }
                        }
                    }
                }
            }
        }

        if let Some(first_org) = organizations.first().and_then(Value::as_object).cloned() {
            if let Some(name) = first_org.get("name").and_then(Value::as_str) {
                profile.insert("display_name".to_string(), Value::String(name.to_string()));
            }
            if let Some(slug) = first_org
                .get("slug")
                .or_else(|| first_org.get("id"))
                .and_then(Value::as_str)
            {
                profile.insert(
                    "organization".to_string(),
                    serde_json::json!({
                        "id": first_org.get("id").and_then(Value::as_str),
                        "name": first_org.get("name").and_then(Value::as_str),
                        "slug": slug
                    }),
                );
            }
        }

        if !organizations.is_empty() {
            profile.insert("organizations".to_string(), Value::Array(organizations));
        }

        Ok(Value::Object(profile))
    }
}
