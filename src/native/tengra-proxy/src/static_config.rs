pub const ANTIGRAVITY_CLIENT_ID: &str =
    "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
pub const ANTIGRAVITY_CLIENT_SECRET: &str = "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";
pub const OPENAI_OAUTH_CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
pub const ANTHROPIC_OAUTH_CLIENT_ID: &str = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
pub const QWEN_CLIENT_ID: &str = "f0304373b74a44d2b584a3fb70ca9e56";
pub const IFLOW_CLIENT_ID: &str = "10009311001";
pub const IFLOW_CLIENT_SECRET: &str = "4Z3YjXycVsQvyGF1etiNlIBB4RsqSDtW";

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

#[cfg(test)]
mod tests {
    use super::{oauth_client_id, oauth_client_secret};

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
}
