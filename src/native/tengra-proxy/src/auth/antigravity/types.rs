/**
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
pub struct AntigravityAiCredit {
    #[serde(rename = "creditType")]
    pub credit_type: String,
    #[serde(rename = "creditAmount")]
    pub credit_amount: String,
    #[serde(rename = "minimumCreditAmountForUsage")]
    pub minimum_credit_amount_for_usage: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AntigravityPaidTier {
    pub id: String,
    pub name: String,
    #[serde(rename = "availableCredits")]
    pub available_credits: Vec<AntigravityAiCredit>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AntigravityToken {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub token_type: String,
}

#[derive(Deserialize)]
pub struct AuthQuery {
    pub code: String,
    pub state: String,
}
