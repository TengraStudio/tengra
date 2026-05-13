/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use super::client::{execute_query, QueryRequest};
use super::support::{account_matches_provider, canonical_account_id};
use anyhow::{anyhow, Result};
use serde_json::{Map, Value};
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

static LINKED_ACCOUNTS_CACHE: OnceLock<RwLock<Option<LinkedAccountsCache>>> = OnceLock::new();
const LINKED_ACCOUNTS_CACHE_TTL_MS: u64 = 1_500;

#[derive(Clone)]
struct LinkedAccountsCache {
    fetched_at: Instant,
    rows: Vec<Value>,
}

fn linked_accounts_cache() -> &'static RwLock<Option<LinkedAccountsCache>> {
    LINKED_ACCOUNTS_CACHE.get_or_init(|| RwLock::new(None))
}

pub async fn invalidate_linked_accounts_cache() {
    *linked_accounts_cache().write().await = None;
}

pub async fn get_all_linked_accounts() -> Result<Vec<Value>> {
    if let Some(cache) = linked_accounts_cache().read().await.clone() {
        if cache.fetched_at.elapsed() < Duration::from_millis(LINKED_ACCOUNTS_CACHE_TTL_MS) {
            return Ok(cache.rows);
        }
    }

    let payload = QueryRequest {
        sql: "SELECT * FROM linked_accounts".to_string(),
        params: vec![],
    };
    let rows = super::client::query(payload).await?;
    *linked_accounts_cache().write().await = Some(LinkedAccountsCache {
        fetched_at: Instant::now(),
        rows: rows.clone(),
    });
    Ok(rows)
}

pub async fn get_provider_accounts(provider: &str) -> Result<Vec<Value>> {
    let accounts = get_all_linked_accounts().await?;
    Ok(accounts
        .into_iter()
        .filter(|row| account_matches_provider(row, provider))
        .collect())
}

pub async fn get_linked_account(provider: &str, account_id: &str) -> Result<Option<Value>> {
    let canonical_id = canonical_account_id(provider, account_id);
    let accounts = get_provider_accounts(provider).await?;
    Ok(accounts
        .into_iter()
        .find(|row| row.get("id").and_then(|value| value.as_str()) == Some(canonical_id.as_str())))
}

pub async fn query_rows(payload: &QueryRequest) -> Result<Vec<Map<String, Value>>> {
    let rows = super::client::query(QueryRequest {
        sql: payload.sql.clone(),
        params: payload.params.clone(),
    })
    .await?;
    let mut mapped = Vec::with_capacity(rows.len());
    for row in rows {
        if let Some(object) = row.as_object() {
            mapped.push(object.clone());
        }
    }
    Ok(mapped)
}

pub async fn delete_provider_accounts_except(provider: &str, account_id: &str) -> Result<()> {
    let canonical_id = canonical_account_id(provider, account_id);
    let sql = "DELETE FROM linked_accounts WHERE provider = $1 AND id != $2";
    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![
            Value::String(provider.to_string()),
            Value::String(canonical_id),
        ],
    };

    let res = execute_query(&payload).await?;

    if res.status().is_success() {
        invalidate_linked_accounts_cache().await;
        Ok(())
    } else {
        Err(anyhow!(
            "Failed to delete duplicate provider accounts: {}",
            res.status()
        ))
    }
}
pub async fn delete_api_key(provider: &str, account_id: &str) -> Result<()> {
    let canonical_id = canonical_account_id(provider, account_id);
    let sql = "DELETE FROM linked_accounts WHERE id = $1 AND provider = $2";
    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![
            Value::String(canonical_id),
            Value::String(provider.to_string()),
        ],
    };

    let res = execute_query(&payload).await?;
    if res.status().is_success() {
        invalidate_linked_accounts_cache().await;
        Ok(())
    } else {
        Err(anyhow!("Failed to delete API key: {}", res.status()))
    }
}

pub async fn upsert_linked_account(
    account_id: &str,
    provider: &str,
    access_token: &str,
    refresh_token: Option<&str>,
    session_token: Option<&str>,
    metadata: Option<&Value>,
) -> Result<()> {
    let now = super::support::now_ms();
    let sql = "INSERT INTO linked_accounts (id, provider, access_token, refresh_token, session_token, metadata, is_active, created_at, updated_at) \
               VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8) \
               ON CONFLICT(id) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = COALESCE(EXCLUDED.refresh_token, linked_accounts.refresh_token), session_token = COALESCE(EXCLUDED.session_token, linked_accounts.session_token), metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at";

    let metadata_str = metadata
        .map(|m| m.to_string())
        .unwrap_or_else(|| "{}".to_string());

    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![
            Value::String(account_id.to_string()),
            Value::String(provider.to_string()),
            Value::String(access_token.to_string()),
            refresh_token
                .map(|s| Value::String(s.to_string()))
                .unwrap_or(Value::Null),
            session_token
                .map(|s| Value::String(s.to_string()))
                .unwrap_or(Value::Null),
            Value::String(metadata_str),
            Value::from(now),
            Value::from(now),
        ],
    };

    let res = execute_query(&payload).await?;
    if res.status().is_success() {
        invalidate_linked_accounts_cache().await;
        Ok(())
    } else {
        Err(anyhow!("Failed to upsert linked account: {}", res.status()))
    }
}

pub async fn migrate_legacy_browser_oauth_accounts() -> Result<()> {
    let sql =
        "SELECT id, provider FROM linked_accounts WHERE provider = 'google' OR provider = 'github'";
    let rows = super::client::query(QueryRequest {
        sql: sql.to_string(),
        params: vec![],
    })
    .await?;

    let mut changed = false;
    for row in rows {
        let old_id = row["id"].as_str().unwrap_or_default();
        let old_provider = row["provider"].as_str().unwrap_or_default();
        let new_provider = super::support::normalize_provider(old_provider);

        if new_provider != old_provider {
            let new_id = old_id.replace(old_provider, new_provider);
            let sql_update = "UPDATE linked_accounts SET id = $1, provider = $2 WHERE id = $3";
            execute_query(&QueryRequest {
                sql: sql_update.to_string(),
                params: vec![
                    Value::String(new_id),
                    Value::String(new_provider.to_string()),
                    Value::String(old_id.to_string()),
                ],
            })
            .await?;
            changed = true;
        }
    }

    if changed {
        invalidate_linked_accounts_cache().await;
    }

    Ok(())
}
