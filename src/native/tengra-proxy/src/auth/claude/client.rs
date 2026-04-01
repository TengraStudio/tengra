use crate::auth::claude::types::ClaudeTokenResponse;
use crate::auth::codex::pkce::PKCECodes; // PKCE logic is same
use crate::static_config;
use reqwest::Client;
use url::Url;

pub struct ClaudeClient {
    client: Client,
    client_id: String,
}

impl ClaudeClient {
    pub async fn new() -> Self {
        Self {
            client: Client::new(),
            client_id: static_config::ANTHROPIC_OAUTH_CLIENT_ID.to_string(),
        }
    }

    pub fn generate_auth_url(&self, state: &str, pkce: &PKCECodes) -> String {
        let Ok(mut url) = Url::parse("https://claude.ai/oauth/authorize") else {
            return "https://claude.ai/oauth/authorize".to_string();
        };
        url.query_pairs_mut()
            .append_pair("client_id", &self.client_id)
            .append_pair("response_type", "code")
            .append_pair("redirect_uri", "http://localhost:54545/callback")
            .append_pair("scope", "org:create_api_key user:profile user:inference")
            .append_pair("state", state)
            .append_pair("code_challenge", &pkce.code_challenge)
            .append_pair("code_challenge_method", "S256");

        url.to_string()
    }

    pub async fn exchange_code(
        &self,
        code: &str,
        verifier: &str,
    ) -> anyhow::Result<ClaudeTokenResponse> {
        let params = [
            ("grant_type", "authorization_code"),
            ("client_id", &self.client_id),
            ("code", code),
            ("redirect_uri", "http://localhost:54545/callback"),
            ("code_verifier", verifier),
        ];

        let resp = self
            .client
            .post("https://console.anthropic.com/v1/oauth/token")
            .form(&params)
            .send()
            .await?;

        if !resp.status().is_success() {
            let error_text = resp.text().await?;
            return Err(anyhow::anyhow!(
                "Claude token exchange failed: {}",
                error_text
            ));
        }

        let token_resp: ClaudeTokenResponse = resp.json().await?;
        Ok(token_resp)
    }
}
