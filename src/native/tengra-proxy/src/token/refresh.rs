use reqwest::Client;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize, serde::Serialize)]
pub struct AuthToken {
    pub id: String,
    pub provider: String,
    pub refresh_token: Option<String>,
    pub access_token: Option<String>,
    pub session_token: Option<String>,
    pub expires_at: Option<i64>,
    pub scope: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug)]
pub struct RefreshResponse {
    pub success: bool,
    pub token: Option<AuthToken>,
    pub error: Option<String>,
    pub invalidate_account: bool,
}

pub async fn execute_refresh(
    client: &Client,
    mut token: AuthToken,
    client_id: String,
    client_secret: Option<String>,
) -> RefreshResponse {
    if token.provider.contains("copilot") {
        return fetch_copilot_token(client, token).await;
    }

    let refresh_token_str = match &token.refresh_token {
        Some(rt) => rt,
        None => {
            return RefreshResponse {
                success: false,
                token: None,
                error: Some("No refresh token".into()),
                invalidate_account: false,
            }
        }
    };

    let url = if token.provider.contains("google") || token.provider.contains("antigravity") {
        "https://oauth2.googleapis.com/token"
    } else if token.provider.contains("codex") || token.provider.contains("openai") {
        "https://auth.openai.com/oauth/token"
    } else if token.provider.contains("claude") || token.provider.contains("anthropic") {
        "https://api.anthropic.com/v1/oauth/token"
    } else {
        return RefreshResponse {
            success: false,
            token: None,
            error: Some("Unknown provider".into()),
            invalidate_account: false,
        };
    };

    let mut params = std::collections::HashMap::new();
    params.insert("client_id", client_id);
    params.insert("grant_type", "refresh_token".to_string());
    params.insert("refresh_token", refresh_token_str.clone());

    if let Some(secret) = client_secret {
        params.insert("client_secret", secret);
    }

    let mut request_builder = client.post(url).header("Accept", "application/json");

    if token.provider.contains("claude") || token.provider.contains("anthropic") {
        request_builder = request_builder
            .header(
                "User-Agent",
                "Mozilla/5.0 (Node.js) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0",
            )
            .header(
                "x-anthropic-billing-header",
                "cc_version=2.1.19; cc_entrypoint=unknown",
            )
            .header("x-anthropic-additional-protection", "true")
            .form(&params);
    } else {
        request_builder = request_builder.form(&params);
    }

    let res = match request_builder.send().await {
        Ok(r) => r,
        Err(e) => {
            return RefreshResponse {
                success: false,
                token: None,
                error: Some(e.to_string()),
                invalidate_account: false,
            }
        }
    };

    if !res.status().is_success() {
        let status = res.status();
        let error_body = res.text().await.unwrap_or_default();
        let invalidate_account =
            should_invalidate_oauth_account(token.provider.as_str(), status.as_u16(), &error_body);
        return RefreshResponse {
            success: false,
            token: None,
            error: Some(format!("HTTP {} - {}", status, error_body)),
            invalidate_account,
        };
    }

    #[derive(Deserialize)]
    struct OAuthResponse {
        access_token: String,
        expires_in: i64,
        refresh_token: Option<String>,
    }

    match res.json::<OAuthResponse>().await {
        Ok(data) => {
            token.access_token = Some(data.access_token);
            if let Some(new_rt) = data.refresh_token {
                token.refresh_token = Some(new_rt);
            }
            token.expires_at =
                Some(chrono::Utc::now().timestamp_millis() + (data.expires_in * 1000));
            RefreshResponse {
                success: true,
                token: Some(token),
                error: None,
                invalidate_account: false,
            }
        }
        Err(e) => RefreshResponse {
            success: false,
            token: None,
            error: Some(format!("Parse error: {}", e)),
            invalidate_account: false,
        },
    }
}

async fn fetch_copilot_token(_client: &Client, mut token: AuthToken) -> RefreshResponse {
    let access_token = match &token.access_token {
        Some(at) => at,
        None => {
            return RefreshResponse {
                success: false,
                token: None,
                error: Some("No access token for Copilot".into()),
                invalidate_account: false,
            }
        }
    };

    let copilot_client = crate::auth::copilot::CopilotClient::new();
    match copilot_client
        .exchange_for_copilot_token(access_token)
        .await
    {
        Ok(data) => {
            token.session_token = Some(data.token);
            token.expires_at = Some((data.expires_at as i64) * 1000);
            RefreshResponse {
                success: true,
                token: Some(token),
                error: None,
                invalidate_account: false,
            }
        }
        Err(error) => {
            let error_text = error.to_string();
            let invalidate_account = should_invalidate_copilot_account(&token, &error_text);
            RefreshResponse {
                success: false,
                token: None,
                error: Some(error_text),
                invalidate_account,
            }
        }
    }
}

fn should_invalidate_copilot_account(token: &AuthToken, error_text: &str) -> bool {
    if has_usable_copilot_session(token) {
        return false;
    }

    let lower = error_text.to_ascii_lowercase();
    lower.contains("401")
        || lower.contains("404")
        || lower.contains("bad credentials")
        || lower.contains("not found")
}

fn should_invalidate_oauth_account(provider: &str, status_code: u16, error_body: &str) -> bool {
    if !(provider.contains("google")
        || provider.contains("antigravity")
        || provider.contains("codex")
        || provider.contains("openai")
        || provider.contains("claude")
        || provider.contains("anthropic"))
    {
        return false;
    }

    if status_code != 400 && status_code != 401 {
        return false;
    }

    let lowered = error_body.to_ascii_lowercase();
    lowered.contains("invalid_grant")
        || lowered.contains("invalid refresh token")
        || lowered.contains("refresh token is invalid")
        || lowered.contains("token has been expired or revoked")
        || lowered.contains("revoked")
}

fn has_usable_copilot_session(token: &AuthToken) -> bool {
    let Some(session_token) = token.session_token.as_deref() else {
        return false;
    };
    if session_token.trim().is_empty() {
        return false;
    }

    let Some(expires_at) = token.expires_at else {
        return false;
    };

    expires_at > chrono::Utc::now().timestamp_millis()
}

#[cfg(test)]
mod tests {
    use super::{should_invalidate_copilot_account, should_invalidate_oauth_account};
    use crate::token::refresh::AuthToken;

    #[test]
    fn invalidates_copilot_accounts_on_auth_failures() {
        let empty_token = AuthToken {
            id: "copilot-1".to_string(),
            provider: "copilot".to_string(),
            refresh_token: None,
            access_token: Some("ghu_token".to_string()),
            session_token: None,
            expires_at: None,
            scope: None,
            email: None,
        };
        assert!(should_invalidate_copilot_account(
            &empty_token,
            "Copilot token exchange failed (401 Unauthorized): Bad credentials"
        ));
        assert!(should_invalidate_copilot_account(
            &empty_token,
            "Copilot token exchange failed (404 Not Found)"
        ));
        assert!(!should_invalidate_copilot_account(
            &empty_token,
            "temporary upstream timeout"
        ));
    }

    #[test]
    fn keeps_existing_copilot_session_on_refresh_failure() {
        let token = AuthToken {
            id: "copilot-2".to_string(),
            provider: "copilot".to_string(),
            refresh_token: None,
            access_token: Some("ghu_token".to_string()),
            session_token: Some("ghs_token".to_string()),
            expires_at: Some(chrono::Utc::now().timestamp_millis() + 60_000),
            scope: None,
            email: None,
        };

        assert!(!should_invalidate_copilot_account(
            &token,
            "Copilot token exchange failed (401 Unauthorized): Bad credentials"
        ));
    }

    #[test]
    fn invalidates_oauth_accounts_on_invalid_grant() {
        assert!(should_invalidate_oauth_account(
            "antigravity",
            400,
            "{ \"error\": \"invalid_grant\" }"
        ));
        assert!(should_invalidate_oauth_account(
            "codex",
            401,
            "refresh token is invalid"
        ));
        assert!(!should_invalidate_oauth_account(
            "antigravity",
            500,
            "upstream timeout"
        ));
        assert!(!should_invalidate_oauth_account(
            "nvidia",
            400,
            "{ \"error\": \"invalid_grant\" }"
        ));
    }
}
