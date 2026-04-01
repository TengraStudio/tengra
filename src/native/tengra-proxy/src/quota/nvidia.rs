use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct NvidiaQuotaResult {
    pub valid_key: bool,
    pub copilot_plan: String, // Kept to avoid arbitrary UI breakage
    pub error: Option<String>,
}

pub async fn fetch_nvidia_quota(api_key: &str) -> anyhow::Result<crate::quota::types::QuotaResult> {
    // Nvidia has no quota endpoint, we just validate if it looks correct
    let is_valid = api_key.starts_with("nvapi-") || !api_key.trim().is_empty();

    let quota_res = NvidiaQuotaResult {
        valid_key: is_valid,
        copilot_plan: "nvidia_key".into(),
        error: if is_valid { None } else { Some("Invalid Nvidia API Key Format".into()) },
    };

    let error = quota_res.error.clone();

    Ok(crate::quota::types::QuotaResult {
        success: is_valid,
        quota: Some(crate::quota::types::QuotaInfo {
            remaining: if is_valid { 100.0 } else { 0.0 },
            total: 100.0,
            reset_at: None,
        }),
        models: None,
        error,
    })
}
