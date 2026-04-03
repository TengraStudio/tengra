use anyhow::{anyhow, Result};
use reqwest::{Client, Response};
use serde::Serialize;
use serde_json::{Map, Value};
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Serialize)]
pub struct QueryRequest {
    pub sql: String,
    pub params: Vec<serde_json::Value>,
}

const DB_REQUEST_TIMEOUT_SECS: u64 = 10;
const CALLBACK_DB_WRITE_RETRY_BACKOFF_MS: u64 = 250;

static DB_CLIENT: OnceLock<Client> = OnceLock::new();
static DB_QUERY_URL_CACHE: OnceLock<RwLock<Option<String>>> = OnceLock::new();
static LINKED_ACCOUNTS_CACHE: OnceLock<RwLock<Option<LinkedAccountsCache>>> = OnceLock::new();

const LINKED_ACCOUNTS_CACHE_TTL_MS: u64 = 1_500;

#[derive(Clone)]
struct LinkedAccountsCache {
    fetched_at: Instant,
    rows: Vec<Value>,
}

fn get_db_port_path() -> Option<PathBuf> {
    // Windows: %APPDATA%/Tengra/services/db-service.port
    let app_data = std::env::var("APPDATA").ok()?;
    let path = PathBuf::from(app_data)
        .join("Tengra")
        .join("services")
        .join("db-service.port");

    if path.exists() {
        Some(path)
    } else {
        // Fallback for lower case "tengra"
        let path_lower = PathBuf::from(std::env::var("APPDATA").ok()?)
            .join("tengra")
            .join("services")
            .join("db-service.port");
        if path_lower.exists() {
            Some(path_lower)
        } else {
            None
        }
    }
}

fn db_client() -> &'static Client {
    DB_CLIENT.get_or_init(|| {
        Client::builder()
            .connect_timeout(Duration::from_secs(3))
            .timeout(Duration::from_secs(DB_REQUEST_TIMEOUT_SECS))
            .pool_max_idle_per_host(4)
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

fn db_query_url_cache() -> &'static RwLock<Option<String>> {
    DB_QUERY_URL_CACHE.get_or_init(|| RwLock::new(None))
}

fn linked_accounts_cache() -> &'static RwLock<Option<LinkedAccountsCache>> {
    LINKED_ACCOUNTS_CACHE.get_or_init(|| RwLock::new(None))
}

fn extract_query_rows(body: &Value) -> Option<Vec<Value>> {
    body.get("data")
        .and_then(|value| value.get("rows"))
        .and_then(|value| value.as_array())
        .cloned()
        .or_else(|| body.get("rows").and_then(|value| value.as_array()).cloned())
}

async fn get_db_query_url() -> Result<String> {
    if let Some(cached) = db_query_url_cache().read().await.clone() {
        return Ok(cached);
    }
    let port_path = get_db_port_path().ok_or_else(|| anyhow!("db-service.port file not found"))?;
    let port_str = fs::read_to_string(port_path)?.trim().to_string();
    let port: u16 = port_str.parse()?;
    let url = format!("http://127.0.0.1:{}/api/v1/query", port);
    *db_query_url_cache().write().await = Some(url.clone());
    Ok(url)
}

async fn execute_query(payload: &QueryRequest) -> Result<Response> {
    let url = get_db_query_url().await?;
    match execute_query_once(&url, payload).await {
        Ok(response) => Ok(response),
        Err(error) => {
            *db_query_url_cache().write().await = None;
            let fallback_url = get_db_query_url().await?;
            if fallback_url == url {
                return Err(error);
            }
            execute_query_once(&fallback_url, payload).await
        }
    }
}

pub async fn execute_query_json(payload: &QueryRequest) -> Result<Value> {
    let response = execute_query(payload).await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(anyhow!("Query failed with status {}: {}", status, body));
    }
    let parsed = response.json::<Value>().await?;
    Ok(parsed)
}

pub async fn query_rows(payload: &QueryRequest) -> Result<Vec<Map<String, Value>>> {
    let body = execute_query_json(payload).await?;
    let rows = extract_query_rows(&body).unwrap_or_default();
    let mut mapped = Vec::with_capacity(rows.len());
    for row in rows {
        if let Some(object) = row.as_object() {
            mapped.push(object.clone());
        }
    }
    Ok(mapped)
}

async fn execute_query_once(url: &str, payload: &QueryRequest) -> Result<Response> {
    let mut request = db_client().post(url.to_string()).json(payload);

    if let Ok(token) = std::env::var("TENGRA_DB_SERVICE_TOKEN") {
        let trimmed = token.trim();
        if !trimmed.is_empty() {
            request = request.bearer_auth(trimmed);
        }
    }

    Ok(request.send().await?)
}

fn normalize_provider(provider: &str) -> &str {
    match provider {
        // OAuth-based providers (keep separate)
        "codex" => "codex",
        "antigravity" => "antigravity",
        "copilot" => "copilot",

        // Anthropic
        "anthropic" => "claude",

        // Google
        "google" => "gemini",

        // GitHub
        "github" => "copilot",

        // NVIDIA
        "nvidia_key" | "nim" | "nim_openai" => "nvidia",

        // All API-key providers stay as-is
        _ => provider,
    }
}

fn provider_matches(row_provider: &str, requested_provider: &str) -> bool {
    normalize_provider(row_provider) == normalize_provider(requested_provider)
}

fn canonical_account_id(provider: &str, account_id: &str) -> String {
    if account_id == "default" {
        return format!("{}_default", normalize_provider(provider));
    }

    account_id.to_string()
}

fn generate_browser_account_id(provider: &str) -> String {
    format!(
        "{}_{}",
        normalize_provider(provider),
        Uuid::new_v4().simple()
    )
}

fn parse_metadata_object(row: &Value) -> Map<String, Value> {
    match row.get("metadata") {
        Some(Value::Object(map)) => map.clone(),
        Some(Value::String(text)) => serde_json::from_str::<Value>(text)
            .ok()
            .and_then(|value| value.as_object().cloned())
            .unwrap_or_default(),
        _ => Map::new(),
    }
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn string_field(row: &Value, key: &str) -> Option<String> {
    row.get(key)
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn bool_field(row: &Value, key: &str) -> bool {
    row.get(key)
        .and_then(|value| value.as_bool())
        .unwrap_or(false)
}

fn int_field(row: &Value, key: &str) -> Option<i64> {
    row.get(key).and_then(|value| value.as_i64())
}

fn resolved_email(row: &Value) -> Option<String> {
    string_field(row, "email").or_else(|| {
        parse_metadata_object(row)
            .get("email")
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    })
}

fn merged_metadata(target: &Value, legacy: &Value, prefer_legacy: bool) -> String {
    let mut older = if prefer_legacy {
        parse_metadata_object(target)
    } else {
        parse_metadata_object(legacy)
    };
    let newer = if prefer_legacy {
        parse_metadata_object(legacy)
    } else {
        parse_metadata_object(target)
    };
    for (key, value) in newer {
        older.insert(key, value);
    }
    Value::Object(older).to_string()
}

fn pick_string(preferred: &Value, fallback: &Value, key: &str) -> Value {
    if let Some(value) = string_field(preferred, key) {
        return Value::String(value);
    }
    if let Some(value) = string_field(fallback, key) {
        return Value::String(value);
    }
    Value::Null
}

fn pick_optional_i64(preferred: &Value, fallback: &Value, key: &str) -> Value {
    if let Some(value) = int_field(preferred, key) {
        return Value::from(value);
    }
    if let Some(value) = int_field(fallback, key) {
        return Value::from(value);
    }
    Value::Null
}

fn normalize_openai_metadata_map(row: &Value) -> Option<Map<String, Value>> {
    let mut metadata = parse_metadata_object(row);
    let token_object = metadata.get("token").and_then(Value::as_object).cloned();
    let mut changed = false;

    let Some(token) = token_object else {
        return None;
    };

    for key in [
        "access_token",
        "refresh_token",
        "session_token",
        "expires_at",
        "expires_in",
    ] {
        if !metadata.contains_key(key) {
            if let Some(value) = token.get(key).cloned() {
                metadata.insert(key.to_string(), value);
                changed = true;
            }
        }
    }

    if metadata
        .get("oauth_provider")
        .and_then(Value::as_str)
        .is_none()
    {
        metadata.insert(
            "oauth_provider".to_string(),
            Value::String("openai".to_string()),
        );
        changed = true;
    }

    if let Some(existing_org) = token
        .get("organization")
        .or_else(|| token.get("org"))
        .cloned()
    {
        if !metadata.contains_key("organization") {
            metadata.insert("organization".to_string(), existing_org);
            changed = true;
        }
    }

    if metadata
        .get("migrated_by")
        .and_then(Value::as_str)
        .is_none()
    {
        metadata.insert(
            "migrated_by".to_string(),
            Value::String("oauth-bridge-openai-metadata-v1".to_string()),
        );
        changed = true;
    }

    if metadata
        .get("migration_ts")
        .and_then(Value::as_i64)
        .is_none()
    {
        metadata.insert("migration_ts".to_string(), Value::from(now_ms()));
        changed = true;
    }

    changed.then_some(metadata)
}

fn emit_auth_update(provider: &str, account_id: &str, token_data: &Value) {
    let payload = serde_json::json!({
        "provider": provider,
        "accountId": account_id,
        "tokenData": token_data,
    });
    eprintln!("__TENGRA_AUTH_UPDATE__:{}", payload);
}

async fn update_metadata(account_id: &str, provider: &str, metadata: Value) -> Result<()> {
    let canonical_id = canonical_account_id(provider, account_id);
    let sql = "UPDATE linked_accounts SET metadata = $1, updated_at = $2 \
               WHERE id = $3 AND provider = $4";
    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![
            Value::String(metadata.to_string()),
            Value::from(now_ms()),
            Value::String(canonical_id),
            Value::String(provider.to_string()),
        ],
    };

    let res = execute_query(&payload).await?;
    if res.status().is_success() {
        invalidate_linked_accounts_cache().await;
        return Ok(());
    }

    let err_text = res.text().await?;
    Err(anyhow!("Failed to update metadata: {}", err_text))
}

pub async fn merge_metadata_patch(account_id: &str, provider: &str, patch: Value) -> Result<()> {
    let mut merged = get_linked_account(provider, account_id)
        .await?
        .map(|row| parse_metadata_object(&row))
        .unwrap_or_default();
    if let Some(patch_map) = patch.as_object() {
        for (key, value) in patch_map {
            merged.insert(key.clone(), value.clone());
        }
    }
    update_metadata(account_id, provider, Value::Object(merged)).await
}

async fn invalidate_linked_accounts_cache() {
    *linked_accounts_cache().write().await = None;
}

pub async fn save_token(
    token_data: serde_json::Value,
    account_id: &str,
    provider: &str,
) -> Result<()> {
    let canonical_id = canonical_account_id(provider, account_id);
    eprintln!(
        "[INFO] Linked account upsert: provider={}, account={}",
        provider, canonical_id
    );

    let mut access_token = token_data
        .get("access_token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let mut refresh_token = token_data
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let mut session_token = token_data
        .get("session_token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let scope = token_data
        .get("scope")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let expires_at = token_data.get("expires_at").and_then(|v| v.as_i64());
    let metadata_json = serde_json::to_string(&token_data).unwrap_or_default();

    // --- ENCRYPTION ---
    if let Ok(master_key) = crate::security::load_master_key() {
        if !access_token.is_empty() && !access_token.starts_with("Tengra:v1:") {
            if let Ok(enc) = crate::security::encrypt_token(&access_token, &master_key) {
                access_token = enc;
            }
        }
        if !refresh_token.is_empty() && !refresh_token.starts_with("Tengra:v1:") {
            if let Ok(enc) = crate::security::encrypt_token(&refresh_token, &master_key) {
                refresh_token = enc;
            }
        }
        if !session_token.is_empty() && !session_token.starts_with("Tengra:v1:") {
            if let Ok(enc) = crate::security::encrypt_token(&session_token, &master_key) {
                session_token = enc;
            }
        }
    }

    let now = now_ms();
    let sql = "INSERT INTO linked_accounts (id, provider, access_token, refresh_token, session_token, expires_at, scope, metadata, is_active, created_at, updated_at) \
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10) \
               ON CONFLICT(id) DO UPDATE SET provider = EXCLUDED.provider, access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, session_token = EXCLUDED.session_token, expires_at = EXCLUDED.expires_at, scope = EXCLUDED.scope, metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at";

    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![
            serde_json::Value::String(canonical_id.clone()),
            serde_json::Value::String(provider.to_string()),
            serde_json::Value::String(access_token),
            serde_json::Value::String(refresh_token),
            if session_token.is_empty() {
                serde_json::Value::Null
            } else {
                serde_json::Value::String(session_token)
            },
            expires_at
                .map(serde_json::Value::from)
                .unwrap_or(serde_json::Value::Null),
            serde_json::Value::String(scope),
            serde_json::Value::String(metadata_json),
            Value::from(now),
            Value::from(now),
        ],
    };

    let res = execute_query(&payload).await?;

    if res.status().is_success() {
        invalidate_linked_accounts_cache().await;
        emit_auth_update(provider, &canonical_id, &token_data);
        Ok(())
    } else {
        let err_text = res.text().await?;
        Err(anyhow!("Failed to save token to DB: {}", err_text))
    }
}

fn callback_retry_backoff_ms(attempt: u32) -> u64 {
    CALLBACK_DB_WRITE_RETRY_BACKOFF_MS.saturating_mul(attempt as u64)
}

pub async fn save_token_with_retry(
    token_data: serde_json::Value,
    account_id: &str,
    provider: &str,
    max_attempts: u32,
) -> Result<()> {
    let attempts = max_attempts.max(1);
    let canonical_id = canonical_account_id(provider, account_id);
    let mut last_error = String::new();

    for attempt in 1..=attempts {
        match save_token(token_data.clone(), account_id, provider).await {
            Ok(()) => return Ok(()),
            Err(error) => {
                last_error = error.to_string();
                eprintln!(
                    "[WARN] OAuth callback DB write attempt {}/{} failed for {} ({}): {}",
                    attempt, attempts, provider, canonical_id, last_error
                );
                if attempt < attempts {
                    tokio::time::sleep(Duration::from_millis(callback_retry_backoff_ms(attempt)))
                        .await;
                }
            }
        }
    }

    let failure_payload = serde_json::json!({
        "provider": provider,
        "accountId": canonical_id,
        "attempts": attempts,
        "error": last_error
    });
    eprintln!("__TENGRA_AUTH_UPDATE_FAILURE__:{}", failure_payload);
    Err(anyhow!(
        "OAuth callback DB write failed after {} attempts for {} ({}): {}",
        attempts,
        provider,
        account_id,
        last_error
    ))
}

pub async fn update_quota(
    account_id: &str,
    provider: &str,
    quota_json: serde_json::Value,
) -> Result<()> {
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
    update_metadata(account_id, provider, Value::Object(metadata)).await
}

pub async fn get_all_linked_accounts() -> Result<Vec<serde_json::Value>> {
    if let Some(cache) = linked_accounts_cache().read().await.clone() {
        if cache.fetched_at.elapsed() < Duration::from_millis(LINKED_ACCOUNTS_CACHE_TTL_MS) {
            return Ok(cache.rows);
        }
    }

    let sql = "SELECT * FROM linked_accounts";
    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![],
    };

    let res = execute_query(&payload).await?;

    if !res.status().is_success() {
        return Ok(vec![]);
    }

    let body: serde_json::Value = res.json().await?;
    if let Some(cached_rows) = extract_query_rows(&body) {
        *linked_accounts_cache().write().await = Some(LinkedAccountsCache {
            fetched_at: Instant::now(),
            rows: cached_rows.clone(),
        });
        return Ok(cached_rows);
    }

    Ok(vec![])
}

pub async fn get_provider_accounts(provider: &str) -> Result<Vec<Value>> {
    let accounts = get_all_linked_accounts().await?;
    Ok(accounts
        .into_iter()
        .filter(|row| {
            row.get("provider")
                .and_then(|value| value.as_str())
                .map(|row_provider| provider_matches(row_provider, provider))
                .unwrap_or(false)
        })
        .collect())
}

pub async fn get_linked_account(provider: &str, account_id: &str) -> Result<Option<Value>> {
    let canonical_id = canonical_account_id(provider, account_id);
    let accounts = get_provider_accounts(provider).await?;
    Ok(accounts
        .into_iter()
        .find(|row| row.get("id").and_then(|value| value.as_str()) == Some(canonical_id.as_str())))
}

/// Saves an API key for a provider (claude, codex, nvidia, gemini).
/// Stored in linked_accounts with access_token = api_key.
pub async fn save_api_key(provider: &str, api_key: &str, account_id: &str) -> Result<()> {
    let canonical_id = canonical_account_id(provider, account_id);
    let mut encrypted_key = api_key.to_string();

    // --- ENCRYPTION ---
    if let Ok(master_key) = crate::security::load_master_key() {
        if !encrypted_key.starts_with("Tengra:v1:") {
            if let Ok(enc) = crate::security::encrypt_token(&encrypted_key, &master_key) {
                encrypted_key = enc;
            }
        }
    }

    let metadata = serde_json::json!({ "type": "api_key" }).to_string();

    let now = now_ms();
    let sql = "INSERT INTO linked_accounts (id, provider, access_token, metadata, is_active, created_at, updated_at) \
               VALUES ($1, $2, $3, $4, 1, $5, $6) \
               ON CONFLICT(id) DO UPDATE SET provider = EXCLUDED.provider, access_token = EXCLUDED.access_token, metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at";

    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![
            serde_json::Value::String(canonical_id),
            serde_json::Value::String(provider.to_string()),
            serde_json::Value::String(encrypted_key),
            serde_json::Value::String(metadata),
            Value::from(now),
            Value::from(now),
        ],
    };

    let res = execute_query(&payload).await?;

    if res.status().is_success() {
        invalidate_linked_accounts_cache().await;
        Ok(())
    } else {
        let err_text = res.text().await?;
        Err(anyhow!("Failed to save API key: {}", err_text))
    }
}

/// Retrieves all API keys for a given provider.
pub async fn get_api_keys(provider: &str) -> Result<Vec<serde_json::Value>> {
    Ok(get_provider_accounts(provider)
        .await?
        .into_iter()
        .filter(|row| {
            parse_metadata_object(row)
                .get("type")
                .and_then(|value| value.as_str())
                == Some("api_key")
        })
        .collect())
}

/// Deletes an API key entry for a given provider and account.
pub async fn delete_api_key(provider: &str, account_id: &str) -> Result<()> {
    let canonical_id = canonical_account_id(provider, account_id);
    let sql = "DELETE FROM linked_accounts WHERE id = $1 AND provider = $2";
    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![
            serde_json::Value::String(canonical_id),
            serde_json::Value::String(provider.to_string()),
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

pub async fn update_token_data(
    account_id: &str,
    provider: &str,
    token_data: serde_json::Value,
) -> Result<()> {
    let canonical_id = canonical_account_id(provider, account_id);
    let mut access_token = token_data
        .get("access_token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let mut refresh_token = token_data
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let mut session_token = token_data
        .get("session_token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let expires_at = token_data.get("expires_at").and_then(|v| v.as_i64());
    let mut merged_metadata = get_linked_account(provider, account_id)
        .await?
        .map(|row| parse_metadata_object(&row))
        .unwrap_or_default();
    if let Some(token_map) = token_data.as_object() {
        for (key, value) in token_map {
            merged_metadata.insert(key.clone(), value.clone());
        }
    }
    let metadata_json = Value::Object(merged_metadata).to_string();

    // --- ENCRYPTION ---
    if let Ok(master_key) = crate::security::load_master_key() {
        if !access_token.is_empty() && !access_token.starts_with("Tengra:v1:") {
            if let Ok(enc) = crate::security::encrypt_token(&access_token, &master_key) {
                access_token = enc;
            }
        }
        if !refresh_token.is_empty() && !refresh_token.starts_with("Tengra:v1:") {
            if let Ok(enc) = crate::security::encrypt_token(&refresh_token, &master_key) {
                refresh_token = enc;
            }
        }
        if !session_token.is_empty() && !session_token.starts_with("Tengra:v1:") {
            if let Ok(enc) = crate::security::encrypt_token(&session_token, &master_key) {
                session_token = enc;
            }
        }
    }

    let sql = "UPDATE linked_accounts SET access_token = $1, refresh_token = $2, session_token = $3, expires_at = $4, metadata = $5, updated_at = $6 WHERE id = $7 AND provider = $8";
    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![
            serde_json::Value::String(access_token),
            serde_json::Value::String(refresh_token),
            if session_token.is_empty() {
                serde_json::Value::Null
            } else {
                serde_json::Value::String(session_token)
            },
            expires_at
                .map(serde_json::Value::from)
                .unwrap_or(serde_json::Value::Null),
            serde_json::Value::String(metadata_json),
            Value::from(now_ms()),
            serde_json::Value::String(canonical_id),
            serde_json::Value::String(provider.to_string()),
        ],
    };

    let res = execute_query(&payload).await?;

    if res.status().is_success() {
        invalidate_linked_accounts_cache().await;
        Ok(())
    } else {
        Err(anyhow!(
            "Failed to update token_data in DB: {}",
            res.status()
        ))
    }
}

pub async fn clear_account_tokens(account_id: &str, provider: &str) -> Result<()> {
    let canonical_id = canonical_account_id(provider, account_id);
    let sql = "UPDATE linked_accounts \
               SET access_token = NULL, refresh_token = NULL, session_token = NULL, expires_at = NULL, updated_at = $1 \
               WHERE id = $2 AND provider = $3";
    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![
            Value::from(now_ms()),
            serde_json::Value::String(canonical_id),
            serde_json::Value::String(provider.to_string()),
        ],
    };

    let res = execute_query(&payload).await?;
    if res.status().is_success() {
        invalidate_linked_accounts_cache().await;
        return Ok(());
    }

    Err(anyhow!("Failed to clear account tokens: {}", res.status()))
}

pub async fn migrate_legacy_browser_oauth_accounts() -> Result<()> {
    for provider in ["codex", "claude", "antigravity"] {
        let legacy_id = format!("{}_default", provider);
        let accounts = get_provider_accounts(provider).await?;
        let legacy_row = accounts
            .iter()
            .find(|row| string_field(row, "id").as_deref() == Some(legacy_id.as_str()))
            .cloned();
        let Some(legacy_row) = legacy_row else {
            continue;
        };

        let legacy_email = resolved_email(&legacy_row);
        let duplicate_row = legacy_email.as_ref().and_then(|email| {
            accounts
                .iter()
                .filter(|row| string_field(row, "id").as_deref() != Some(legacy_id.as_str()))
                .find(|row| resolved_email(row).as_deref() == Some(email.as_str()))
                .cloned()
        });

        if let Some(target_row) = duplicate_row {
            merge_legacy_browser_account(provider, &legacy_row, &target_row).await?;
        } else {
            let new_id = generate_browser_account_id(provider);
            rename_account(provider, legacy_id.as_str(), new_id.as_str()).await?;
        }
    }

    invalidate_linked_accounts_cache().await;
    Ok(())
}

pub async fn normalize_legacy_openai_linked_account_metadata() -> Result<u64> {
    let mut normalized = 0_u64;
    for provider in ["codex", "openai"] {
        let accounts = get_provider_accounts(provider).await?;
        for row in accounts {
            let Some(account_id) = string_field(&row, "id") else {
                continue;
            };
            let Some(normalized_metadata) = normalize_openai_metadata_map(&row) else {
                continue;
            };
            update_metadata(
                account_id.as_str(),
                provider,
                Value::Object(normalized_metadata),
            )
            .await?;
            normalized = normalized.saturating_add(1);
        }
    }

    invalidate_linked_accounts_cache().await;
    Ok(normalized)
}

async fn rename_account(provider: &str, old_id: &str, new_id: &str) -> Result<()> {
    let sql = "UPDATE linked_accounts SET id = $1, updated_at = $2 WHERE id = $3 AND provider = $4";
    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![
            Value::String(new_id.to_string()),
            Value::from(now_ms()),
            Value::String(old_id.to_string()),
            Value::String(provider.to_string()),
        ],
    };
    let res = execute_query(&payload).await?;
    if res.status().is_success() {
        return Ok(());
    }

    Err(anyhow!(
        "Failed to rename legacy browser account {} ({})",
        old_id,
        provider
    ))
}

async fn merge_legacy_browser_account(
    provider: &str,
    legacy_row: &Value,
    target_row: &Value,
) -> Result<()> {
    let legacy_updated_at = int_field(legacy_row, "updated_at").unwrap_or_default();
    let target_updated_at = int_field(target_row, "updated_at").unwrap_or_default();
    let prefer_legacy = legacy_updated_at >= target_updated_at;
    let preferred = if prefer_legacy {
        legacy_row
    } else {
        target_row
    };
    let fallback = if prefer_legacy {
        target_row
    } else {
        legacy_row
    };
    let target_id = string_field(target_row, "id")
        .ok_or_else(|| anyhow!("Target account missing id during legacy merge"))?;
    let legacy_id = string_field(legacy_row, "id")
        .ok_or_else(|| anyhow!("Legacy account missing id during legacy merge"))?;
    let created_at = match (
        int_field(target_row, "created_at"),
        int_field(legacy_row, "created_at"),
    ) {
        (Some(target), Some(legacy)) => target.min(legacy),
        (Some(target), None) => target,
        (None, Some(legacy)) => legacy,
        (None, None) => now_ms(),
    };
    let updated_at = legacy_updated_at.max(target_updated_at).max(now_ms());
    let metadata = merged_metadata(target_row, legacy_row, prefer_legacy);
    let is_active = bool_field(target_row, "is_active") || bool_field(legacy_row, "is_active");

    let sql = "UPDATE linked_accounts SET email = $1, display_name = $2, avatar_url = $3, access_token = $4, refresh_token = $5, session_token = $6, expires_at = $7, scope = $8, is_active = $9, metadata = $10, created_at = $11, updated_at = $12 WHERE id = $13 AND provider = $14";
    let payload = QueryRequest {
        sql: sql.to_string(),
        params: vec![
            pick_string(preferred, fallback, "email"),
            pick_string(preferred, fallback, "display_name"),
            pick_string(preferred, fallback, "avatar_url"),
            pick_string(preferred, fallback, "access_token"),
            pick_string(preferred, fallback, "refresh_token"),
            pick_string(preferred, fallback, "session_token"),
            pick_optional_i64(preferred, fallback, "expires_at"),
            pick_string(preferred, fallback, "scope"),
            Value::Bool(is_active),
            Value::String(metadata),
            Value::from(created_at),
            Value::from(updated_at),
            Value::String(target_id.clone()),
            Value::String(provider.to_string()),
        ],
    };
    let res = execute_query(&payload).await?;
    if !res.status().is_success() {
        return Err(anyhow!(
            "Failed to merge legacy browser account {} into {}",
            legacy_id,
            target_id
        ));
    }

    let delete_sql = "DELETE FROM linked_accounts WHERE id = $1 AND provider = $2";
    let delete_payload = QueryRequest {
        sql: delete_sql.to_string(),
        params: vec![
            Value::String(legacy_id),
            Value::String(provider.to_string()),
        ],
    };
    let delete_res = execute_query(&delete_payload).await?;
    if delete_res.status().is_success() {
        return Ok(());
    }

    Err(anyhow!("Failed to delete merged legacy browser account"))
}

#[cfg(test)]
mod tests {
    use super::{
        callback_retry_backoff_ms, canonical_account_id, generate_browser_account_id, normalize_openai_metadata_map,
        normalize_provider, parse_metadata_object, provider_matches, resolved_email,
    };
    use serde_json::{json, Value};

    #[test]
    fn normalizes_provider_aliases() {
        // openai is now kept separate from codex (API key vs OAuth)
        assert_eq!(normalize_provider("openai"), "openai");
        assert_eq!(normalize_provider("anthropic"), "claude");
        assert_eq!(normalize_provider("google"), "gemini");
        assert_eq!(normalize_provider("github"), "copilot");
        assert_eq!(normalize_provider("nvidia_key"), "nvidia");
        // New providers stay as-is
        assert_eq!(normalize_provider("mistral"), "mistral");
        assert_eq!(normalize_provider("groq"), "groq");
        assert_eq!(normalize_provider("xai"), "xai");
    }

    #[test]
    fn matches_provider_aliases() {
        assert!(provider_matches("github", "github"));
        assert!(provider_matches("github", "copilot"));
        assert!(provider_matches("nvidia_key", "nvidia"));
        assert!(!provider_matches("claude", "codex"));
        // openai and codex are now separate
        assert!(!provider_matches("openai", "codex"));
    }

    #[test]
    fn canonicalizes_default_account_ids_per_provider() {
        assert_eq!(
            canonical_account_id("proxy_key", "default"),
            "proxy_key_default"
        );
        assert_eq!(canonical_account_id("github", "default"), "copilot_default");
        assert_eq!(canonical_account_id("claude", "personal"), "personal");
    }

    #[test]
    fn generates_non_default_browser_account_ids() {
        let account_id = generate_browser_account_id("codex");
        assert!(account_id.starts_with("codex_"));
        assert_ne!(account_id, "codex_default");
    }

    #[test]
    fn parses_string_metadata_into_object() {
        let row = json!({
            "metadata": "{\"quota\":{\"remaining\":12.5},\"account_id\":\"abc\"}"
        });

        let metadata = parse_metadata_object(&row);
        assert_eq!(
            metadata.get("account_id").and_then(|value| value.as_str()),
            Some("abc")
        );
        assert_eq!(
            metadata
                .get("quota")
                .and_then(|value| value.get("remaining"))
                .and_then(|value| value.as_f64()),
            Some(12.5)
        );
    }

    #[test]
    fn resolves_email_from_metadata_when_column_missing() {
        let row = json!({
            "metadata": "{\"email\":\"test@example.com\"}"
        });

        assert_eq!(resolved_email(&row).as_deref(), Some("test@example.com"));
    }

    #[test]
    fn callback_db_retry_backoff_increases_per_attempt() {
        assert_eq!(callback_retry_backoff_ms(1), 250);
        assert_eq!(callback_retry_backoff_ms(2), 500);
        assert_eq!(callback_retry_backoff_ms(3), 750);
    }

    #[test]
    fn normalizes_legacy_openai_token_metadata_shape() {
        let row = json!({
            "metadata": {
                "token": {
                    "access_token": "legacy-access",
                    "refresh_token": "legacy-refresh",
                    "organization": {
                        "id": "org_legacy",
                        "name": "Legacy Org"
                    }
                }
            }
        });

        let normalized = normalize_openai_metadata_map(&row).expect("normalized");
        assert_eq!(
            normalized
                .get("access_token")
                .and_then(|value| value.as_str()),
            Some("legacy-access")
        );
        assert_eq!(
            normalized
                .get("refresh_token")
                .and_then(|value| value.as_str()),
            Some("legacy-refresh")
        );
        assert_eq!(
            normalized
                .get("oauth_provider")
                .and_then(|value| value.as_str()),
            Some("openai")
        );
        assert_eq!(
            normalized
                .get("organization")
                .and_then(|value| value.get("id"))
                .and_then(|value| value.as_str()),
            Some("org_legacy")
        );
        assert_eq!(
            normalized
                .get("migrated_by")
                .and_then(|value| value.as_str()),
            Some("oauth-bridge-openai-metadata-v1")
        );
        assert!(normalized
            .get("migration_ts")
            .and_then(Value::as_i64)
            .is_some());
    }
}
