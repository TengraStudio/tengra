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
    pub metadata: Option<serde_json::Value>,
}

impl ModelQuota {
    pub fn sanitize(&mut self) {
        if self.remaining_fraction.is_nan() || self.remaining_fraction.is_infinite() {
            self.remaining_fraction = 0.0;
        }
        if let Some(v) = &mut self.remaining_quota {
            if v.is_nan() || v.is_infinite() {
                self.remaining_quota = Some(0.0);
            }
        }
        if let Some(v) = &mut self.total_quota {
            if v.is_nan() || v.is_infinite() {
                self.total_quota = Some(0.0);
            }
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SessionLimitItem {
    pub limit: i64,
    pub current: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reset_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SessionLimits {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weekly: Option<SessionLimitItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session: Option<SessionLimitItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SessionUsage {
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_read_tokens: i64,
    pub cache_write_tokens: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_tokens: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_limits: Option<SessionLimits>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_usage: Option<SessionUsage>,
}

impl QuotaInfo {
    pub fn sanitize(&mut self) {
        if self.remaining.is_nan() || self.remaining.is_infinite() {
            self.remaining = 0.0;
        }
        if self.total.is_nan() || self.total.is_infinite() {
            self.total = 0.0;
        }
        if let Some(v) = &mut self.five_hour_used_percent {
            if v.is_nan() || v.is_infinite() {
                self.five_hour_used_percent = Some(0.0);
            }
        }
        if let Some(v) = &mut self.weekly_used_percent {
            if v.is_nan() || v.is_infinite() {
                self.weekly_used_percent = Some(0.0);
            }
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuotaResult {
    pub success: bool,
    pub quota: Option<QuotaInfo>,
    pub models: Option<Vec<ModelQuota>>,
    pub error: Option<String>,
}
