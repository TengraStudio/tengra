/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use super::support::{metadata_string, token_value_from_row};
use super::ProviderModel;
use crate::auth::copilot::CopilotClient;
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;

pub(super) async fn fetch_copilot_models(
    client: &Client,
    row: &Value,
) -> Result<Vec<ProviderModel>, String> {
    let github_token = token_value_from_row(row, "access_token")
        .ok_or_else(|| "No Copilot GitHub token available".to_string())?;
    let mut session_token = token_value_from_row(row, "session_token");
    let mut plan = metadata_string(row, "plan")
        .or_else(|| metadata_string(row, "copilot_plan"))
        .unwrap_or_else(|| "individual".to_string());
    let account_id = row
        .get("id")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let provider = row
        .get("provider")
        .and_then(|value| value.as_str())
        .unwrap_or("copilot")
        .to_string();

    if session_token.is_none() {
        session_token = Some(
            hydrate_copilot_session_token(
                account_id.as_str(),
                provider.as_str(),
                github_token.as_str(),
                &mut plan,
            )
            .await?,
        );
    }
    let token = session_token.ok_or_else(|| "No Copilot session token available".to_string())?;

    #[derive(Deserialize)]
    struct CopilotModelData {
        id: String,
        name: Option<String>,
    }

    #[derive(Deserialize)]
    struct CopilotResponse {
        data: Vec<CopilotModelData>,
    }

    let url = match plan.as_str() {
        "business" | "enterprise" => "https://api.github.com/models",
        _ => "https://api.githubcopilot.com/models",
    };

    let response = client
        .get(url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Editor-Version", "vscode/1.90.0")
        .header("User-Agent", "GitHubCopilot/1.190.0")
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Copilot API returned error: {}", response.status()));
    }

    let parsed = response
        .json::<CopilotResponse>()
        .await
        .map_err(|error| error.to_string())?;

    Ok(parsed
        .data
        .into_iter()
        .map(|model| ProviderModel {
            id: model.id.clone(),
            name: model.name.unwrap_or(model.id),
            provider: "copilot".to_string(),
            description: Some("GitHub Copilot Model".to_string()),
            thinking_levels: None,
            quota_info: None,
        })
        .collect())
}

async fn hydrate_copilot_session_token(
    account_id: &str,
    provider: &str,
    github_token: &str,
    plan: &mut String,
) -> Result<String, String> {
    let client = CopilotClient::new();
    let session = client
        .exchange_for_copilot_token(github_token)
        .await
        .map_err(|e| e.to_string())?;

    if let Ok(new_plan) = client.fetch_copilot_plan(github_token).await {
        *plan = new_plan;
    }

    let token_json = serde_json::json!({
        "session_token": session.token,
        "expires_at": session.expires_at,
        "plan": plan,
    });

    crate::db::update_token_data(account_id, provider, token_json)
        .await
        .map_err(|error| error.to_string())?;

    Ok(session.token)
}
