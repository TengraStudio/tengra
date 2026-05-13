/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::quota::types::{QuotaInfo, QuotaResult};
use anyhow::Result;

pub async fn fetch_cursor_quota(access_token: &str) -> Result<QuotaResult> {
    let client = reqwest::Client::new();
    let url = "https://api2.cursor.sh/auth/usage";

    let res = client
        .get(url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header(
            "x-cursor-client-version",
            crate::proxy::handlers::chat::headers::detected_cursor_client_version(),
        )
        .header("x-ghost-mode", "false")
        .send()
        .await?;

    if !res.status().is_success() {
        let err = res.text().await?;
        return Ok(QuotaResult {
            success: false,
            quota: None,
            models: None,
            error: Some(format!("Cursor usage fetch failed: {}", err)),
        });
    }

    let usage: serde_json::Value = res.json().await?;

    // Helper to safely extract reset times which might be numbers (timestamps) or strings
    let parse_time = |v: Option<&serde_json::Value>| -> Option<String> {
        match v {
            Some(serde_json::Value::String(s)) => Some(s.to_string()),
            Some(serde_json::Value::Number(n)) => Some(n.to_string()),
            _ => None,
        }
    };

    // Reverse-engineered fields from Cursor's usage API
    let premium_used = usage
        .get("numRequestsInPremiumUsagePeriod")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let premium_max = usage
        .get("maxRequestsInPremiumUsagePeriod")
        .and_then(|v| v.as_f64())
        .unwrap_or(500.0);
    let premium_reset = parse_time(usage.get("premiumUsagePeriodEnd"));

    let gpt4_used = usage
        .get("numRequestsInGpt4UsagePeriod")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let gpt4_max = usage
        .get("maxRequestsInGpt4UsagePeriod")
        .and_then(|v| v.as_f64())
        .unwrap_or(50.0);
    let gpt4_reset = parse_time(usage.get("gpt4UsagePeriodEnd"));

    // Also check for Claude 3.5 Sonnet specific 5h limits if available
    let claude_used = usage
        .get("numRequestsInClaude35SonnetUsagePeriod")
        .and_then(|v| v.as_f64());
    let claude_max = usage
        .get("maxRequestsInClaude35SonnetUsagePeriod")
        .and_then(|v| v.as_f64());
    let claude_reset = parse_time(usage.get("claude35SonnetUsagePeriodEnd"));

    let mut quota_info = QuotaInfo {
        remaining: (premium_max - premium_used).max(0.0),
        total: premium_max,
        reset_at: premium_reset.clone(),
        weekly_used_percent: Some((premium_used / premium_max) * 100.0),
        weekly_reset_at: premium_reset,
        ..Default::default()
    };

    if let (Some(used), Some(max)) = (claude_used, claude_max) {
        quota_info.five_hour_used_percent = Some((used / max) * 100.0);
        quota_info.five_hour_reset_at = claude_reset.map(|s| s.to_string());
    } else {
        // Fallback to GPT-4 period for 5h if claude specific is missing
        quota_info.five_hour_used_percent = Some((gpt4_used / gpt4_max) * 100.0);
        quota_info.five_hour_reset_at = gpt4_reset;
    }

    quota_info.sanitize();

    Ok(QuotaResult {
        success: true,
        quota: Some(quota_info),
        models: None,
        error: None,
    })
}
