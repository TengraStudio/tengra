/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use std::collections::HashSet;
use std::sync::OnceLock;

#[derive(Debug, Clone, Copy)]
pub struct ModelInfo {
    pub id: &'static str,
    pub provider: &'static str,
    pub owned_by: &'static str,
    pub created: u64,
    pub context_length: u32,
    pub max_completion_tokens: u32,
    pub thinking_levels: &'static [&'static str],
}

static MODEL_CATALOG: OnceLock<Vec<ModelInfo>> = OnceLock::new();

fn get_catalog() -> &'static Vec<ModelInfo> {
    MODEL_CATALOG.get_or_init(|| {
        vec![
            ModelInfo {
                id: "claude-opus-4.6",
                provider: "claude",
                owned_by: "anthropic",
                created: 1_759_449_600,
                context_length: 1_000_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "claude-sonnet-4-6",
                provider: "claude",
                owned_by: "anthropic",
                created: 1_759_449_600,
                context_length: 1_000_000,
                max_completion_tokens: 64_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "claude-haiku-4-5",
                provider: "claude",
                owned_by: "anthropic",
                created: 1_759_449_600,
                context_length: 200_000,
                max_completion_tokens: 64_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "claude-3-7-sonnet-20250219",
                provider: "claude",
                owned_by: "anthropic",
                created: 1_708_300_800,
                context_length: 128_000,
                max_completion_tokens: 8_192,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "claude-3-5-sonnet-20241022",
                provider: "claude",
                owned_by: "anthropic",
                created: 1_729_555_200,
                context_length: 128_000,
                max_completion_tokens: 8_192,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "claude-3-5-haiku-20241022",
                provider: "claude",
                owned_by: "anthropic",
                created: 1_729_555_200,
                context_length: 128_000,
                max_completion_tokens: 8_192,
                thinking_levels: &[],
            },
            // Antigravity (OAuth)
            ModelInfo {
                id: "gemini-3.1-pro-high",
                provider: "antigravity",
                owned_by: "google",
                created: 1_765_929_600,
                context_length: 1_048_576,
                max_completion_tokens: 65_536,
                thinking_levels: &["high"],
            },
            ModelInfo {
                id: "gemini-3.1-pro-low",
                provider: "antigravity",
                owned_by: "google",
                created: 1_765_929_600,
                context_length: 1_048_576,
                max_completion_tokens: 65_536,
                thinking_levels: &["low"],
            },
            ModelInfo {
                id: "gemini-3-flash",
                provider: "antigravity",
                owned_by: "google",
                created: 1_765_929_600,
                context_length: 1_048_576,
                max_completion_tokens: 65_536,
                thinking_levels: &["minimal", "low", "medium", "high"],
            },
            ModelInfo {
                id: "claude-sonnet-4-6-thinking",
                provider: "antigravity",
                owned_by: "anthropic",
                created: 1_765_929_600,
                context_length: 1_000_000,
                max_completion_tokens: 64_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "claude-opus-4-6-thinking",
                provider: "antigravity",
                owned_by: "anthropic",
                created: 1_765_929_600,
                context_length: 1_000_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "gpt-oss-120b",
                provider: "antigravity",
                owned_by: "openai",
                created: 1_758_019_200,
                context_length: 131_072,
                max_completion_tokens: 65_536,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "gemini-3.1-flash-image",
                provider: "antigravity",
                owned_by: "google",
                created: 1_767_225_600,
                context_length: 65_536,
                max_completion_tokens: 4_096,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "gemini-2.5-pro",
                provider: "antigravity",
                owned_by: "google",
                created: 1_750_118_400,
                context_length: 1_048_576,
                max_completion_tokens: 65_536,
                thinking_levels: &["low", "medium", "high", "auto"],
            },
            ModelInfo {
                id: "gemini-2.5-flash",
                provider: "antigravity",
                owned_by: "google",
                created: 1_750_118_400,
                context_length: 1_048_576,
                max_completion_tokens: 65_536,
                thinking_levels: &["minimal", "low", "medium", "high", "auto"],
            },
            ModelInfo {
                id: "gemini-2.5-flash-lite",
                provider: "antigravity",
                owned_by: "google",
                created: 1_750_118_400,
                context_length: 1_048_576,
                max_completion_tokens: 8_192,
                thinking_levels: &[],
            },
            // OpenAI Codex (OAuth)
            ModelInfo {
                id: "gpt-5.5",
                provider: "codex",
                owned_by: "openai",
                created: 1_767_225_600,         //will be updated
                context_length: 1_050_000,      //will be updated
                max_completion_tokens: 128_000, //will be updated
                thinking_levels: &["minimal", "low", "medium", "high"],
            },
            ModelInfo {
                id: "gpt-5.4",
                provider: "codex",
                owned_by: "openai",
                created: 1_767_225_600,
                context_length: 1_050_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["minimal", "low", "medium", "high"],
            },
            ModelInfo {
                id: "gpt-5.4-mini",
                provider: "codex",
                owned_by: "openai",
                created: 1_767_225_600,
                context_length: 400_000,
                max_completion_tokens: 64_000,
                thinking_levels: &["minimal", "low", "medium"],
            },
            ModelInfo {
                id: "gpt-5.3-codex",
                provider: "codex",
                owned_by: "openai",
                created: 1_758_019_200,
                context_length: 400_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["low", "medium", "high", "xhigh"],
            },
            // Copilot
            ModelInfo {
                id: "gpt-4.1",
                provider: "copilot",
                owned_by: "github",
                created: 1_726_012_800,
                context_length: 128_000,
                max_completion_tokens: 16_384,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "gpt-4o",
                provider: "copilot",
                owned_by: "github",
                created: 1_713_651_200,
                context_length: 128_000,
                max_completion_tokens: 16_384,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "gpt-4o-mini",
                provider: "copilot",
                owned_by: "github",
                created: 1_721_091_200,
                context_length: 128_000,
                max_completion_tokens: 16_384,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "gpt-5-mini",
                provider: "copilot",
                owned_by: "github",
                created: 1_738_281_600,
                context_length: 128_000,
                max_completion_tokens: 16_384,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "gpt-5.1",
                provider: "copilot",
                owned_by: "github",
                created: 1_743_465_600,
                context_length: 400_000,
                max_completion_tokens: 65_536,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "gpt-5.1-codex",
                provider: "copilot",
                owned_by: "github",
                created: 1_743_465_600,
                context_length: 400_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "gpt-5.1-codex-mini",
                provider: "copilot",
                owned_by: "github",
                created: 1_743_465_600,
                context_length: 128_000,
                max_completion_tokens: 16_384,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "gpt-5.1-codex-max",
                provider: "copilot",
                owned_by: "github",
                created: 1_743_465_600,
                context_length: 400_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["low", "medium", "high", "xhigh"],
            },
            ModelInfo {
                id: "gpt-5.2",
                provider: "copilot",
                owned_by: "github",
                created: 1_757_894_400,
                context_length: 400_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["low", "medium", "high", "xhigh"],
            },
            ModelInfo {
                id: "gpt-5.2-codex",
                provider: "copilot",
                owned_by: "github",
                created: 1_757_894_400,
                context_length: 1_000_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["low", "medium", "high", "xhigh"],
            },
            ModelInfo {
                id: "gpt-5.3-codex",
                provider: "copilot",
                owned_by: "github",
                created: 1_758_019_200,
                context_length: 1_000_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["low", "medium", "high", "xhigh"],
            },
            ModelInfo {
                id: "gpt-5.4",
                provider: "copilot",
                owned_by: "github",
                created: 1_767_225_600,
                context_length: 1_050_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["minimal", "low", "medium", "high"],
            },
            ModelInfo {
                id: "gpt-5.4-mini",
                provider: "copilot",
                owned_by: "github",
                created: 1_767_225_600,
                context_length: 400_000,
                max_completion_tokens: 64_000,
                thinking_levels: &["minimal", "low", "medium"],
            },
            ModelInfo {
                id: "claude-haiku-4.5",
                provider: "copilot",
                owned_by: "github",
                created: 1_759_449_600,
                context_length: 200_000,
                max_completion_tokens: 64_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "claude-opus-4.5",
                provider: "copilot",
                owned_by: "github",
                created: 1_759_449_600,
                context_length: 1_000_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "claude-opus-4.6",
                provider: "copilot",
                owned_by: "github",
                created: 1_759_449_600,
                context_length: 1_000_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "claude-opus-4.6-fast",
                provider: "copilot",
                owned_by: "github",
                created: 1_759_449_600,
                context_length: 1_000_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "claude-sonnet-4",
                provider: "copilot",
                owned_by: "github",
                created: 1_759_449_600,
                context_length: 1_000_000,
                max_completion_tokens: 64_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "claude-sonnet-4.5",
                provider: "copilot",
                owned_by: "github",
                created: 1_759_449_600,
                context_length: 1_000_000,
                max_completion_tokens: 64_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "claude-sonnet-4.6",
                provider: "copilot",
                owned_by: "github",
                created: 1_759_449_600,
                context_length: 1_000_000,
                max_completion_tokens: 64_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "gemini-2.5-pro",
                provider: "copilot",
                owned_by: "github",
                created: 1_750_118_400,
                context_length: 1_048_576,
                max_completion_tokens: 65_536,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "gemini-3-flash",
                provider: "copilot",
                owned_by: "github",
                created: 1_765_929_600,
                context_length: 1_048_576,
                max_completion_tokens: 65_536,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "gemini-3.1-pro",
                provider: "copilot",
                owned_by: "github",
                created: 1_737_158_400,
                context_length: 1_048_576,
                max_completion_tokens: 65_536,
                thinking_levels: &["low", "high"],
            },
            ModelInfo {
                id: "grok-code-fast-1",
                provider: "copilot",
                owned_by: "github",
                created: 1_750_118_400,
                context_length: 128_000,
                max_completion_tokens: 32_768,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "raptor-mini",
                provider: "copilot",
                owned_by: "github",
                created: 1_750_118_400,
                context_length: 128_000,
                max_completion_tokens: 16_384,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "goldeneye",
                provider: "copilot",
                owned_by: "github",
                created: 1_750_118_400,
                context_length: 128_000,
                max_completion_tokens: 32_768,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "nvidia/llama-3.1-nemotron-70b-instruct",
                provider: "nvidia",
                owned_by: "nvidia",
                created: 1_720_224_000,
                context_length: 128_000,
                max_completion_tokens: 4_096,
                thinking_levels: &[],
            },
            // OpenAI API (sk-... keys)
            ModelInfo {
                id: "gpt-5.4",
                provider: "openai",
                owned_by: "openai",
                created: 1_767_225_600,
                context_length: 1_050_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["minimal", "low", "medium", "high"],
            },
            ModelInfo {
                id: "gpt-5.4-mini",
                provider: "openai",
                owned_by: "openai",
                created: 1_767_225_600,
                context_length: 400_000,
                max_completion_tokens: 64_000,
                thinking_levels: &["minimal", "low", "medium"],
            },
            ModelInfo {
                id: "gpt-5.4-nano",
                provider: "openai",
                owned_by: "openai",
                created: 1_767_225_600,
                context_length: 400_000,
                max_completion_tokens: 16_384,
                thinking_levels: &["minimal", "low"],
            },
            ModelInfo {
                id: "gpt-5",
                provider: "openai",
                owned_by: "openai",
                created: 1_754_524_800,
                context_length: 400_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["minimal", "low", "medium", "high"],
            },
            ModelInfo {
                id: "gpt-5-codex",
                provider: "openai",
                owned_by: "openai",
                created: 1_757_894_400,
                context_length: 400_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "o3",
                provider: "openai",
                owned_by: "openai",
                created: 1_767_225_600,
                context_length: 200_000,
                max_completion_tokens: 65_536,
                thinking_levels: &["minimal", "low", "medium", "high"],
            },
            ModelInfo {
                id: "o4-mini",
                provider: "openai",
                owned_by: "openai",
                created: 1_767_225_600,
                context_length: 200_000,
                max_completion_tokens: 65_536,
                thinking_levels: &["minimal", "low", "medium", "high"],
            },
            ModelInfo {
                id: "o1-preview",
                provider: "openai",
                owned_by: "openai",
                created: 1_726_012_800,
                context_length: 128_000,
                max_completion_tokens: 32_768,
                thinking_levels: &["medium", "high"],
            },
            ModelInfo {
                id: "o1-mini",
                provider: "openai",
                owned_by: "openai",
                created: 1_726_012_800,
                context_length: 128_000,
                max_completion_tokens: 65_536,
                thinking_levels: &["medium", "high"],
            },
            ModelInfo {
                id: "gpt-4o",
                provider: "openai",
                owned_by: "openai",
                created: 1_713_651_200,
                context_length: 128_000,
                max_completion_tokens: 16_384,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "gpt-4o-mini",
                provider: "openai",
                owned_by: "openai",
                created: 1_721_091_200,
                context_length: 128_000,
                max_completion_tokens: 16_384,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "gpt-4-turbo",
                provider: "openai",
                owned_by: "openai",
                created: 1_712_620_800,
                context_length: 128_000,
                max_completion_tokens: 4_096,
                thinking_levels: &[],
            },
            // Google Gemini API
            ModelInfo {
                id: "gemini-2.0-flash",
                provider: "gemini",
                owned_by: "google",
                created: 1_733_961_600,
                context_length: 1_048_576,
                max_completion_tokens: 8_192,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "gemini-2.0-flash-lite",
                provider: "gemini",
                owned_by: "google",
                created: 1_738_281_600,
                context_length: 1_048_576,
                max_completion_tokens: 8_192,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "gemini-2.5-pro",
                provider: "gemini",
                owned_by: "google",
                created: 1_750_118_400,
                context_length: 1_048_576,
                max_completion_tokens: 65_536,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "gemini-2.5-flash",
                provider: "gemini",
                owned_by: "google",
                created: 1_750_118_400,
                context_length: 1_048_576,
                max_completion_tokens: 65_536,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "gemini-3.1-pro-preview",
                provider: "gemini",
                owned_by: "google",
                created: 1_737_158_400,
                context_length: 1_048_576,
                max_completion_tokens: 65_536,
                thinking_levels: &["low", "high"],
            },
            ModelInfo {
                id: "gemini-3.1-flash-preview",
                provider: "gemini",
                owned_by: "google",
                created: 1_765_929_600,
                context_length: 1_048_576,
                max_completion_tokens: 65_536,
                thinking_levels: &["minimal", "low", "medium", "high"],
            },
            ModelInfo {
                id: "gemini-3.1-flash-lite",
                provider: "gemini",
                owned_by: "google",
                created: 1_765_929_600,
                context_length: 1_048_576,
                max_completion_tokens: 8_192,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "gemini-3.1-flash-image",
                provider: "gemini",
                owned_by: "google",
                created: 1_765_929_600,
                context_length: 65_536,
                max_completion_tokens: 4_096,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "gemini-3-pro-image",
                provider: "gemini",
                owned_by: "google",
                created: 1_765_929_600,
                context_length: 65_536,
                max_completion_tokens: 4_096,
                thinking_levels: &[],
            },
            // Mistral AI
            ModelInfo {
                id: "magistral-medium-2507",
                provider: "mistral",
                owned_by: "mistral",
                created: 1_761_868_800,
                context_length: 128_000,
                max_completion_tokens: 8_192,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "mistral-small-2503",
                provider: "mistral",
                owned_by: "mistral",
                created: 1_741_219_200,
                context_length: 32_000,
                max_completion_tokens: 8_192,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "codestral-2501",
                provider: "mistral",
                owned_by: "mistral",
                created: 1_736_035_200,
                context_length: 32_000,
                max_completion_tokens: 8_192,
                thinking_levels: &[],
            },
            // Groq
            ModelInfo {
                id: "llama-3.3-70b-versatile",
                provider: "groq",
                owned_by: "meta",
                created: 1_733_875_200,
                context_length: 128_000,
                max_completion_tokens: 32_768,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "llama-3.1-8b-instant",
                provider: "groq",
                owned_by: "meta",
                created: 1_721_692_800,
                context_length: 128_000,
                max_completion_tokens: 8_000,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "openai/gpt-oss-120b",
                provider: "groq",
                owned_by: "openai",
                created: 1_758_019_200,
                context_length: 131_072,
                max_completion_tokens: 65_536,
                thinking_levels: &[],
            },
            // xAI (Grok)
            ModelInfo {
                id: "grok-4.20",
                provider: "xai",
                owned_by: "xai",
                created: 1_764_547_200,
                context_length: 2_000_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "grok-4",
                provider: "xai",
                owned_by: "xai",
                created: 1_764_547_200,
                context_length: 2_000_000,
                max_completion_tokens: 128_000,
                thinking_levels: &["medium", "high"],
            },
            // DeepSeek
            ModelInfo {
                id: "deepseek-chat",
                provider: "deepseek",
                owned_by: "deepseek",
                created: 1_735_689_600,
                context_length: 64_000,
                max_completion_tokens: 8_192,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "deepseek-coder",
                provider: "deepseek",
                owned_by: "deepseek",
                created: 1_699_056_000,
                context_length: 64_000,
                max_completion_tokens: 8_192,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "deepseek-reasoner",
                provider: "deepseek",
                owned_by: "deepseek",
                created: 1_737_331_200,
                context_length: 64_000,
                max_completion_tokens: 8_192,
                thinking_levels: &["medium", "high"],
            },
            // OpenRouter (meta-router)
            ModelInfo {
                id: "anthropic/claude-sonnet-4",
                provider: "openrouter",
                owned_by: "openrouter",
                created: 1_714_521_600,
                context_length: 200_000,
                max_completion_tokens: 64_000,
                thinking_levels: &["low", "medium", "high"],
            },
            ModelInfo {
                id: "openai/gpt-4o",
                provider: "openrouter",
                owned_by: "openrouter",
                created: 1_713_651_200,
                context_length: 128_000,
                max_completion_tokens: 16_384,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "google/gemini-2.0-flash",
                provider: "openrouter",
                owned_by: "openrouter",
                created: 1_733_961_600,
                context_length: 1_048_576,
                max_completion_tokens: 8_192,
                thinking_levels: &[],
            },
            ModelInfo {
                id: "meta-llama/llama-3.3-70b-instruct",
                provider: "openrouter",
                owned_by: "openrouter",
                created: 1_733_356_800,
                context_length: 131_072,
                max_completion_tokens: 8_192,
                thinking_levels: &[],
            },
        ]
    })
}

pub fn resolve_provider(model: &str) -> Option<&'static str> {
    let lower = model.trim().to_lowercase();

    // Cursor
    if lower.starts_with("cursor-") || lower == "default" {
        return Some("cursor");
    }

    // GitHub Copilot
    if lower.starts_with("copilot-") || lower.starts_with("github-") {
        return Some("copilot");
    }

    // OpenAI Codex (OAuth-based)
    if lower.contains("codex") {
        return Some("codex");
    }

    // Anthropic Claude
    if lower.starts_with("claude-") {
        return Some("claude");
    }

    // Google Gemini
    if lower.starts_with("gemini-") {
        return Some("gemini");
    }

    // Antigravity (OAuth)
    if lower.starts_with("antigravity/") {
        return Some("antigravity");
    }

    // NVIDIA NIM
    if lower.starts_with("nvidia/") || lower.starts_with("nim/") {
        return Some("nvidia");
    }

    // Mistral AI
    if lower.starts_with("mistral-")
        || lower.starts_with("codestral")
        || lower.starts_with("pixtral")
        || lower.starts_with("ministral")
    {
        return Some("mistral");
    }

    // Groq (fast inference)
    if lower.starts_with("groq/") || lower.contains("groq") {
        return Some("groq");
    }

    // xAI Grok
    if lower.starts_with("grok-") || lower.starts_with("xai/") {
        return Some("xai");
    }

    // DeepSeek
    if lower.starts_with("deepseek-") || lower.starts_with("deepseek/") {
        return Some("deepseek");
    }

    // OpenRouter (explicit prefix)
    if lower.starts_with("openrouter/") {
        return Some("openrouter");
    }

    // OpenAI (GPT models via API key or OAuth)
    if lower.starts_with("gpt-")
        || lower.starts_with("o1")
        || lower.starts_with("o3")
        || lower.starts_with("o4")
    {
        return Some("openai");
    }

    get_catalog()
        .iter()
        .find(|info| info.id.eq_ignore_ascii_case(model))
        .map(|info| info.provider)
}

pub fn providers_for_model(model: &str) -> Vec<&'static str> {
    let mut providers = Vec::new();
    for info in get_catalog().iter() {
        if info.id.eq_ignore_ascii_case(model) && !providers.contains(&info.provider) {
            providers.push(info.provider);
        }
    }
    providers
}

#[allow(dead_code)]
pub fn get_all_models(providers: Option<&HashSet<String>>) -> Vec<ModelInfo> {
    get_catalog()
        .iter()
        .copied()
        .filter(|info| {
            providers
                .map(|allowed| allowed.contains(info.provider))
                .unwrap_or(true)
        })
        .collect()
}

pub fn find_model(provider: &str, id: &str) -> Option<ModelInfo> {
    get_catalog()
        .iter()
        .copied()
        .find(|info| info.provider == provider && info.id.eq_ignore_ascii_case(id))
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::{get_all_models, resolve_provider};

    #[test]
    fn preserves_duplicate_model_ids_across_providers() {
        let models = get_all_models(None);
        let gpt4o_count = models.iter().filter(|model| model.id == "gpt-4o").count();
        assert!(gpt4o_count >= 2);
    }

    #[test]
    fn filters_catalog_by_available_providers() {
        let providers = HashSet::from([String::from("claude")]);
        let models = get_all_models(Some(&providers));
        assert!(!models.is_empty());
        assert!(models.iter().all(|model| model.provider == "claude"));
    }

    #[test]
    fn resolves_openai_style_models_to_openai_provider() {
        assert_eq!(resolve_provider("gpt-4o"), Some("openai"));
        assert_eq!(resolve_provider("gpt-5"), Some("openai"));
        assert_eq!(resolve_provider("o1-mini"), Some("openai"));
    }

    #[test]
    fn resolves_codex_models_to_codex_provider() {
        assert_eq!(resolve_provider("codex-latest"), Some("codex"));
        assert_eq!(resolve_provider("gpt-5-codex"), Some("codex"));
    }

    #[test]
    fn resolves_copilot_models() {
        assert_eq!(resolve_provider("copilot-gpt-4o"), Some("copilot"));
    }

    #[test]
    fn resolves_new_providers() {
        assert_eq!(resolve_provider("magistral-medium-2507"), Some("mistral"));
        assert_eq!(resolve_provider("grok-4.20"), Some("xai"));
        assert_eq!(resolve_provider("deepseek-chat"), Some("deepseek"));
        assert_eq!(
            resolve_provider("openrouter/anthropic/claude-sonnet-4"),
            Some("openrouter")
        );
        assert_eq!(resolve_provider("gemini-2.5-pro"), Some("gemini"));
    }
}
