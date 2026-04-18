/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

pub const BASE_URL_DAILY: &str = "https://daily-cloudcode-pa.googleapis.com";
pub const BASE_URL_SANDBOX_DAILY: &str = "https://daily-cloudcode-pa.sandbox.googleapis.com";
pub const BASE_URL_PROD: &str = "https://cloudcode-pa.googleapis.com";
pub const DEFAULT_USER_AGENT: &str = "antigravity/1.104.0 darwin/arm64";

pub fn fallback_base_urls(custom_base_url: Option<&str>) -> Vec<String> {
    if let Some(base_url) = custom_base_url
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.trim_end_matches('/').to_string())
    {
        return vec![base_url];
    }

    vec![
        BASE_URL_DAILY.to_string(),
        BASE_URL_SANDBOX_DAILY.to_string(),
        BASE_URL_PROD.to_string(),
    ]
}

pub fn normalize_requested_model_name(model: &str) -> String {
    let normalized = model.trim();
    if let Some(stripped) = normalized.strip_prefix("antigravity/") {
        return stripped.to_string();
    }
    if let Some(stripped) = normalized.strip_suffix("-antigravity") {
        return stripped.to_string();
    }
    normalized.to_string()
}

pub fn upstream_model_name(model: &str) -> String {
    match normalize_requested_model_name(model).as_str() {
        "gemini-2.5-computer-use-preview-10-2025" => "rev19-uic3-1p".to_string(),
        "gemini-3-flash-agent" => "gemini-3-flash".to_string(),
        "gemini-3-pro-image-preview" => "gemini-3-pro-image".to_string(),
        "gemini-3-pro-preview" => "gemini-3-pro-high".to_string(),
        "gemini-3-flash-preview" => "gemini-3-flash".to_string(),
        "gemini-claude-sonnet-4-5" => "claude-sonnet-4-5".to_string(),
        "gemini-claude-sonnet-4-5-thinking" => "claude-sonnet-4-5-thinking".to_string(),
        "gemini-claude-opus-4-5-thinking" => "claude-opus-4-5-thinking".to_string(),
        other => other.to_string(),
    }
}

pub fn alias_model_name(model: &str) -> String {
    match model.trim().to_lowercase().as_str() {
        "rev19-uic3-1p" => "gemini-2.5-computer-use-preview-10-2025".to_string(),
        "gemini-3-pro-image" => "gemini-3-pro-image-preview".to_string(),
        "gemini-3-pro-high" => "gemini-3-pro-preview".to_string(),
        "gemini-3-flash" => "gemini-3-flash-preview".to_string(),
        "claude-sonnet-4-5" | "claude-sonnet-4-5-20250929" => {
            "gemini-claude-sonnet-4-5".to_string()
        }
        "claude-sonnet-4-5-thinking" | "claude-4.5-sonnet-thinking" => {
            "gemini-claude-sonnet-4-5-thinking".to_string()
        }
        "claude-opus-4-5-thinking" | "claude-opus-4.5-thinking" => {
            "gemini-claude-opus-4-5-thinking".to_string()
        }
        "claude-opus-4-5" | "claude-opus-4-5-20251101" => "claude-opus-4-5".to_string(),
        "gemini-3.1-flash-image-preview" | "gemini-3.1-flash-image" => {
            "gemini-3.1-flash-image".to_string()
        }
        "gemini-2.5-flash-image-preview" | "gemini-2.5-flash-image" => {
            "gemini-2.5-flash-image-preview".to_string()
        }
        other => other.to_string(),
    }
}

pub fn normalize_discovered_model_id(model_id: &str) -> Option<String> {
    let trimmed = model_id.trim();
    if trimmed.is_empty() {
        return None;
    }

    let without_models_prefix = trimmed
        .strip_prefix("models/")
        .or_else(|| trimmed.strip_prefix("Models/"))
        .unwrap_or(trimmed);
    let canonical = alias_model_name(without_models_prefix);

    if canonical.contains("image")
        && !matches!(
            canonical.as_str(),
            "gemini-3.1-flash-image"
                | "gemini-3-pro-image-preview"
                | "gemini-2.5-flash-image-preview"
        )
    {
        return None;
    }

    Some(canonical)
}

#[cfg(test)]
mod tests {
    use super::{alias_model_name, normalize_discovered_model_id, upstream_model_name};

    #[test]
    fn maps_aliases_bidirectionally() {
        assert_eq!(alias_model_name("gemini-3-flash"), "gemini-3-flash-preview");
        assert_eq!(
            upstream_model_name("gemini-3-flash-preview"),
            "gemini-3-flash"
        );
        assert_eq!(
            upstream_model_name("gemini-3-flash-agent"),
            "gemini-3-flash"
        );
        assert_eq!(
            alias_model_name("claude-sonnet-4-5-20250929"),
            "gemini-claude-sonnet-4-5"
        );
    }

    #[test]
    fn normalizes_discovered_model_ids() {
        assert_eq!(
            normalize_discovered_model_id("models/gemini-3-pro-high"),
            Some("gemini-3-pro-preview".to_string())
        );
        assert_eq!(
            normalize_discovered_model_id("claude-4.5-sonnet-thinking"),
            Some("gemini-claude-sonnet-4-5-thinking".to_string())
        );
    }
}
