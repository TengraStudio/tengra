/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, Debug)]
pub struct CopilotQuotaResult {
    pub copilot_plan: String,
    pub limit: i64,
    pub remaining: i64,
    pub reset: Option<String>,
    pub rate_limit: Option<CopilotRateLimit>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CopilotRateLimit {
    pub limit: i64,
    pub remaining: i64,
    pub reset: String,
}

pub async fn fetch_copilot_quota(token: &str) -> anyhow::Result<crate::quota::types::QuotaResult> {
    let client = reqwest::Client::new();

    // Fetch Copilot internal quota
    let billing_req = client
        .get("https://api.github.com/copilot_internal/user")
        .header("Authorization", format!("token {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "GithubCopilot/1.250.0")
        .send()
        .await;

    let mut quota_res = CopilotQuotaResult {
        copilot_plan: "unknown".into(),
        limit: 0,
        remaining: 0,
        reset: None,
        rate_limit: None,
        error: None,
    };

    let mut session_limits = crate::quota::types::SessionLimits::default();
    let mut session_usage = crate::quota::types::SessionUsage::default();
    let mut has_session_info = false;

    match billing_req {
        Ok(res) if res.status().is_success() => {
            if let Ok(data) = res.json::<Value>().await {
                if let Some(plan) = data.get("copilot_plan").and_then(|v| v.as_str()) {
                    quota_res.copilot_plan = plan.to_string();
                }
                if let Some(reset) = data.get("quota_reset_date").and_then(|v| v.as_str()) {
                    quota_res.reset = Some(reset.to_string());
                }

                // Extract session limits if present
                if let Some(limits) = data.get("session_limits") {
                    has_session_info = true;
                    if let Some(weekly) = limits.get("weekly") {
                        session_limits.weekly = Some(crate::quota::types::SessionLimitItem {
                            limit: weekly.get("limit").and_then(|v| v.as_i64()).unwrap_or(0),
                            current: weekly.get("current").and_then(|v| v.as_i64()).unwrap_or(0),
                            reset_at: weekly
                                .get("reset_at")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string()),
                        });
                    }
                    if let Some(sess) = limits.get("session") {
                        session_limits.session = Some(crate::quota::types::SessionLimitItem {
                            limit: sess.get("limit").and_then(|v| v.as_i64()).unwrap_or(0),
                            current: sess.get("current").and_then(|v| v.as_i64()).unwrap_or(0),
                            reset_at: sess
                                .get("reset_at")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string()),
                        });
                    }
                }

                // Extract session usage if present
                if let Some(usage) = data.get("session_usage") {
                    has_session_info = true;
                    session_usage.input_tokens = usage
                        .get("input_tokens")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    session_usage.output_tokens = usage
                        .get("output_tokens")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    session_usage.cache_read_tokens = usage
                        .get("cache_read_tokens")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    session_usage.cache_write_tokens = usage
                        .get("cache_write_tokens")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    session_usage.reasoning_tokens =
                        usage.get("reasoning_tokens").and_then(|v| v.as_i64());
                }

                if let Some(premium) = data
                    .get("quota_snapshots")
                    .and_then(|v| v.get("premium_interactions"))
                {
                    quota_res.limit = premium
                        .get("entitlement")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    quota_res.remaining = premium
                        .get("remaining")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                }
            }
        }
        Ok(res) => {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            quota_res.error = Some(format!("HTTP {} - {}", status, text));
        }
        Err(e) => {
            quota_res.error = Some(e.to_string());
        }
    }

    // Fetch Rate Limit
    if let Ok(rl_res) = client
        .get("https://api.github.com/rate_limit")
        .header("Authorization", format!("token {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "GithubCopilot/1.250.0")
        .send()
        .await
    {
        if rl_res.status().is_success() {
            if let Ok(rl_data) = rl_res.json::<Value>().await {
                if let Some(core) = rl_data.get("resources").and_then(|v| v.get("core")) {
                    let limit = core.get("limit").and_then(|v| v.as_i64()).unwrap_or(0);
                    let remaining = core.get("remaining").and_then(|v| v.as_i64()).unwrap_or(0);
                    let reset_ts = core.get("reset").and_then(|v| v.as_i64()).unwrap_or(0);

                    if let Some(dt) = chrono::DateTime::from_timestamp(reset_ts, 0) {
                        quota_res.rate_limit = Some(CopilotRateLimit {
                            limit,
                            remaining,
                            reset: dt.to_rfc3339(),
                        });
                    }
                }
            }
        }
    }

    let success = quota_res.error.is_none();
    let error = quota_res.error.clone();

    let quota_info = if success {
        Some(crate::quota::types::QuotaInfo {
            remaining: quota_res.remaining as f64,
            total: quota_res.limit as f64,
            reset_at: quota_res.reset.clone(),
            session_limits: if has_session_info {
                Some(session_limits)
            } else {
                None
            },
            session_usage: if has_session_info {
                Some(session_usage)
            } else {
                None
            },
            ..Default::default()
        })
    } else {
        None
    };

    Ok(crate::quota::types::QuotaResult {
        success,
        quota: quota_info,
        models: None,
        error,
    })
}
