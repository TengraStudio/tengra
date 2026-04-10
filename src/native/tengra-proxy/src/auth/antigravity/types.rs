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
