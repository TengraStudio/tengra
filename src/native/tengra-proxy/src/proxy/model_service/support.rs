/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use super::{ProviderModel, ServedModel};
use crate::proxy::model_catalog::find_model;
use crate::security::{decrypt_token, load_master_key};
use serde_json::{Map, Value};

pub(super) fn group_provider_rows(rows: &[Value]) -> Vec<(String, Vec<Value>)> {
    let mut grouped = Vec::<(String, Vec<Value>)>::new();
    for row in rows {
        let Some(provider) = row.get("provider").and_then(|value| value.as_str()) else {
            continue;
        };
        let normalized = normalize_provider_for_row(provider, row);
        if let Some((_, bucket)) = grouped.iter_mut().find(|(key, _)| *key == normalized) {
            bucket.push(row.clone());
        } else {
            grouped.push((normalized, vec![row.clone()]));
        }
    }
    grouped
}

pub(super) fn normalize_provider_for_row(provider: &str, row: &Value) -> String {
    if normalize_provider(provider) == "codex" && is_openai_api_key_row(row) {
        return "openai".to_string();
    }
    normalize_provider(provider).to_string()
}

pub(super) fn is_openai_api_key_row(row: &Value) -> bool {
    let kind = row_metadata_string(row, &["auth_type", "authType", "type"]);
    let hint = row_metadata_string(row, &["provider_hint", "providerHint", "provider"]);
    kind.as_deref() == Some("api_key") && hint.as_deref() == Some("openai")
}

pub(super) fn row_metadata_string(row: &Value, keys: &[&str]) -> Option<String> {
    let metadata = parse_metadata_object(row);
    for key in keys {
        if let Some(value) = metadata.get(*key).and_then(Value::as_str) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_ascii_lowercase());
            }
        }
    }
    None
}

pub(super) fn parse_provider_models_from_payload(
    payload: &Value,
    provider: &str,
    preferred_id_keys: &[&str],
) -> Vec<ServedModel> {
    let Some(items) = find_model_items(payload, 3) else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(|item| parse_served_model_item(item, provider, preferred_id_keys))
        .collect()
}

fn parse_served_model_item(
    item: &Value,
    provider: &str,
    preferred_id_keys: &[&str],
) -> Option<ServedModel> {
    let mut id_candidates = preferred_id_keys.to_vec();
    id_candidates.extend(["id", "name", "model", "model_id", "slug"]);
    let id = value_string(item, id_candidates.as_slice())
        .or_else(|| item.as_str().map(str::to_string))
        .map(|value| normalize_provider_model_id(provider, value))?;

    if id.trim().is_empty() {
        return None;
    }

    let display_name = value_string(item, &["display_name", "displayName", "name", "title"])
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| id.clone());
    let owned_by = value_string(item, &["owned_by", "ownedBy", "organization"])
        .unwrap_or_else(|| default_owned_by(provider));
    let description = value_string(item, &["description", "summary"]);
    let created = value_u64(item, &["created", "created_at", "createdAt"]).unwrap_or(0);

    Some(ServedModel {
        id: id.clone(),
        provider: provider.to_string(),
        owned_by,
        created,
        name: id.clone(),
        display_name,
        description,
        context_length: 0,
        max_completion_tokens: value_u64(item, &["max_tokens", "max_completion_tokens"])
            .unwrap_or(0) as u32,
        thinking_levels: vec![],
        quota_info: None,
    })
}

pub(super) fn prioritized_rows(rows: &[Value]) -> Vec<&Value> {
    let mut prioritized = rows.iter().collect::<Vec<_>>();
    prioritized.sort_by_key(|row| {
        if row.get("is_active").and_then(|value| value.as_bool()) == Some(true) {
            0
        } else {
            1
        }
    });
    prioritized
}

pub(super) fn normalize_provider(provider: &str) -> &str {
    match provider {
        "openai_token" => "codex",
        "anthropic_token" => "claude",
        "google" | "antigravity_token" => "antigravity",
        "github" | "github_token" | "copilot_token" => "copilot",
        "nvidia_key" | "nim" | "nim_openai" => "nvidia",
        other => other,
    }
}

pub(super) fn map_provider_models(models: Vec<ProviderModel>) -> Vec<ServedModel> {
    models
        .into_iter()
        .map(|model| {
            let static_info = find_model(model.provider.as_str(), model.id.as_str());
            let owned_by = static_info
                .map(|info| info.owned_by.to_string())
                .unwrap_or_else(|| default_owned_by(model.provider.as_str()));
            let created = static_info.map(|info| info.created).unwrap_or(0);
            let context_length = static_info.map(|info| info.context_length).unwrap_or(0);
            let max_completion_tokens = static_info
                .map(|info| info.max_completion_tokens)
                .unwrap_or(0);
            let thinking_levels = model
                .thinking_levels
                .clone()
                .or_else(|| {
                    static_info.map(|info| {
                        info.thinking_levels
                            .iter()
                            .map(|value| (*value).to_string())
                            .collect()
                    })
                })
                .unwrap_or_default();

            ServedModel {
                id: model.id.clone(),
                provider: model.provider.clone(),
                owned_by,
                created,
                name: model.name.clone(),
                display_name: model.name,
                description: model.description,
                context_length,
                max_completion_tokens,
                thinking_levels,
                quota_info: model.quota_info,
            }
        })
        .collect()
}

fn default_owned_by(provider: &str) -> String {
    match provider {
        "codex" => "openai".to_string(),
        "claude" => "anthropic".to_string(),
        "antigravity" => "google".to_string(),
        "copilot" => "github".to_string(),
        "nvidia" => "nvidia".to_string(),
        _ => provider.to_string(),
    }
}

pub(super) fn dedupe_models(models: Vec<ServedModel>) -> Vec<ServedModel> {
    let mut unique = Vec::<ServedModel>::new();
    for model in models {
        let exists = unique.iter().any(|existing| {
            existing.provider == model.provider && existing.id.eq_ignore_ascii_case(&model.id)
        });
        if !exists {
            unique.push(model);
        }
    }
    unique
}

fn decrypt_row_token(row: &Value, key: &str) -> Option<String> {
    let encrypted = row.get(key).and_then(|value| value.as_str())?;
    if encrypted.trim().is_empty() {
        return None;
    }
    if encrypted.starts_with("Tengra:v1:") {
        let master_key = load_master_key().ok()?;
        decrypt_token(encrypted, &master_key).ok()
    } else {
        Some(encrypted.to_string())
    }
}

pub(super) fn parse_metadata_object(row: &Value) -> Map<String, Value> {
    match row.get("metadata") {
        Some(Value::Object(map)) => map.clone(),
        Some(Value::String(text)) => serde_json::from_str::<Value>(text)
            .ok()
            .and_then(|value| value.as_object().cloned())
            .unwrap_or_default(),
        _ => Map::new(),
    }
}

pub(super) fn metadata_string(row: &Value, key: &str) -> Option<String> {
    parse_metadata_object(row)
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

pub(super) fn token_value_from_row(row: &Value, key: &str) -> Option<String> {
    decrypt_row_token(row, key).or_else(|| metadata_token_string(row, key))
}

fn metadata_token_string(row: &Value, key: &str) -> Option<String> {
    let metadata = parse_metadata_object(row);
    let token = metadata.get("token")?.as_object()?;
    token
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn normalize_provider_model_id(provider: &str, raw_id: String) -> String {
    let trimmed = raw_id.trim();
    if provider == "gemini" {
        return trimmed
            .strip_prefix("models/")
            .unwrap_or(trimmed)
            .to_string();
    }
    trimmed.to_string()
}

fn value_string(item: &Value, keys: &[&str]) -> Option<String> {
    let object = item.as_object()?;
    for key in keys {
        let value = object.get(*key).and_then(Value::as_str).map(str::trim);
        if let Some(value) = value.filter(|value| !value.is_empty()) {
            return Some(value.to_string());
        }
    }
    None
}

fn value_u64(item: &Value, keys: &[&str]) -> Option<u64> {
    let object = item.as_object()?;
    for key in keys {
        let Some(value) = object.get(*key) else {
            continue;
        };
        if let Some(parsed) = value.as_u64() {
            return Some(parsed);
        }
        if let Some(parsed) = value.as_str().and_then(|text| text.parse::<u64>().ok()) {
            return Some(parsed);
        }
    }
    None
}

fn find_model_items(value: &Value, max_depth: u8) -> Option<&Vec<Value>> {
    if max_depth == 0 {
        return None;
    }
    if let Some(array) = value.as_array() {
        if looks_like_model_items(array.as_slice()) {
            return Some(array);
        }
    }
    let object = value.as_object()?;
    for key in ["data", "models", "items", "results"] {
        if let Some(array) = object.get(key).and_then(Value::as_array) {
            if looks_like_model_items(array.as_slice()) {
                return Some(array);
            }
        }
    }
    for nested in object.values() {
        if let Some(found) = find_model_items(nested, max_depth - 1) {
            return Some(found);
        }
    }
    None
}

fn looks_like_model_items(items: &[Value]) -> bool {
    items.iter().any(|item| {
        item.as_str()
            .map(|value| !value.trim().is_empty())
            .or_else(|| {
                item.as_object().map(|object| {
                    ["id", "name", "model", "model_id", "slug"]
                        .iter()
                        .any(|key| {
                            object
                                .get(*key)
                                .and_then(Value::as_str)
                                .map(|value| !value.trim().is_empty())
                                .unwrap_or(false)
                        })
                })
            })
            .unwrap_or(false)
    })
}

#[cfg(test)]
mod tests {
    use super::super::ServedModel;
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_openai_compatible_payload() {
        let payload = json!({
            "data": [
                { "id": "gpt-4", "name": "GPT-4", "owned_by": "openai" },
                { "id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "owned_by": "openai" }
            ]
        });

        let models = parse_provider_models_from_payload(&payload, "openai", &["id"]);
        assert_eq!(models.len(), 2);
        assert_eq!(models[0].id, "gpt-4");
        assert_eq!(models[1].id, "gpt-3.5-turbo");
    }

    #[test]
    fn parses_anthropic_payload() {
        let payload = json!({
            "data": [
                { "id": "claude-3-opus", "display_name": "Claude 3 Opus" },
                { "id": "claude-3-sonnet", "display_name": "Claude 3 Sonnet" }
            ]
        });

        let models = parse_provider_models_from_payload(&payload, "anthropic", &["id"]);
        assert_eq!(models.len(), 2);
        assert_eq!(models[0].id, "claude-3-opus");
        assert_eq!(models[1].id, "claude-3-sonnet");
    }

    #[test]
    fn parses_gemini_payload() {
        let payload = json!({
            "models": [
                { "name": "models/gemini-pro", "displayName": "Gemini Pro", "description": "Google Gemini Pro" },
                { "name": "models/gemini-ultra", "displayName": "Gemini Ultra", "description": "Google Gemini Ultra" }
            ]
        });

        let models = parse_provider_models_from_payload(&payload, "gemini", &["name", "id"]);
        assert_eq!(models.len(), 2);
        assert_eq!(models[0].id, "gemini-pro");
        assert_eq!(models[1].id, "gemini-ultra");
    }

    #[test]
    fn normalizes_providers_correctly() {
        assert_eq!(normalize_provider("openai_token"), "codex");
        assert_eq!(normalize_provider("anthropic_token"), "claude");
        assert_eq!(normalize_provider("google"), "antigravity");
        assert_eq!(normalize_provider("antigravity_token"), "antigravity");
        assert_eq!(normalize_provider("github"), "copilot");
        assert_eq!(normalize_provider("copilot_token"), "copilot");
        assert_eq!(normalize_provider("nvidia_key"), "nvidia");
        assert_eq!(normalize_provider("nim"), "nvidia");
    }

    #[test]
    fn parser_edge_cases_return_empty_and_do_not_panic() {
        let malformed_payloads = vec![
            json!({}),
            json!({"data": {"id": "not-an-array"}}),
            json!({"models": "not-an-array"}),
            json!(null),
            json!([]),
            json!({"data": []}),
        ];

        for payload in malformed_payloads {
            let openai = std::panic::catch_unwind(|| {
                parse_provider_models_from_payload(&payload, "openai", &["id"])
            });
            let anthropic = std::panic::catch_unwind(|| {
                parse_provider_models_from_payload(&payload, "anthropic", &["id"])
            });
            let gemini = std::panic::catch_unwind(|| {
                parse_provider_models_from_payload(&payload, "gemini", &["name", "id"])
            });

            assert!(openai.is_ok());
            assert!(anthropic.is_ok());
            assert!(gemini.is_ok());

            assert!(openai.expect("openai parser panicked").is_empty());
            assert!(anthropic.expect("anthropic parser panicked").is_empty());
            assert!(gemini.expect("gemini parser panicked").is_empty());
        }
    }

    #[test]
    fn dedupe_models_preserves_distinct_provider_model_pairs() {
        let models = vec![
            ServedModel {
                id: "gpt-4o".to_string(),
                provider: "openai".to_string(),
                owned_by: "openai".to_string(),
                created: 0,
                name: "GPT-4o".to_string(),
                display_name: "GPT-4o".to_string(),
                description: None,
                context_length: 128_000,
                max_completion_tokens: 16_384,
                thinking_levels: vec![],
                quota_info: None,
            },
            ServedModel {
                id: "gpt-4o".to_string(),
                provider: "codex".to_string(),
                owned_by: "openai".to_string(),
                created: 0,
                name: "GPT-4o".to_string(),
                display_name: "GPT-4o".to_string(),
                description: None,
                context_length: 128_000,
                max_completion_tokens: 16_384,
                thinking_levels: vec![],
                quota_info: None,
            },
            ServedModel {
                id: "gpt-4o".to_string(),
                provider: "openai".to_string(),
                owned_by: "openai".to_string(),
                created: 0,
                name: "GPT-4o".to_string(),
                display_name: "GPT-4o".to_string(),
                description: None,
                context_length: 128_000,
                max_completion_tokens: 16_384,
                thinking_levels: vec![],
                quota_info: None,
            },
        ];

        let deduped = dedupe_models(models);
        let keys = deduped
            .iter()
            .map(|model| format!("{}:{}", model.provider, model.id))
            .collect::<Vec<_>>();
        assert_eq!(keys, vec!["openai:gpt-4o", "codex:gpt-4o"]);
    }

    #[test]
    fn groups_openai_api_key_rows_under_openai() {
        let grouped = group_provider_rows(&[json!({
            "provider": "codex",
            "metadata": { "type": "api_key", "provider_hint": "openai" }
        })]);
        assert_eq!(grouped[0].0, "openai");
    }
}
