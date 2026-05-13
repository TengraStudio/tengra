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
use reqwest::{Client, Response};
use serde::Serialize;
use serde_json::Value;
use std::sync::OnceLock;
use std::time::Duration;
use tokio::sync::RwLock;

#[derive(Serialize)]
pub struct QueryRequest {
    pub sql: String,
    pub params: Vec<serde_json::Value>,
}

const DB_REQUEST_TIMEOUT_SECS: u64 = 10;
static DB_CLIENT: OnceLock<Client> = OnceLock::new();
static DB_QUERY_URL_CACHE: OnceLock<RwLock<Option<String>>> = OnceLock::new();

pub fn db_client() -> &'static Client {
    DB_CLIENT.get_or_init(|| {
        Client::builder()
            .connect_timeout(Duration::from_secs(3))
            .timeout(Duration::from_secs(DB_REQUEST_TIMEOUT_SECS))
            .pool_max_idle_per_host(4)
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

fn db_query_url_cache() -> &'static RwLock<Option<String>> {
    DB_QUERY_URL_CACHE.get_or_init(|| RwLock::new(None))
}

pub async fn get_db_query_url() -> Result<String> {
    if let Some(cached) = db_query_url_cache().read().await.clone() {
        return Ok(cached);
    }

    let port = std::env::var("TENGRA_DB_PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(42000);

    let url = format!("http://127.0.0.1:{}/api/v1/query", port);
    *db_query_url_cache().write().await = Some(url.clone());
    Ok(url)
}

pub async fn execute_query(payload: &QueryRequest) -> Result<Response> {
    let url = get_db_query_url().await?;
    match execute_query_once(&url, payload).await {
        Ok(response) => Ok(response),
        Err(error) => {
            *db_query_url_cache().write().await = None;
            let fallback_url = get_db_query_url().await?;
            if fallback_url == url {
                return Err(error);
            }
            execute_query_once(&fallback_url, payload).await
        }
    }
}

async fn execute_query_once(url: &str, payload: &QueryRequest) -> Result<Response> {
    let mut request = db_client().post(url.to_string()).json(payload);

    if let Ok(token) = std::env::var("TENGRA_DB_SERVICE_TOKEN") {
        let trimmed = token.trim();
        if !trimmed.is_empty() {
            request = request.bearer_auth(trimmed);
        }
    }

    Ok(request.send().await?)
}

pub async fn execute_query_json(payload: &QueryRequest) -> Result<Value> {
    let response = execute_query(payload).await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(anyhow!("Query failed with status {}: {}", status, body));
    }
    let parsed = response.json::<Value>().await?;
    Ok(parsed)
}

pub async fn query(payload: QueryRequest) -> Result<Vec<Value>> {
    let body = execute_query_json(&payload).await?;
    Ok(body
        .get("data")
        .and_then(|v| v.get("rows"))
        .and_then(|v| v.as_array())
        .cloned()
        .or_else(|| body.get("rows").and_then(|v| v.as_array()).cloned())
        .unwrap_or_default())
}
