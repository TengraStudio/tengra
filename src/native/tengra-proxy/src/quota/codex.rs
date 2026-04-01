use crate::quota::types::{QuotaInfo, QuotaResult};
use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};

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

    let quota = if let Some(rate_limit) = wham.get("rate_limit") {
        if let Some(primary) = rate_limit.get("primary_window") {
            let used = primary.get("used").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let limit = primary.get("limit").and_then(|v| v.as_f64()).unwrap_or(1.0);
            let remaining = (limit - used).max(0.0);

            Some(QuotaInfo {
                remaining: (remaining / limit) * 100.0, // Percentage
                total: 100.0,
                reset_at: primary
                    .get("reset_at")
                    .and_then(|v| v.as_f64())
                    .map(|r| r.to_string()),
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
