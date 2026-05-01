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
use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use serde_json::Value;

pub async fn fetch_codex_quota(token: &str) -> Result<QuotaResult> {
    let client = reqwest::Client::new();

    // WHAM usage endpoint
    let url = "https://chatgpt.com/backend-api/wham/usage";

    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", token))?,
    );
    headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
    headers.insert(USER_AGENT, HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"));

    let res = client.get(url).headers(headers).send().await?;

    if !res.status().is_success() {
        return Err(anyhow!("Failed to fetch Codex usage: {}", res.status()));
    }

    let wham: serde_json::Value = res.json().await?;

    let quota = if let Some(rate_limit) = wham.get("rate_limit").or_else(|| wham.get("usage")) {
        let five_hour = pick_window(
            rate_limit,
            &["primary_window", "five_hour", "five_hour_window", "5h"],
        );
        let weekly = pick_window(
            rate_limit,
            &["secondary_window", "weekly", "weekly_window", "7d"],
        );
        let primary = five_hour.or_else(|| pick_window(rate_limit, &["primary_window"]));

        if let Some(primary_window) = primary {
            let five_hour_used_percent = five_hour.and_then(to_used_percent_window);
            let weekly_used_percent = weekly.and_then(to_used_percent_window);
            let primary_used_percent = to_used_percent_window(primary_window);

            let selected_used_percent = five_hour_used_percent
                .or(primary_used_percent)
                .or(weekly_used_percent);
            let Some(used_percent) = selected_used_percent else {
                return Err(anyhow!("Unsupported Codex quota payload shape"));
            };
            let remaining_percent = (100.0 - used_percent).clamp(0.0, 100.0);

            Some(QuotaInfo {
                remaining: remaining_percent,
                total: 100.0,
                reset_at: extract_reset_at(primary_window),
                five_hour_used_percent,
                five_hour_reset_at: five_hour.and_then(extract_reset_at),
                weekly_used_percent,
                weekly_reset_at: weekly.and_then(extract_reset_at),
                ..Default::default()
            })
        } else {
            None
        }
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

fn to_used_percent(used: Option<&Value>, limit: Option<&Value>) -> Option<f64> {
    let used = used.and_then(|v| v.as_f64())?;
    let limit = limit.and_then(|v| v.as_f64())?;
    if limit <= 0.0 {
        return Some(100.0);
    }
    Some(((used / limit) * 100.0).clamp(0.0, 100.0))
}

fn to_used_percent_window(window: &Value) -> Option<f64> {
    if let Some(value) = read_number(
        window,
        &["used_percent", "usage_percent", "percentage_used"],
    ) {
        return Some(value.clamp(0.0, 100.0));
    }
    if let Some(value) = read_number(window, &["remaining_percent", "percentage_remaining"]) {
        return Some((100.0 - value).clamp(0.0, 100.0));
    }
    if let Some(value) = read_number(window, &["remaining_fraction"]) {
        return Some((100.0 - (value * 100.0)).clamp(0.0, 100.0));
    }
    to_used_percent(
        read_value(window, &["used", "consumed"]),
        read_value(window, &["limit", "max", "total"]),
    )
}

fn extract_reset_at(window: &Value) -> Option<String> {
    if let Some(s) =
        read_value(window, &["reset_at", "resets_at", "resetAt"]).and_then(|v| v.as_str())
    {
        return Some(s.to_string());
    }
    if let Some(n) =
        read_value(window, &["reset_at", "resets_at", "resetAt"]).and_then(|v| v.as_f64())
    {
        return Some(n.to_string());
    }
    None
}

fn pick_window<'a>(rate_limit: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    for key in keys {
        if let Some(value) = rate_limit.get(*key) {
            return Some(value);
        }
    }
    // Fallback for payloads that store windows in an array.
    if let Some(windows) = rate_limit.get("windows").and_then(|v| v.as_array()) {
        for key in keys {
            let key_lower = key.to_ascii_lowercase();
            if let Some(found) = windows.iter().find(|item| {
                let obj = item.as_object();
                let name = obj
                    .and_then(|o| o.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let kind = obj
                    .and_then(|o| o.get("type"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let combined = format!(
                    "{} {}",
                    name.to_ascii_lowercase(),
                    kind.to_ascii_lowercase()
                );
                combined.contains(&key_lower)
            }) {
                return Some(found);
            }
        }
    }
    None
}

fn read_value<'a>(obj: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    for key in keys {
        if let Some(value) = obj.get(*key) {
            return Some(value);
        }
    }
    None
}

fn read_number(obj: &Value, keys: &[&str]) -> Option<f64> {
    let val = read_value(obj, keys)?;
    if let Some(n) = val.as_f64() {
        return Some(n);
    }
    if let Some(s) = val.as_str() {
        return s.parse::<f64>().ok();
    }
    None
}
