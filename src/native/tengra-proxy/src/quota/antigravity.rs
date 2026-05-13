/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::quota::types::{ModelQuota, QuotaInfo, QuotaResult};
use anyhow::Result;
use reqwest::Client;
use serde_json::Value;

pub async fn fetch_antigravity_quota(session_token: &str) -> Result<QuotaResult> {
    let client = Client::new();
    let url = "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels";

    let res = client
        .post(url)
        .bearer_auth(session_token)
        .header("User-Agent", "antigravity/1.107.0")
        .header("Content-Type", "application/json")
        .body("{}")
        .send()
        .await?;

    if !res.status().is_success() {
        let err_text = res.text().await?;
        return Ok(QuotaResult {
            success: false,
            quota: None,
            models: None,
            error: Some(format!("GCP API Error: {}", err_text)),
        });
    }

    let body = res.text().await?;
    let json: Value = serde_json::from_str(&body)?;

    let mut models_quota: Vec<ModelQuota> = Vec::new();
    let mut total_remaining = 0.0;
    let mut total_quota_sum = 0.0;
    let mut earliest_reset: Option<String> = None;

    if let Some(models_val) = json.get("models") {
        let models_to_process = if let Some(models_obj) = models_val.as_object() {
            models_obj
                .iter()
                .map(|(id, data)| (id.as_str(), data))
                .collect::<Vec<_>>()
        } else if let Some(models_arr) = models_val.as_array() {
            models_arr
                .iter()
                .map(|entry| {
                    let id = entry
                        .get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown");
                    (id, entry)
                })
                .collect::<Vec<_>>()
        } else {
            Vec::new()
        };

        // Pass 1: Find earliest reset across all models
        for (model_id, model_data) in &models_to_process {
            if model_id.starts_with("chat_") || model_id.starts_with("tab_") {
                continue;
            }

            let mut model_reset: Option<String> = None;
            if let Some(quota_info) = model_data.get("quotaInfo") {
                model_reset = quota_info
                    .get("resetTime")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
            }
            if let Some(quotas_arr) = model_data.get("quotas").and_then(|v| v.as_array()) {
                for q in quotas_arr {
                    if let Some(rt) = q.get("resetTime").and_then(|v| v.as_str()) {
                        if model_reset.is_none() || rt < model_reset.as_ref().unwrap().as_str() {
                            model_reset = Some(rt.to_string());
                        }
                    }
                }
            }

            if let Some(rt) = model_reset {
                if earliest_reset.is_none() || rt < *earliest_reset.as_ref().unwrap() {
                    earliest_reset = Some(rt);
                }
            }
        }

        // Pass 2: Process individual model data with the earliest_reset context
        for (model_id, model_data) in models_to_process {
            process_model_data(
                model_id,
                model_data,
                &mut models_quota,
                &mut total_remaining,
                &mut total_quota_sum,
                &earliest_reset, // Pass as immutable ref
            );
        }
    }

    fn process_model_data(
        model_id: &str,
        model_data: &Value,
        models_quota: &mut Vec<ModelQuota>,
        total_remaining: &mut f64,
        total_quota_sum: &mut f64,
        earliest_reset: &Option<String>,
    ) {
        if model_id.starts_with("chat_") || model_id.starts_with("tab_") {
            return;
        }

        let display_name = model_data
            .get("displayName")
            .and_then(|n| n.as_str())
            .unwrap_or(model_id)
            .to_string();

        let mut remaining_fraction: Option<f64> = None;
        let mut remaining_quota: Option<f64> = None;
        let mut total_quota: Option<f64> = None;
        let mut reset_time: Option<String> = None;

        if let Some(quota_info) = model_data.get("quotaInfo") {
            remaining_fraction = quota_info.get("remainingFraction").and_then(|v| v.as_f64());
            remaining_quota = quota_info.get("remainingQuota").and_then(|v| v.as_f64());
            total_quota = quota_info.get("totalQuota").and_then(|v| v.as_f64());
            reset_time = quota_info
                .get("resetTime")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
        }

        // Support for multiple quotas (e.g. 5-hour vs 7-day on premium)
        if let Some(quotas_arr) = model_data.get("quotas").and_then(|v| v.as_array()) {
            for q in quotas_arr {
                let q_fraction = q.get("remainingFraction").and_then(|v| v.as_f64());
                if let Some(f) = q_fraction {
                    if remaining_fraction.is_none() || f < remaining_fraction.unwrap() {
                        remaining_fraction = Some(f);
                        remaining_quota = q.get("remainingQuota").and_then(|v| v.as_f64());
                        total_quota = q.get("totalQuota").and_then(|v| v.as_f64());
                        reset_time = q
                            .get("resetTime")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                    }
                }
            }
        }

        // Robust fraction calculation
        let raw_final_fraction = if let (Some(rq), Some(tq)) = (remaining_quota, total_quota) {
            if tq > 0.0 {
                rq / tq
            } else {
                // If total quota is 0, it's either unlimited or exhausted.
                // For Antigravity, 0/0 usually means the account is restricted or exhausted.
                0.0
            }
        } else {
            // Fallback Detection Heuristic:
            // Google Antigravity (GCP) returns a 7-day reset (e.g. > 100h) for exhausted short-term quotas.
            // If the account is currently reporting short-term quotas for ANY model (resets < 24h),
            // then models showing long-term resets (> 48h) are almost certainly exhausted at the premium tier.
            let mut fraction = remaining_fraction.unwrap_or(1.0);

            if let Some(rt_str) = reset_time.as_ref() {
                if let Ok(rt) = chrono::DateTime::parse_from_rfc3339(rt_str) {
                    let now = chrono::Utc::now();
                    let diff = rt.with_timezone(&chrono::Utc) - now;
                    let diff_hours = diff.num_hours();

                    // If we have an earliest reset that is short-term (< 24h)
                    if let Some(earliest_rt_str) = earliest_reset.as_ref() {
                        if let Ok(earliest_rt) =
                            chrono::DateTime::parse_from_rfc3339(earliest_rt_str)
                        {
                            let earliest_diff = earliest_rt.with_timezone(&chrono::Utc) - now;

                            // Account is in "short-term reporting" mode
                            if earliest_diff.num_hours() < 24 {
                                // This specific model is in "long-term fallback" mode
                                if diff_hours > 48 {
                                    fraction = 0.0;
                                }
                            }
                        }
                    }
                }
            }

            fraction
        };

        let final_fraction = if raw_final_fraction.is_nan() || raw_final_fraction.is_infinite() {
            0.0
        } else {
            raw_final_fraction.max(0.0).min(1.0)
        };

        if let (Some(rq), Some(tq)) = (remaining_quota, total_quota) {
            if *total_quota_sum == 0.0 && tq > 0.0 {
                *total_remaining = rq;
                *total_quota_sum = tq;
            }
        }

        models_quota.push(ModelQuota {
            id: model_id.to_string(),
            name: display_name,
            remaining_fraction: final_fraction,
            remaining_quota,
            total_quota,
            reset_time,
            metadata: None,
        });
    }

    let (remaining, total) = if total_quota_sum > 0.0 {
        (total_remaining, total_quota_sum)
    } else if !models_quota.is_empty() {
        // For Antigravity, the account-level quota is best represented by the MAX
        // available fraction among all enabled models, rather than an average.
        let max_fraction: f64 = models_quota
            .iter()
            .map(|m| m.remaining_fraction)
            .fold(0.0, |a, b| a.max(b));

        (max_fraction * 100.0, 100.0)
    } else {
        (0.0, 100.0)
    };

    // Check for top-level credit info
    let quota_info_final = QuotaInfo {
        remaining,
        total,
        reset_at: earliest_reset,
        ..Default::default()
    };

    Ok(QuotaResult {
        success: true,
        quota: Some(quota_info_final),
        models: Some(models_quota),
        error: None,
    })
}
