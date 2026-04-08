pub const ANTIGRAVITY_CLIENT_ID: &str =
    "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
pub const ANTIGRAVITY_CLIENT_SECRET: &str = "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";
pub const OPENAI_OAUTH_CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
pub const ANTHROPIC_OAUTH_CLIENT_ID: &str = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
pub const QWEN_CLIENT_ID: &str = "f0304373b74a44d2b584a3fb70ca9e56";
pub const IFLOW_CLIENT_ID: &str = "10009311001";
pub const IFLOW_CLIENT_SECRET: &str = "4Z3YjXycVsQvyGF1etiNlIBB4RsqSDtW";
const OAUTH_TIMEOUT_MIN_SECS: u64 = 10;
const OAUTH_TIMEOUT_MAX_SECS: u64 = 600;

pub fn oauth_client_id(provider: &str) -> Option<&'static str> {
    match provider {
        "codex" | "openai" => Some(OPENAI_OAUTH_CLIENT_ID),
        "claude" | "anthropic" => Some(ANTHROPIC_OAUTH_CLIENT_ID),
        "antigravity" | "google" => Some(ANTIGRAVITY_CLIENT_ID),
        "qwen" => Some(QWEN_CLIENT_ID),
        "iflow" => Some(IFLOW_CLIENT_ID),
        _ => None,
    }
}

pub fn oauth_client_secret(provider: &str) -> Option<&'static str> {
    match provider {
        "antigravity" | "google" => Some(ANTIGRAVITY_CLIENT_SECRET),
        "iflow" => Some(IFLOW_CLIENT_SECRET),
        _ => None,
    }
}

fn normalize_oauth_provider(provider: &str) -> &str {
    match provider {
        "openai" => "codex",
        "anthropic" => "claude",
        "google" => "antigravity",
        _ => provider,
    }
}

fn parse_timeout_override(env_key: &str) -> anyhow::Result<Option<u64>> {
    let value = match std::env::var(env_key) {
        Ok(value) => value,
        Err(std::env::VarError::NotPresent) => return Ok(None),
        Err(error) => return Err(anyhow::anyhow!("Failed to read {}: {}", env_key, error)),
    };
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    let parsed = trimmed
        .parse::<u64>()
        .map_err(|_| anyhow::anyhow!("{} must be an integer, got '{}'", env_key, trimmed))?;
    if !(OAUTH_TIMEOUT_MIN_SECS..=OAUTH_TIMEOUT_MAX_SECS).contains(&parsed) {
        return Err(anyhow::anyhow!(
            "{} must be between {} and {} seconds",
            env_key,
            OAUTH_TIMEOUT_MIN_SECS,
            OAUTH_TIMEOUT_MAX_SECS
        ));
    }
    Ok(Some(parsed))
}

pub fn oauth_provider_timeout_secs(provider: &str) -> anyhow::Result<u64> {
    let normalized = normalize_oauth_provider(provider);
    let env_key = format!(
        "TENGRA_OAUTH_TIMEOUT_{}_SECS",
        normalized.to_ascii_uppercase()
    );
    if let Some(provider_timeout) = parse_timeout_override(env_key.as_str())? {
        return Ok(provider_timeout);
    }
    if let Some(global_timeout) = parse_timeout_override("TENGRA_OAUTH_TIMEOUT_SECS")? {
        return Ok(global_timeout);
    }
    Ok(default_oauth_timeout_secs(normalized))
}

fn default_oauth_timeout_secs(provider: &str) -> u64 {
    match provider {
        "claude" | "antigravity" | "ollama" => 300,
        _ => 20,
    }
}

#[cfg(test)]
mod tests {
    use super::{oauth_client_id, oauth_client_secret, oauth_provider_timeout_secs};

    #[test]
    fn returns_hardcoded_public_client_ids() {
        assert_eq!(
            oauth_client_id("codex"),
            Some("app_EMoamEEZ73f0CkXaXp7hrann")
        );
        assert_eq!(
            oauth_client_id("antigravity"),
            Some("1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com")
        );
        assert_eq!(
            oauth_client_id("qwen"),
            Some("f0304373b74a44d2b584a3fb70ca9e56")
        );
    }

    #[test]
    fn returns_hardcoded_public_client_secrets() {
        assert_eq!(
            oauth_client_secret("antigravity"),
            Some("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")
        );
        assert_eq!(
            oauth_client_secret("iflow"),
            Some("4Z3YjXycVsQvyGF1etiNlIBB4RsqSDtW")
        );
    }

    #[test]
    fn reads_provider_specific_timeout_override() {
        std::env::set_var("TENGRA_OAUTH_TIMEOUT_CODEX_SECS", "42");
        let timeout = oauth_provider_timeout_secs("codex").expect("timeout");
        assert_eq!(timeout, 42);
        std::env::remove_var("TENGRA_OAUTH_TIMEOUT_CODEX_SECS");
    }

    #[test]
    fn validates_timeout_bounds_strictly() {
        std::env::set_var("TENGRA_OAUTH_TIMEOUT_SECS", "2");
        let error =
            oauth_provider_timeout_secs("claude").expect_err("out-of-range timeout should fail");
        assert!(error.to_string().contains("between 10 and 600"));
        std::env::remove_var("TENGRA_OAUTH_TIMEOUT_SECS");
    }

    #[test]
    fn uses_extended_default_timeout_for_ollama() {
        assert_eq!(super::default_oauth_timeout_secs("ollama"), 300);
    }
}
