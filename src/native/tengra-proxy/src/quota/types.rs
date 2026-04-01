use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelQuota {
    pub id: String,
    pub name: String,
    pub remaining_fraction: f64,
    pub remaining_quota: Option<f64>,
    pub total_quota: Option<f64>,
    pub reset_time: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuotaInfo {
    pub remaining: f64,
    pub total: f64,
    pub reset_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuotaResult {
    pub success: bool,
    pub quota: Option<QuotaInfo>,
    pub models: Option<Vec<ModelQuota>>,
    pub error: Option<String>,
}
