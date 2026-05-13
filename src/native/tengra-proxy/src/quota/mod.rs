/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
pub mod antigravity;
pub mod claude;
pub mod codex;
pub mod copilot;
pub mod cursor;
pub mod types;

use types::QuotaResult;

pub async fn check_quota(provider: &str, token: &str) -> anyhow::Result<QuotaResult> {
    match provider {
        "antigravity" | "google" => antigravity::fetch_antigravity_quota(token).await,
        "codex" | "openai" => codex::fetch_codex_quota(token).await,
        "claude" | "anthropic" => claude::fetch_claude_quota(token, None).await,
        "copilot" | "github" => copilot::fetch_copilot_quota(token).await,
        "cursor" => cursor::fetch_cursor_quota(token).await,
        _ => Err(anyhow::anyhow!(
            "Unsupported provider for quota check: {}",
            provider
        )),
    }
}
