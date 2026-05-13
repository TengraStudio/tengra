/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use super::ProviderModel;

pub(super) fn antigravity_thinking_levels(id: &str) -> Option<Vec<String>> {
    match id {
        "gemini-3.1-pro-preview" | "gemini-3-pro-preview" | "gemini-3-pro-high" => {
            Some(vec!["low".to_string(), "high".to_string()])
        }
        "gemini-3.1-flash-preview"
        | "gemini-3.1-flash"
        | "gemini-3-flash-preview"
        | "gemini-3-flash"
        | "gemini-3-flash-agent" => Some(vec![
            "minimal".to_string(),
            "low".to_string(),
            "medium".to_string(),
            "high".to_string(),
        ]),
        "gemini-3.1-flash-lite" => Some(vec!["minimal".to_string(), "low".to_string()]),
        "gemini-2.5-pro"
        | "gemini-2.5-flash"
        | "gemini-2.5-flash-lite"
        | "gemini-2.5-computer-use-preview-10-2025"
        | "rev19-uic3-1p" => Some(vec![
            "low".to_string(),
            "medium".to_string(),
            "high".to_string(),
        ]),
        "gemini-3.1-flash-image"
        | "gemini-3-pro-image-preview"
        | "gemini-2.5-flash-image-preview" => Some(vec!["low".to_string(), "high".to_string()]),
        _ => None,
    }
}

pub(super) fn codex_models() -> Vec<ProviderModel> {
    vec![
        static_model(
            "gpt-5.5",
            "GPT 5.5",
            "codex",
            Some("Latest GPT 5.5 release for coding and agentic tasks."),
            Some(vec!["minimal", "low", "medium", "high"]),
        ),
        static_model(
            "gpt-5.4",
            "GPT 5.4",
            "codex",
            Some("Stable version of GPT 5.4"),
            Some(vec!["low", "medium", "high", "xhigh"]),
        ),
        static_model(
            "gpt-5.4-mini",
            "GPT 5.4 Mini",
            "copilot",
            Some("Compact GPT 5.4 variant tuned for faster, lower-cost coding tasks."),
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "gpt-5.3-codex",
            "GPT 5.3 Codex",
            "codex",
            Some("Stable version of GPT 5.3 Codex"),
            Some(vec!["low", "medium", "high", "xhigh"]),
        ),
    ]
}

pub(super) fn is_supported_codex_model_id(model_id: &str) -> bool {
    matches!(
        model_id,
        "gpt-5.5" | "gpt-5.4" | "gpt-5.4-mini" | "gpt-5.3-codex"
    )
}

pub(super) fn claude_models() -> Vec<ProviderModel> {
    vec![
        static_model(
            "claude-opus-4-6",
            "Claude Opus 4.6",
            "claude",
            None,
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-sonnet-4-6",
            "Claude Sonnet 4.6",
            "claude",
            None,
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-haiku-4-5",
            "Claude Haiku 4.5",
            "claude",
            None,
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-opus-4-1-20250805",
            "Claude 4.1 Opus",
            "claude",
            None,
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-opus-4-20250514",
            "Claude 4 Opus",
            "claude",
            None,
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-sonnet-4-20250514",
            "Claude 4 Sonnet",
            "claude",
            None,
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-3-7-sonnet-20250219",
            "Claude 3.7 Sonnet",
            "claude",
            Some("Deprecated"),
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-3-5-sonnet-20241022",
            "Claude 3.5 Sonnet",
            "claude",
            Some("Deprecated"),
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-3-5-haiku-20241022",
            "Claude 3.5 Haiku",
            "claude",
            Some("Deprecated"),
            None,
        ),
        static_model(
            "claude-3-opus-20240229",
            "Claude 3 Opus",
            "claude",
            Some("Deprecated"),
            Some(vec!["low", "medium", "high"]),
        ),
        static_model(
            "claude-3-haiku-20240307",
            "Claude 3 Haiku",
            "claude",
            Some("Deprecated"),
            None,
        ),
    ]
}

pub(super) fn cursor_fallback_models() -> Vec<ProviderModel> {
    vec![
        static_model(
            "claude-3.5-sonnet",
            "Claude 3.5 Sonnet",
            "cursor",
            Some("High tier model (5-hour limit)"),
            None,
        ),
        static_model(
            "gpt-4o",
            "GPT-4o",
            "cursor",
            Some("High tier model (5-hour limit)"),
            None,
        ),
        static_model("gpt-4", "GPT-4", "cursor", Some("Premium model"), None),
        static_model(
            "cursor-small",
            "Cursor Small",
            "cursor",
            Some("Fast model"),
            None,
        ),
        static_model(
            "gpt-3.5-turbo",
            "GPT-3.5 Turbo",
            "cursor",
            Some("Fast model"),
            None,
        ),
    ]
}

fn static_model(
    id: &str,
    name: &str,
    provider: &str,
    description: Option<&str>,
    thinking_levels: Option<Vec<&str>>,
) -> ProviderModel {
    ProviderModel {
        id: id.to_string(),
        name: name.to_string(),
        provider: provider.to_string(),
        description: description.map(str::to_string),
        thinking_levels: thinking_levels
            .map(|levels| levels.into_iter().map(str::to_string).collect()),
        quota_info: None,
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codex_static_models_are_limited_to_supported_ids() {
        let models = codex_models();
        let ids = models
            .iter()
            .map(|model| model.id.as_str())
            .collect::<Vec<_>>();
        assert_eq!(
            ids,
            vec!["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex"]
        );
    }
}
