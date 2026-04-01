use crate::auth::codex::pkce::PKCECodes;
use crate::auth::codex::types::CodexTokenResponse;
use crate::static_config;
use reqwest::Client;
use url::Url;

const OPENAI_AUTH_URL: &str = "https://auth.openai.com/oauth/authorize";
const OPENAI_TOKEN_URL: &str = "https://auth.openai.com/oauth/token";
const REDIRECT_URI: &str = "http://localhost:1455/auth/callback";

pub struct CodexClient {
    client: Client,
    client_id: String,
}

impl CodexClient {
    pub async fn new() -> Self {
        Self {
            client: Client::new(),
            client_id: static_config::OPENAI_OAUTH_CLIENT_ID.to_string(),
        }
    }

    pub fn generate_auth_url(&self, state: &str, pkce: &PKCECodes) -> String {
        let Ok(mut url) = Url::parse(OPENAI_AUTH_URL) else {
            return OPENAI_AUTH_URL.to_string();
        };
        url.query_pairs_mut()
            .append_pair("client_id", &self.client_id)
            .append_pair("response_type", "code")
            .append_pair("redirect_uri", REDIRECT_URI)
            .append_pair(
                "scope",
                "openid profile email offline_access api.connectors.read api.connectors.invoke",
            )
            .append_pair("state", state)
            .append_pair("code_challenge", &pkce.code_challenge)
            .append_pair("code_challenge_method", "S256")
            .append_pair("prompt", "login")
            .append_pair("id_token_add_organizations", "true")
            .append_pair("codex_cli_simplified_flow", "true")
            .append_pair("originator", "Codex");

        url.to_string()
    }

    pub async fn exchange_code(
        &self,
        code: &str,
        verifier: &str,
    ) -> anyhow::Result<CodexTokenResponse> {
        let params = [
            ("grant_type", "authorization_code"),
            ("client_id", &self.client_id),
            ("code", code),
            ("redirect_uri", REDIRECT_URI),
            ("code_verifier", verifier),
        ];

        let resp = self
            .client
            .post(OPENAI_TOKEN_URL)
            .form(&params)
            .send()
            .await?;

        if !resp.status().is_success() {
            let error_text = resp.text().await?;
            return Err(anyhow::anyhow!("Token exchange failed: {}", error_text));
        }

        let token_resp: CodexTokenResponse = resp.json().await?;
        Ok(token_resp)
    }
}
