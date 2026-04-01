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
        .header("User-Agent", "antigravity/1.104.0 darwin/arm64")
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

    if let Some(models) = json.get("models").and_then(|m| m.as_object()) {
        for (model_id, model_data) in models {
            let display_name = model_data
                .get("displayName")
                .and_then(|n| n.as_str())
                .unwrap_or(model_id)
                .to_string();

            let mut remaining_fraction = 1.0;
            let mut remaining_quota: Option<f64> = None;
            let mut total_quota: Option<f64> = None;
            let mut reset_time: Option<String> = None;

            if let Some(quota_info) = model_data.get("quotaInfo") {
                if let Some(rf) = quota_info.get("remainingFraction").and_then(|v| v.as_f64()) {
                    remaining_fraction = rf;
                }
                if let Some(rq) = quota_info.get("remainingQuota").and_then(|v| v.as_f64()) {
                    remaining_quota = Some(rq);
                }
                if let Some(tq) = quota_info.get("totalQuota").and_then(|v| v.as_f64()) {
                    total_quota = Some(tq);
                }
                if let Some(rt) = quota_info.get("resetTime").and_then(|v| v.as_str()) {
                    reset_time = Some(rt.to_string());
                    if earliest_reset.is_none() || reset_time.as_ref() < earliest_reset.as_ref() {
                        earliest_reset = reset_time.clone();
                    }
                }
            }

            if let (Some(rq), Some(tq)) = (remaining_quota, total_quota) {
                if total_quota_sum == 0.0 {
                    total_remaining = rq;
                    total_quota_sum = tq;
                }
            }

            models_quota.push(ModelQuota {
                id: model_id.clone(),
                name: display_name,
                remaining_fraction,
                remaining_quota,
                total_quota,
                reset_time,
            });
        }
    }

    let (remaining, total) = if total_quota_sum > 0.0 {
        (total_remaining, total_quota_sum)
    } else if !models_quota.is_empty() {
        let avg_fraction: f64 = models_quota
            .iter()
            .map(|m| m.remaining_fraction)
            .sum::<f64>()
            / models_quota.len() as f64;
        (avg_fraction * 100.0, 100.0)
    } else {
        (100.0, 100.0)
    };

    Ok(QuotaResult {
        success: true,
        quota: Some(QuotaInfo {
            remaining,
            total,
            reset_at: earliest_reset,
        }),
        models: Some(models_quota),
        error: None,
    })
}
