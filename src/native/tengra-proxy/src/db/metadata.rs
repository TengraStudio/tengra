/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use super::accounts::{get_linked_account, invalidate_linked_accounts_cache};
use super::client::{execute_query, QueryRequest};
use super::support::{canonical_account_id, now_ms, parse_metadata_object};
use anyhow::{anyhow, Result};
use serde_json::Value;

pub async fn update_metadata(
    account_id: &str,
    provider: &str,
    metadata: Value,
    email: Option<String>,
    display_name: Option<String>,
    avatar_url: Option<String>,
) -> Result<()> {
    let canonical_id = canonical_account_id(provider, account_id);
    let mut sql = "UPDATE linked_accounts SET metadata = $1, updated_at = $2".to_string();
    let mut params = vec![Value::String(metadata.to_string()), Value::from(now_ms())];

    if let Some(e) = email {
        sql.push_str(", email = $");
        sql.push_str(&(params.len() + 1).to_string());
        params.push(Value::String(e));
    }
    if let Some(dn) = display_name {
        sql.push_str(", display_name = $");
        sql.push_str(&(params.len() + 1).to_string());
        params.push(Value::String(dn));
    }
    if let Some(au) = avatar_url {
        sql.push_str(", avatar_url = $");
        sql.push_str(&(params.len() + 1).to_string());
        params.push(Value::String(au));
    }

    sql.push_str(" WHERE id = $");
    sql.push_str(&(params.len() + 1).to_string());
    params.push(Value::String(canonical_id));

    sql.push_str(" AND provider = $");
    sql.push_str(&(params.len() + 1).to_string());
    params.push(Value::String(provider.to_string()));

    let payload = QueryRequest { sql, params };
    let res = execute_query(&payload).await?;
    if res.status().is_success() {
        invalidate_linked_accounts_cache().await;
        Ok(())
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(anyhow!("Failed to update metadata: {}", err_text))
    }
}

pub async fn merge_metadata_patch(account_id: &str, provider: &str, patch: Value) -> Result<()> {
    let mut merged = get_linked_account(provider, account_id)
        .await?
        .map(|row| parse_metadata_object(&row))
        .unwrap_or_default();

    let mut email = None;
    let mut display_name = None;
    let mut avatar_url = None;

    if let Some(patch_map) = patch.as_object() {
        for (key, value) in patch_map {
            merged.insert(key.clone(), value.clone());
            if key == "email" {
                email = value.as_str().map(|s| s.to_string());
            } else if key == "display_name" || key == "displayName" {
                display_name = value.as_str().map(|s| s.to_string());
            } else if key == "avatar_url" || key == "avatarUrl" {
                avatar_url = value.as_str().map(|s| s.to_string());
            }
        }
    }
    update_metadata(
        account_id,
        provider,
        Value::Object(merged),
        email,
        display_name,
        avatar_url,
    )
    .await
}

pub async fn update_quota(account_id: &str, provider: &str, quota_json: Value) -> Result<()> {
    let account = get_linked_account(provider, account_id)
        .await?
        .ok_or_else(|| {
            anyhow!(
                "Account not found for quota update: {} ({})",
                account_id,
                provider
            )
        })?;

    let mut metadata = parse_metadata_object(&account);
    metadata.insert("quota".to_string(), quota_json);
    update_metadata(
        account_id,
        provider,
        Value::Object(metadata),
        None,
        None,
        None,
    )
    .await
}

pub async fn normalize_legacy_openai_linked_account_metadata() -> Result<usize> {
    let sql = "SELECT id, provider, metadata FROM linked_accounts WHERE provider = 'codex' OR provider = 'openai'";
    let rows = super::client::query(QueryRequest {
        sql: sql.to_string(),
        params: vec![],
    })
    .await?;

    let mut updated_count = 0;
    for row in rows {
        let id = row["id"].as_str().unwrap_or_default();
        if let Some(new_metadata) = super::support::normalize_openai_metadata_map(&row) {
            let sql_update =
                "UPDATE linked_accounts SET metadata = $1, updated_at = $2 WHERE id = $3";
            execute_query(&QueryRequest {
                sql: sql_update.to_string(),
                params: vec![
                    Value::String(Value::Object(new_metadata).to_string()),
                    Value::from(now_ms()),
                    Value::String(id.to_string()),
                ],
            })
            .await?;
            updated_count += 1;
        }
    }

    if updated_count > 0 {
        invalidate_linked_accounts_cache().await;
    }

    Ok(updated_count)
}
