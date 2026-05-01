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
        if let Some(models_obj) = models_val.as_object() {
            for (model_id, model_data) in models_obj {
                process_model_data(
                    model_id,
                    model_data,
                    &mut models_quota,
                    &mut total_remaining,
                    &mut total_quota_sum,
                    &mut earliest_reset,
                );
            }
        } else if let Some(models_arr) = models_val.as_array() {
            for model_entry in models_arr {
                let model_id = model_entry
                    .get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                process_model_data(
                    model_id,
                    model_entry,
                    &mut models_quota,
                    &mut total_remaining,
                    &mut total_quota_sum,
                    &mut earliest_reset,
                );
            }
        }
    }

    fn process_model_data(
        model_id: &str,
        model_data: &Value,
        models_quota: &mut Vec<ModelQuota>,
        total_remaining: &mut f64,
        total_quota_sum: &mut f64,
        earliest_reset: &mut Option<String>,
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

            if let Some(rt) = quota_info.get("resetTime").and_then(|v| v.as_str()) {
                let rt_str = rt.to_string();
                reset_time = Some(rt_str.clone());
                if earliest_reset.is_none() || reset_time.as_ref() < earliest_reset.as_ref() {
                    *earliest_reset = Some(rt_str);
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
            // No absolute quota, use fraction or reset time heuristic
            let mut fraction = remaining_fraction.unwrap_or(0.0);

            // Heuristic for restricted accounts:
            // Google often returns rf=1.0 and a resetTime exactly 7 days away for restricted/exhausted accounts.
            // Healthy accounts on free tier reset daily (24h) or hourly.
            if let Some(rt_str) = reset_time.as_ref() {
                if let Ok(rt) = chrono::DateTime::parse_from_rfc3339(rt_str) {
                    let now = chrono::Utc::now();
                    let diff = rt.with_timezone(&chrono::Utc) - now;

                    // If reset is more than 3 days away, it's likely a weekly/restricted limit
                    // and if remaining_fraction is 1.0 (default for restricted), it's probably fake.
                    if diff.num_hours() > 72 {
                        if fraction >= 1.0 || remaining_fraction.is_none() {
                            fraction = 0.0;
                        }
                    }
                } else if remaining_fraction.is_none() {
                    // Fallback: if we have a reset time but NO fraction/quota, it's likely exhausted
                    fraction = 0.0;
                }
            } else if remaining_fraction.is_none() {
                // No quota info at all -> assume exhausted/restricted
                fraction = 0.0;
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
        // If we have models but no absolute quota, use the average fraction
        let sum: f64 = models_quota.iter().map(|m| m.remaining_fraction).sum();
        let count = models_quota.len() as f64;
        let avg_fraction = if count > 0.0 { sum / count } else { 0.0 };

        // Ensure we don't return NaN or Infinity
        let safe_fraction = if avg_fraction.is_nan() || avg_fraction.is_infinite() {
            0.0
        } else {
            avg_fraction.max(0.0).min(1.0)
        };

        (safe_fraction * 100.0, 100.0)
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
