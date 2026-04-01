mod auth;
mod db;
mod proxy;
mod quota;
mod security;
mod static_config;
mod token;

use auth::codex::client::CodexClient;
use auth::codex::pkce::generate_pkce_codes;
use auth::codex::server::start_callback_server;
use proxy::server::start_proxy_server;
use rand::{distributions::Alphanumeric, Rng};
use std::env;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::timeout;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let args: Vec<String> = env::args().collect();
    let mode = args.get(1).map(|s| s.as_str()).unwrap_or("--help");

    match mode {
        "--auth" => {
            let auth_arg = args
                .get(2)
                .cloned()
                .unwrap_or_else(|| auth::session::generate_account_id("codex"));
            run_auth_flow(&auth_arg).await?
        }
        "--auth-antigravity" => {
            let auth_arg = args
                .get(2)
                .cloned()
                .unwrap_or_else(|| auth::session::generate_account_id("antigravity"));
            run_antigravity_auth_flow(&auth_arg).await?
        }
        "--auth-claude" => {
            let auth_arg = args
                .get(2)
                .cloned()
                .unwrap_or_else(|| auth::session::generate_account_id("claude"));
            run_claude_auth_flow(&auth_arg).await?
        }
        "--proxy" => {
            let port_str = args.get(2).map(|s| s.as_str()).unwrap_or("8317");
            let port: u16 = port_str.parse().unwrap_or(8317);

            if let Err(error) = db::migrate_legacy_browser_oauth_accounts().await {
                eprintln!(
                    "[WARN] Failed to migrate legacy browser OAuth accounts: {}",
                    error
                );
            }

            tokio::spawn(async {
                token::background_refresh_loop().await;
            });

            eprintln!("[LOG] Proxy daemon mode activated.");
            start_proxy_server(port).await?;
        }
        "--set-key" => {
            let provider = args.get(2).map(|s| s.as_str()).unwrap_or("");
            let api_key = args.get(3).map(|s| s.as_str()).unwrap_or("");
            let account_id = args.get(4).map(|s| s.as_str()).unwrap_or("default");
            run_set_key(provider, api_key, account_id).await?
        }
        "--list-keys" => {
            let provider = args.get(2).map(|s| s.as_str());
            run_list_keys(provider).await?
        }
        "--delete-key" => {
            let provider = args.get(2).map(|s| s.as_str()).unwrap_or("");
            let account_id = args.get(3).map(|s| s.as_str()).unwrap_or("default");
            run_delete_key(provider, account_id).await?
        }
        _ => {
            eprintln!("\nKullanım:");
            eprintln!("  tengra-proxy --auth <account_id>             # Codex Auth");
            eprintln!("  tengra-proxy --auth-antigravity <account_id> # Antigravity Auth");
            eprintln!("  tengra-proxy --auth-claude <account_id>      # Claude Auth");
            eprintln!("  tengra-proxy --set-key <provider> <api_key> [account_id]  # Set API Key");
            eprintln!("  tengra-proxy --list-keys [provider]           # List API Keys");
            eprintln!(
                "  tengra-proxy --delete-key <provider> [account_id]         # Delete API Key"
            );
            eprintln!("  tengra-proxy --proxy                         # Proxy Mode\n");
        }
    }

    Ok(())
}

async fn run_auth_flow(account_id: &str) -> anyhow::Result<()> {
    eprintln!("[LOG] --- Tengra Codex Auth Bridge ---");

    // 1. PKCE üret
    let pkce = generate_pkce_codes();

    // 2. Client oluştur
    let client = CodexClient::new().await;
    let state = generate_oauth_state();
    let auth_url = client.generate_auth_url(&state, &pkce);

    eprintln!("[LOG] Giriş URL'si oluşturuldu.");

    // 3. Tarayıcıyı aç
    eprintln!("[LOG] Tarayıcı açılıyor...");
    if let Err(e) = open::that(&auth_url) {
        eprintln!("[WARN] Tarayıcı otomatik açılamadı: {}", e);
        eprintln!("\nLütfen manuel açın: {}\n", auth_url);
    }

    // 4. Callback beklemek için kanal oluştur
    let (tx, mut rx) = mpsc::channel(1);

    // 5. Callback sunucusunu bir task olarak başlat
    eprintln!("[LOG] Lokal callback sunucusu başlatılıyor (Port: 1455)...");
    let _server_task = tokio::spawn(async move {
        if let Err(e) = start_callback_server(1455, tx).await {
            eprintln!("[ERROR] Sunucu hatası: {}", e);
        }
    });

    // 6. 20 saniye bekle
    eprintln!("[LOG] Kullanıcının auth olması bekleniyor (Süre: 20 saniye)...");

    let wait_result = timeout(Duration::from_secs(20), rx.recv()).await;

    match wait_result {
        Ok(Some(params)) => {
            if params.state != state {
                eprintln!("[ERROR] OAuth state mismatch.");
                std::process::exit(1);
            }

            eprintln!("[LOG] Onay kodu alındı. Token değişimi yapılıyor...");

            // 7. Token Exchange
            match client
                .exchange_code(&params.code, &pkce.code_verifier)
                .await
            {
                Ok(token_resp) => {
                    eprintln!("[SUCCESS] Giriş Başarılı!");

                    let token_json = serde_json::to_value(&token_resp)?;

                    // DB Save
                    if let Err(e) = db::save_token(token_json, account_id, "codex").await {
                        eprintln!("[ERROR] DB Kaydetme hatası: {}", e);
                    } else {
                        eprintln!("[LOG] Token başarıyla persist edildi.");
                    }

                    // stdout output for backward compatibility if needed
                    println!("{}", serde_json::to_string(&token_resp)?);

                    // 8. Quota Check
                    eprintln!("[LOG] Kota bilgileri sorgulanıyor...");
                    match quota::check_quota("codex", &token_resp.access_token).await {
                        Ok(quota_res) => {
                            if let Some(quota) = &quota_res.quota {
                                eprintln!(
                                    "[SUCCESS] Codex Kota: {} / {} ",
                                    quota.remaining, quota.total
                                );

                                // Save quota to DB
                                let quota_value = serde_json::to_value(&quota_res)?;
                                if let Err(e) =
                                    db::update_quota(account_id, "codex", quota_value).await
                                {
                                    eprintln!("[ERROR] Codex kota DB güncelleme hatası: {}", e);
                                } else {
                                    eprintln!("[LOG] Codex kota bilgileri DB'de güncellendi.");
                                }
                            }
                        }
                        Err(e) => eprintln!("[WARN] Codex kota sorgulama başarısız: {}", e),
                    }
                }
                Err(e) => {
                    eprintln!("[ERROR] Token değişimi başarısız: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Ok(None) => {
            eprintln!("[ERROR] Kanal kapandı.");
            std::process::exit(1);
        }
        Err(_) => {
            eprintln!("[TIMEOUT] 20 saniye doldu. Kullanıcı giriş yapmadı veya süre yetmedi.");
            std::process::exit(1);
        }
    }

    Ok(())
}

async fn run_antigravity_auth_flow(account_id: &str) -> anyhow::Result<()> {
    eprintln!("[LOG] --- Tengra Antigravity Auth Bridge ---");

    // 1. Client oluştur
    let client = auth::antigravity::client::AntigravityClient::new().await;
    let state = generate_oauth_state();
    let auth_url = client.generate_auth_url(&state);

    eprintln!("[LOG] Antigravity Giriş URL'si oluşturuldu.");

    // 2. Tarayıcıyı aç
    if let Err(e) = open::that(&auth_url) {
        eprintln!("[WARN] Tarayıcı açılamadı: {}", e);
        eprintln!("\nLütfen manuel açın: {}\n", auth_url);
    }

    // 3. Callback kanalı
    let (tx, mut rx) = mpsc::channel(1);

    // 4. Server başlat (Port 51121)
    eprintln!("[LOG] Antigravity callback sunucusu başlatılıyor (Port: 51121)...");
    let _server_task = tokio::spawn(async move {
        if let Err(e) = auth::antigravity::server::start_callback_server(51121, tx).await {
            eprintln!("[ERROR] Antigravity sunucu hatası: {}", e);
        }
    });

    // 5. Bekle (5 dakika)
    eprintln!("[LOG] Google Giriş bekleniyor...");
    let wait_result = timeout(Duration::from_secs(300), rx.recv()).await;

    match wait_result {
        Ok(Some(params)) => {
            if params.state != state {
                eprintln!("[ERROR] Antigravity OAuth state mismatch.");
                std::process::exit(1);
            }

            eprintln!("[LOG] Onay kodu alındı. Token değişimi yapılıyor...");

            match client.exchange_code(&params.code).await {
                Ok(token_resp) => {
                    eprintln!("[SUCCESS] Antigravity Giriş Başarılı!");

                    let email = client
                        .get_user_email(&token_resp.access_token)
                        .await
                        .unwrap_or_default();
                    let storage = serde_json::json!({
                        "token": token_resp,
                        "email": email,
                        "project_id": "auto",
                        "type": "antigravity"
                    });

                    // DB Save
                    if let Err(e) = db::save_token(storage.clone(), account_id, "antigravity").await
                    {
                        eprintln!("[ERROR] DB Kaydetme hatası: {}", e);
                    } else {
                        eprintln!("[LOG] Antigravity token başarıyla persist edildi.");
                    }

                    // 6. Quota Check
                    eprintln!("[LOG] Kota bilgileri sorgulanıyor...");
                    match quota::check_quota("antigravity", &token_resp.access_token).await {
                        Ok(quota_resp) => {
                            if let Some(quota) = &quota_resp.quota {
                                eprintln!(
                                    "[SUCCESS] Kota: {} / {} (Reset: {:?})",
                                    quota.remaining, quota.total, quota.reset_at
                                );

                                // Save quota to DB
                                let quota_value = serde_json::to_value(&quota_resp)?;
                                if let Err(e) =
                                    db::update_quota(account_id, "antigravity", quota_value).await
                                {
                                    eprintln!("[ERROR] Kota DB güncelleme hatası: {}", e);
                                } else {
                                    eprintln!("[LOG] Kota bilgileri DB'de güncellendi.");
                                }
                            }
                        }
                        Err(e) => eprintln!("[WARN] Kota sorgulama başarısız: {}", e),
                    }
                }
                Err(e) => eprintln!("[ERROR] Antigravity Exchange hatası: {}", e),
            }
        }
        _ => eprintln!("[ERROR] Antigravity Auth zaman aşımı veya hata."),
    }

    Ok(())
}
async fn run_claude_auth_flow(account_id: &str) -> anyhow::Result<()> {
    eprintln!("[LOG] --- Tengra Claude Auth Bridge ---");

    // 1. PKCE üret
    let pkce = generate_pkce_codes();

    // 2. Client oluştur
    let client = auth::claude::client::ClaudeClient::new().await;
    let state = generate_oauth_state();
    let auth_url = client.generate_auth_url(&state, &pkce);

    eprintln!("[LOG] Claude Giriş URL'si oluşturuldu.");

    // 3. Tarayıcıyı aç
    if let Err(e) = open::that(&auth_url) {
        eprintln!("[WARN] Tarayıcı açılamadı: {}", e);
        eprintln!("\nLütfen manuel açın: {}\n", auth_url);
    }

    // 4. Callback kanalı
    let (tx, mut rx) = mpsc::channel(1);

    // 5. Server başlat (Port 54545)
    eprintln!("[LOG] Claude callback sunucusu başlatılıyor (Port: 54545)...");
    let _server_task = tokio::spawn(async move {
        if let Err(e) = auth::claude::server::start_callback_server(54545, tx).await {
            eprintln!("[ERROR] Claude sunucu hatası: {}", e);
        }
    });

    // 6. Bekle (5 dakika)
    eprintln!("[LOG] Claude Giriş bekleniyor...");
    let wait_result = timeout(Duration::from_secs(300), rx.recv()).await;

    match wait_result {
        Ok(Some(params)) => {
            if params.state != state {
                eprintln!("[ERROR] Claude OAuth state mismatch.");
                std::process::exit(1);
            }

            eprintln!("[LOG] Onay kodu alındı. Token değişimi yapılıyor...");

            match client
                .exchange_code(&params.code, &pkce.code_verifier)
                .await
            {
                Ok(token_resp) => {
                    eprintln!("[SUCCESS] Claude Giriş Başarılı!");

                    let storage = serde_json::to_value(&token_resp)?;

                    // DB Save
                    if let Err(e) = db::save_token(storage, account_id, "claude").await {
                        eprintln!("[ERROR] DB Kaydetme hatası: {}", e);
                    } else {
                        eprintln!("[LOG] Claude token başarıyla persist edildi.");
                    }
                }
                Err(e) => eprintln!("[ERROR] Claude Exchange hatası: {}", e),
            }
        }
        _ => eprintln!("[ERROR] Claude Auth zaman aşımı veya hata."),
    }

    Ok(())
}

const VALID_API_KEY_PROVIDERS: &[&str] = &[
    "openai",       // OpenAI API (sk-...)
    "claude",       // Anthropic Claude API
    "gemini",       // Google Gemini API
    "mistral",      // Mistral AI
    "groq",         // Groq (fast inference)
    "together",     // Together AI
    "perplexity",   // Perplexity AI
    "cohere",       // Cohere
    "xai",          // xAI (Grok)
    "openrouter",   // OpenRouter (multi-model gateway)
    "deepseek",     // DeepSeek
    "nvidia",       // NVIDIA NIM
    "codex",        // Legacy codex alias
];

async fn run_set_key(provider: &str, api_key: &str, account_id: &str) -> anyhow::Result<()> {
    if provider.is_empty() || api_key.is_empty() {
        eprintln!("[ERROR] Kullanım: --set-key <provider> <api_key> [account_id]");
        eprintln!(
            "  Desteklenen providerlar: {}",
            VALID_API_KEY_PROVIDERS.join(", ")
        );
        std::process::exit(1);
    }

    if !VALID_API_KEY_PROVIDERS.contains(&provider) {
        eprintln!(
            "[ERROR] Desteklenmeyen provider: '{}'. Geçerli providerlar: {}",
            provider,
            VALID_API_KEY_PROVIDERS.join(", ")
        );
        std::process::exit(1);
    }

    eprintln!(
        "[LOG] API Key kaydediliyor: provider={}, account={}",
        provider, account_id
    );

    match db::save_api_key(provider, api_key, account_id).await {
        Ok(()) => {
            eprintln!(
                "[SUCCESS] API key başarıyla kaydedildi: {} ({})",
                provider, account_id
            );
            println!(
                "{{\"success\":true,\"provider\":\"{}\",\"account_id\":\"{}\"}}",
                provider, account_id
            );
        }
        Err(e) => {
            eprintln!("[ERROR] API key kaydedilemedi: {}", e);
            std::process::exit(1);
        }
    }

    Ok(())
}

async fn run_list_keys(provider: Option<&str>) -> anyhow::Result<()> {
    let providers_to_check: Vec<&str> = if let Some(p) = provider {
        vec![p]
    } else {
        VALID_API_KEY_PROVIDERS.to_vec()
    };

    let mut all_keys: Vec<serde_json::Value> = Vec::new();

    for prov in &providers_to_check {
        match db::get_api_keys(prov).await {
            Ok(keys) => {
                for key_row in keys {
                    all_keys.push(key_row);
                }
            }
            Err(e) => {
                eprintln!("[WARN] {} için key listesi alınamadı: {}", prov, e);
            }
        }
    }

    if all_keys.is_empty() {
        eprintln!("[INFO] Kayıtlı API key bulunamadı.");
    } else {
        eprintln!("[INFO] {} adet API key bulundu.", all_keys.len());
    }

    println!("{}", serde_json::to_string_pretty(&all_keys)?);
    Ok(())
}

async fn run_delete_key(provider: &str, account_id: &str) -> anyhow::Result<()> {
    if provider.is_empty() {
        eprintln!("[ERROR] Kullanım: --delete-key <provider> [account_id]");
        std::process::exit(1);
    }

    eprintln!(
        "[LOG] API Key siliniyor: provider={}, account={}",
        provider, account_id
    );

    match db::delete_api_key(provider, account_id).await {
        Ok(()) => {
            eprintln!("[SUCCESS] API key silindi: {} ({})", provider, account_id);
            println!(
                "{{\"success\":true,\"deleted\":\"{}/{}\"}}",
                provider, account_id
            );
        }
        Err(e) => {
            eprintln!("[ERROR] API key silinemedi: {}", e);
            std::process::exit(1);
        }
    }

    Ok(())
}

fn generate_oauth_state() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect()
}
