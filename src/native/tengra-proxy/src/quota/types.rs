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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub five_hour_used_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub five_hour_reset_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weekly_used_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weekly_reset_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuotaResult {
    pub success: bool,
    pub quota: Option<QuotaInfo>,
    pub models: Option<Vec<ModelQuota>>,
    pub error: Option<String>,
}
