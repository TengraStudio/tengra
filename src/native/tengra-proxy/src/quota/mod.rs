pub mod antigravity;
pub mod claude;
pub mod codex;
pub mod copilot;
pub mod types;

use types::QuotaResult;

pub async fn check_quota(provider: &str, token: &str) -> anyhow::Result<QuotaResult> {
    match provider {
        "antigravity" | "google" => antigravity::fetch_antigravity_quota(token).await,
        "codex" | "openai" => codex::fetch_codex_quota(token).await,
        "claude" | "anthropic" => claude::fetch_claude_quota(token, None).await,
        "copilot" | "github" => copilot::fetch_copilot_quota(token).await,
        _ => Err(anyhow::anyhow!(
            "Unsupported provider for quota check: {}",
            provider
        )),
    }
}
