/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::Deserialize;
use serde_json::{json, Value};
use std::time::Duration;
use url::Url;

use crate::static_config;

const OLLAMA_CLOUD_BASE_URL: &str = "https://ollama.com";

#[derive(Clone)]
pub struct OllamaClient {
    client: reqwest::Client,
    base_url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OllamaMeResponse {
    pub id: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub username: Option<String>,
    pub image_url: Option<String>,
}

impl OllamaClient {
    pub fn new(base_url: Option<&str>, bearer_token: Option<&str>) -> Result<Self> {
        let timeout_secs = static_config::oauth_provider_timeout_secs("ollama")?;
        let mut headers = HeaderMap::new();
        if let Some(token) = bearer_token
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            let value = HeaderValue::from_str(format!("Bearer {}", token).as_str())
                .map_err(|error| anyhow!("Invalid Ollama bearer token header: {}", error))?;
            headers.insert(AUTHORIZATION, value);
        }

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .default_headers(headers)
            .build()?;
        let normalized_base = normalize_base_url(base_url.unwrap_or("http://127.0.0.1:11434"))?;
        Ok(Self {
            client,
            base_url: normalized_base,
        })
    }

    pub async fn fetch_signin_url(&self) -> Result<String> {
        let response = self
            .client
            .post(format!("{}/api/me", self.base_url))
            .json(&json!({}))
            .send()
            .await?;

        let status = response.status();
        let body: Value = response.json().await.unwrap_or(Value::Null);

        if let Some(url) = extract_signin_url(&body) {
            return resolve_ollama_signin_url(url.as_str());
        }

        if status.is_success() {
            return Err(anyhow!("Ollama account is already authorized"));
        }

        Err(anyhow!(
            "Ollama sign-in URL could not be discovered (status {})",
            status
        ))
    }

    pub async fn fetch_profile(&self) -> Result<OllamaMeResponse> {
        let response = self
            .client
            .post(format!("{}/api/me", self.base_url))
            .json(&json!({}))
            .send()
            .await?;
        let status = response.status();
        if !status.is_success() {
            return Err(anyhow!(
                "Ollama profile fetch failed with status {}",
                status
            ));
        }

        let parsed: OllamaMeResponse = response.json().await?;
        if parsed.id.trim().is_empty() {
            return Err(anyhow!("Ollama profile response missing account id"));
        }
        Ok(parsed)
    }

    pub async fn signout(&self) -> Result<()> {
        let response = self
            .client
            .post(format!("{}/api/signout", self.base_url))
            .send()
            .await?;
        let status = response.status();
        if status.is_success() {
            return Ok(());
        }
        Err(anyhow!("Ollama signout failed with status {}", status))
    }
}

fn normalize_base_url(input: &str) -> Result<String> {
    let mut parsed = Url::parse(input)
        .or_else(|_| Url::parse(format!("http://{}", input).as_str()))
        .map_err(|error| anyhow!("Invalid Ollama base URL '{}': {}", input, error))?;
    parsed.set_path("");
    parsed.set_query(None);
    parsed.set_fragment(None);
    Ok(parsed.to_string().trim_end_matches('/').to_string())
}

fn extract_signin_url(body: &Value) -> Option<String> {
    body.get("signin_url")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn resolve_ollama_signin_url(input: &str) -> Result<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("Ollama sign-in URL is empty"));
    }

    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return Ok(trimmed.to_string());
    }

    let base = Url::parse(OLLAMA_CLOUD_BASE_URL)
        .map_err(|error| anyhow!("Invalid Ollama cloud base URL: {}", error))?;
    let resolved = base
        .join(trimmed)
        .map_err(|error| anyhow!("Invalid Ollama sign-in URL '{}': {}", trimmed, error))?;
    Ok(resolved.to_string())
}

#[cfg(test)]
mod tests {
    use super::{normalize_base_url, resolve_ollama_signin_url};

    #[test]
    fn normalizes_base_url_without_path_or_query() {
        let normalized =
            normalize_base_url("http://localhost:11434/api?x=1").expect("normalized url");
        assert_eq!(normalized, "http://localhost:11434");
    }

    #[test]
    fn adds_scheme_when_missing() {
        let normalized = normalize_base_url("127.0.0.1:11434").expect("normalized url");
        assert_eq!(normalized, "http://127.0.0.1:11434");
    }

    #[test]
    fn resolves_relative_signin_urls_against_ollama_cloud() {
        let resolved = resolve_ollama_signin_url("/signup?source=signin").expect("resolved url");
        assert_eq!(resolved, "https://ollama.com/signup?source=signin");
    }
}
