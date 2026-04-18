/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

const SKILL_PROVIDER_ALL: &str = "all";
const SKILL_MARKETPLACE_BUILTIN: &str = "builtin";
const SKILL_MAX_PROMPT_CHARS: usize = 18_000;
const SKILL_INJECTION_HEADER: &str = "[ACTIVE_SKILLS]";
const SKILL_MARKETPLACE_REGISTRY_URL: &str =
    "https://raw.githubusercontent.com/TengraStudio/tengra-market/main/registry.json";

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SkillRecord {
    pub id: String,
    pub name: String,
    pub description: String,
    pub provider: String,
    pub content: String,
    pub enabled: bool,
    pub source: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct UpsertSkillInput {
    pub id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub provider: Option<String>,
    pub content: String,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ToggleSkillInput {
    pub enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct InstallMarketplaceSkillInput {
    pub id: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct MarketplaceSkillRecord {
    pub id: String,
    pub name: String,
    pub description: String,
    pub provider: String,
    pub content: String,
    pub version: String,
    pub enabled_by_default: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct SkillInjection {
    pub content: String,
    pub skill_ids: Vec<String>,
}

pub async fn list_skills() -> Result<Vec<SkillRecord>> {
    let query = crate::db::QueryRequest {
        sql: "SELECT id, name, description, provider, content, enabled, source, created_at, updated_at FROM proxy_skills ORDER BY updated_at DESC, id ASC".to_string(),
        params: vec![],
    };
    let rows = crate::db::query_rows(&query).await?;
    let mut result = Vec::new();
    for row in rows {
        result.push(skill_from_row(&row)?);
    }
    Ok(result)
}

pub async fn get_skill(skill_id: &str) -> Result<Option<SkillRecord>> {
    let normalized_id = normalize_skill_id(skill_id)?;
    let query = crate::db::QueryRequest {
        sql: "SELECT id, name, description, provider, content, enabled, source, created_at, updated_at FROM proxy_skills WHERE id = $1".to_string(),
        params: vec![Value::String(normalized_id)],
    };
    let rows = crate::db::query_rows(&query).await?;
    if rows.is_empty() {
        return Ok(None);
    }
    Ok(Some(skill_from_row(&rows[0])?))
}

pub async fn upsert_skill(input: UpsertSkillInput) -> Result<SkillRecord> {
    let id = match input.id {
        Some(value) => normalize_skill_id(&value)?,
        None => format!("skill_{}", uuid::Uuid::new_v4().simple()),
    };
    let now_ms = chrono::Utc::now().timestamp_millis();
    let name = normalize_non_empty(&input.name, "name", 128)?;
    let description = normalize_description(input.description.unwrap_or_default())?;
    let provider = normalize_provider(
        input
            .provider
            .unwrap_or_else(|| SKILL_PROVIDER_ALL.to_string()),
    );
    let content = normalize_content(&input.content)?;
    let enabled = input.enabled.unwrap_or(true);
    let existing = get_skill(&id).await?;
    let source = existing
        .as_ref()
        .map(|item| item.source.clone())
        .unwrap_or_else(|| "user".to_string());
    let created_at = existing
        .as_ref()
        .map(|item| item.created_at)
        .unwrap_or(now_ms);
    let query = crate::db::QueryRequest {
        sql: "INSERT INTO proxy_skills (id, name, description, provider, content, enabled, source, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT(id) DO UPDATE SET
                  name = EXCLUDED.name,
                  description = EXCLUDED.description,
                  provider = EXCLUDED.provider,
                  content = EXCLUDED.content,
                  enabled = EXCLUDED.enabled,
                  source = EXCLUDED.source,
                  updated_at = EXCLUDED.updated_at"
            .to_string(),
        params: vec![
            Value::String(id.clone()),
            Value::String(name),
            Value::String(description),
            Value::String(provider),
            Value::String(content),
            Value::from(enabled),
            Value::String(source),
            Value::from(created_at),
            Value::from(now_ms),
        ],
    };
    crate::db::execute_query_json(&query).await?;
    get_skill(&id)
        .await?
        .ok_or_else(|| anyhow!("Skill upsert completed but record not found"))
}

pub async fn delete_skill(skill_id: &str) -> Result<bool> {
    let normalized_id = normalize_skill_id(skill_id)?;
    let query = crate::db::QueryRequest {
        sql: "DELETE FROM proxy_skills WHERE id = $1".to_string(),
        params: vec![Value::String(normalized_id)],
    };
    crate::db::execute_query_json(&query).await?;
    Ok(true)
}

pub async fn toggle_skill(skill_id: &str, enabled: bool) -> Result<Option<SkillRecord>> {
    let normalized_id = normalize_skill_id(skill_id)?;
    let query = crate::db::QueryRequest {
        sql: "UPDATE proxy_skills SET enabled = $1, updated_at = $2 WHERE id = $3".to_string(),
        params: vec![
            Value::from(enabled),
            Value::from(chrono::Utc::now().timestamp_millis()),
            Value::String(normalized_id.clone()),
        ],
    };
    crate::db::execute_query_json(&query).await?;
    get_skill(&normalized_id).await
}

pub async fn list_marketplace_skills() -> Result<Vec<MarketplaceSkillRecord>> {
    fetch_marketplace_skills().await
}

pub async fn install_marketplace_skill(skill_id: &str) -> Result<SkillRecord> {
    let normalized_id = normalize_skill_id(skill_id)?;
    if get_skill(&normalized_id).await?.is_some() {
        return Err(anyhow!("Skill already installed: {}", normalized_id));
    }
    let marketplace_skills = fetch_marketplace_skills().await?;
    let marketplace_skill = marketplace_skills
        .into_iter()
        .find(|item| item.id == normalized_id)
        .ok_or_else(|| anyhow!("Marketplace skill not found: {}", normalized_id))?;
    let upsert = UpsertSkillInput {
        id: Some(marketplace_skill.id.clone()),
        name: marketplace_skill.name,
        description: Some(marketplace_skill.description),
        provider: Some(marketplace_skill.provider),
        content: marketplace_skill.content,
        enabled: Some(marketplace_skill.enabled_by_default),
    };
    let mut skill = upsert_skill(upsert).await?;
    if skill.source != SKILL_MARKETPLACE_BUILTIN {
        let mark_source = crate::db::QueryRequest {
            sql: "UPDATE proxy_skills SET source = $1, updated_at = $2 WHERE id = $3".to_string(),
            params: vec![
                Value::String(SKILL_MARKETPLACE_BUILTIN.to_string()),
                Value::from(chrono::Utc::now().timestamp_millis()),
                Value::String(skill.id.clone()),
            ],
        };
        crate::db::execute_query_json(&mark_source).await?;
        skill = get_skill(&skill.id)
            .await?
            .ok_or_else(|| anyhow!("Installed skill not found after source update"))?;
    }
    Ok(skill)
}

pub async fn install_marketplace_skill_input(
    input: InstallMarketplaceSkillInput,
) -> Result<SkillRecord> {
    install_marketplace_skill(&input.id).await
}

pub async fn build_skill_injection(provider: &str) -> Result<Option<SkillInjection>> {
    let normalized_provider = normalize_provider(provider.to_string());
    let query = crate::db::QueryRequest {
        sql: "SELECT id, name, content
              FROM proxy_skills
              WHERE enabled = 1
              AND (provider = $1 OR provider = $2)
              ORDER BY updated_at ASC, id ASC"
            .to_string(),
        params: vec![
            Value::String(normalized_provider),
            Value::String(SKILL_PROVIDER_ALL.to_string()),
        ],
    };
    let rows = crate::db::query_rows(&query).await?;
    if rows.is_empty() {
        return Ok(None);
    }

    let mut blocks = Vec::new();
    let mut ids = Vec::new();
    for row in rows {
        let id = row
            .get("id")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| anyhow!("Skill row missing id"))?
            .to_string();
        let name = row
            .get("name")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| anyhow!("Skill row missing name"))?
            .to_string();
        let content = row
            .get("content")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| anyhow!("Skill row missing content"))?
            .to_string();
        blocks.push(format!("## {}\n{}", name, content));
        ids.push(id);
    }

    let merged = format!("{}\n\n{}", SKILL_INJECTION_HEADER, blocks.join("\n\n"));
    let content = truncate_chars(&merged, SKILL_MAX_PROMPT_CHARS);
    Ok(Some(SkillInjection {
        content,
        skill_ids: ids,
    }))
}

pub fn inject_skill_prompt(
    payload: &mut crate::proxy::types::ChatCompletionRequest,
    skill_prompt: &str,
) -> Result<()> {
    let normalized = skill_prompt.trim();
    if normalized.is_empty() {
        return Ok(());
    }

    let existing_system_index = payload
        .messages
        .iter()
        .position(|message| message.role == "system");

    if let Some(index) = existing_system_index {
        let existing = &payload.messages[index].content;
        let existing_text = extract_message_text(existing);
        let merged = if existing_text.is_empty() {
            normalized.to_string()
        } else {
            format!("{}\n\n{}", normalized, existing_text)
        };
        payload.messages[index].content = Value::String(merged);
        return Ok(());
    }

    payload.messages.insert(
        0,
        crate::proxy::types::ChatMessage {
            role: "system".to_string(),
            content: Value::String(normalized.to_string()),
            name: None,
            tool_calls: None,
            tool_call_id: None,
            refusal: None,
        },
    );
    Ok(())
}

pub async fn ensure_skill_tables() -> Result<()> {
    let create_skills = crate::db::QueryRequest {
        sql: "CREATE TABLE IF NOT EXISTS proxy_skills (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT NOT NULL DEFAULT '',
              provider TEXT NOT NULL DEFAULT 'all',
              content TEXT NOT NULL,
              enabled INTEGER NOT NULL DEFAULT 1,
              source TEXT NOT NULL DEFAULT 'user',
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
          )"
        .to_string(),
        params: vec![],
    };
    crate::db::execute_query_json(&create_skills).await?;

    remove_legacy_seeded_skills().await?;
    Ok(())
}

fn normalize_skill_id(value: &str) -> Result<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("Skill id cannot be empty"));
    }
    if trimmed.len() > 128 {
        return Err(anyhow!("Skill id is too long"));
    }
    Ok(trimmed.to_string())
}

fn normalize_non_empty(value: &str, field_name: &str, max_len: usize) -> Result<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("{} cannot be empty", field_name));
    }
    if trimmed.len() > max_len {
        return Err(anyhow!("{} exceeds max length {}", field_name, max_len));
    }
    Ok(trimmed.to_string())
}

fn normalize_description(description: String) -> Result<String> {
    let trimmed = description.trim();
    if trimmed.len() > 512 {
        return Err(anyhow!("Description exceeds max length 512"));
    }
    Ok(trimmed.to_string())
}

fn normalize_provider(value: String) -> String {
    let lowered = value.trim().to_lowercase();
    if lowered.is_empty() {
        return SKILL_PROVIDER_ALL.to_string();
    }
    lowered
}

fn normalize_content(value: &str) -> Result<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("Skill content cannot be empty"));
    }
    if trimmed.len() > SKILL_MAX_PROMPT_CHARS {
        return Err(anyhow!(
            "Skill content exceeds max length {}",
            SKILL_MAX_PROMPT_CHARS
        ));
    }
    Ok(trimmed.to_string())
}

fn parse_bool(value: &Value) -> bool {
    match value {
        Value::Bool(result) => *result,
        Value::Number(number) => number.as_i64().unwrap_or(0) != 0,
        Value::String(text) => matches!(text.trim(), "1" | "true" | "TRUE"),
        _ => false,
    }
}

fn parse_i64(value: &Value) -> i64 {
    value.as_i64().unwrap_or(0)
}

fn skill_from_row(row: &Map<String, Value>) -> Result<SkillRecord> {
    Ok(SkillRecord {
        id: read_required_string(row, "id")?,
        name: read_required_string(row, "name")?,
        description: read_optional_string(row, "description"),
        provider: read_required_string(row, "provider")?,
        content: read_required_string(row, "content")?,
        enabled: parse_bool(row.get("enabled").unwrap_or(&Value::Null)),
        source: read_required_string(row, "source")?,
        created_at: parse_i64(row.get("created_at").unwrap_or(&Value::Null)),
        updated_at: parse_i64(row.get("updated_at").unwrap_or(&Value::Null)),
    })
}

fn marketplace_skill_from_json(value: &Value) -> Result<MarketplaceSkillRecord> {
    let item = value
        .as_object()
        .ok_or_else(|| anyhow!("Marketplace skill entry must be an object"))?;

    let enabled_by_default = item
        .get("enabled_by_default")
        .or_else(|| item.get("enabledByDefault"))
        .map(parse_bool)
        .unwrap_or(true);
    let provider = item
        .get("provider")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|it| !it.is_empty())
        .unwrap_or(SKILL_PROVIDER_ALL)
        .to_string();

    Ok(MarketplaceSkillRecord {
        id: read_required_json_string(item, "id")?,
        name: read_required_json_string(item, "name")?,
        description: read_optional_json_string(item, "description"),
        provider,
        content: read_required_json_string(item, "content")?,
        version: read_required_json_string(item, "version")?,
        enabled_by_default,
    })
}

fn read_required_string(row: &Map<String, Value>, key: &str) -> Result<String> {
    row.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| anyhow!("Missing or invalid field: {}", key))
}

fn read_required_json_string(row: &Map<String, Value>, key: &str) -> Result<String> {
    read_required_string(row, key)
}

fn read_optional_string(row: &Map<String, Value>, key: &str) -> String {
    row.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or("")
        .to_string()
}

fn read_optional_json_string(row: &Map<String, Value>, key: &str) -> String {
    read_optional_string(row, key)
}

fn extract_message_text(content: &Value) -> String {
    match content {
        Value::String(text) => text.trim().to_string(),
        Value::Array(parts) => {
            let mut chunks = Vec::new();
            for part in parts {
                if let Some(text) = part.get("text").and_then(Value::as_str) {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        chunks.push(trimmed.to_string());
                    }
                } else if let Some(text) = part.as_str() {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        chunks.push(trimmed.to_string());
                    }
                }
            }
            chunks.join("\n")
        }
        _ => String::new(),
    }
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

async fn remove_legacy_seeded_skills() -> Result<()> {
    let legacy_ids = vec![
        Value::String("clean-code-reviewer".to_string()),
        Value::String("bug-hunter".to_string()),
        Value::String("typescript-guardian".to_string()),
    ];
    let delete_marketplace = crate::db::QueryRequest {
        sql: "DELETE FROM proxy_marketplace_skills WHERE id IN ($1, $2, $3)".to_string(),
        params: legacy_ids.clone(),
    };
    let _ = crate::db::execute_query_json(&delete_marketplace).await;

    let delete_installed = crate::db::QueryRequest {
        sql: "DELETE FROM proxy_skills WHERE id IN ($1, $2, $3)".to_string(),
        params: legacy_ids,
    };
    crate::db::execute_query_json(&delete_installed).await?;
    Ok(())
}

async fn fetch_marketplace_skills() -> Result<Vec<MarketplaceSkillRecord>> {
    let response = reqwest::Client::new()
        .get(SKILL_MARKETPLACE_REGISTRY_URL)
        .send()
        .await
        .map_err(|error| anyhow!("Failed to fetch marketplace registry: {}", error))?;
    if !response.status().is_success() {
        return Err(anyhow!(
            "Marketplace registry request failed with status {}",
            response.status()
        ));
    }
    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| anyhow!("Failed to parse marketplace registry: {}", error))?;
    let skills = payload
        .as_object()
        .and_then(|item| item.get("skills"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut result = Vec::new();
    for item in skills {
        result.push(marketplace_skill_from_json(&item)?);
    }
    result.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(result)
}
