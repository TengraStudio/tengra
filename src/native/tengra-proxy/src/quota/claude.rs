/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::quota::types::{QuotaInfo, QuotaResult};
use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, COOKIE, USER_AGENT};

pub async fn fetch_claude_quota(token: &str, org_id: Option<&str>) -> Result<QuotaResult> {
    let client = reqwest::Client::new();

    // 1. If org_id is missing, try to fetch it
    let final_org_id = if let Some(id) = org_id {
        id.to_string()
    } else {
        fetch_org_id(token).await?
    };

    // 2. Fetch usage
    let url = format!("https://claude.ai/api/organizations/{}/usage", final_org_id);
    let mut headers = HeaderMap::new();
    headers.insert(
        COOKIE,
        HeaderValue::from_str(&format!("sessionKey={}", token))?,
    );
    headers.insert(USER_AGENT, HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"));

    let res = client.get(&url).headers(headers).send().await?;

    if !res.status().is_success() {
        return Err(anyhow!("Failed to fetch Claude usage: {}", res.status()));
    }

    let usage: serde_json::Value = res.json().await?;

    // Map five_hour (most restrictive usually) as the primary quota
    let quota = if let Some(five) = usage.get("five_hour") {
        Some(QuotaInfo {
            remaining: 100.0
                - five
                    .get("utilization")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0),
            total: 100.0,
            reset_at: five
                .get("resets_at")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            five_hour_used_percent: None,
            five_hour_reset_at: None,
            weekly_used_percent: None,
            weekly_reset_at: None,
        })
    } else {
        None
    };

    Ok(QuotaResult {
        success: true,
        quota,
        models: None,
        error: None,
    })
}

async fn fetch_org_id(token: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let url = "https://claude.ai/api/organizations";

    let mut headers = HeaderMap::new();
    headers.insert(
        COOKIE,
        HeaderValue::from_str(&format!("sessionKey={}", token))?,
    );
    headers.insert(USER_AGENT, HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"));

    let res = client.get(url).headers(headers).send().await?;

    let orgs: serde_json::Value = res.json().await?;

    orgs.get(0)
        .and_then(|o| o.get("uuid"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow!("No organization found for Claude account"))
}
