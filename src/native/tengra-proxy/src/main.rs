/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
mod analysis;
mod auth;
mod db;
mod proxy;
mod quota;
mod security;
mod static_config;
mod terminal;
mod token;
mod tools;

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

    // Initialize tracing
    let use_json = std::env::var("TENGRA_PROXY_JSON_LOGS").is_ok();
    if use_json {
        tracing_subscriber::fmt()
            .json()
            .with_writer(std::io::stdout)
            .init();
    } else {
        tracing_subscriber::fmt()
            .with_writer(std::io::stdout)
            .init();
    }

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
                tracing::warn!("Failed to migrate legacy browser OAuth accounts: {}", error);
            }
            match db::normalize_legacy_openai_linked_account_metadata().await {
                Ok(updated) => {
                    if updated > 0 {
                        tracing::info!(
                            "Normalized {} legacy OpenAI linked-account metadata records.",
                            updated
                        );
                    }
                }
                Err(error) => {
                    tracing::warn!(
                        "Failed to normalize legacy OpenAI linked-account metadata: {}",
                        error
                    );
                }
            }
            if let Err(error) = proxy::skills::ensure_skill_tables().await {
                tracing::warn!("Failed to initialize proxy skills tables: {}", error);
            }

            tokio::spawn(async {
                token::background_refresh_loop().await;
            });

            tracing::info!("Proxy daemon mode activated.");
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
            tracing::info!("\nKullanım:");
            tracing::info!("  tengra-proxy --auth <account_id>             # Codex Auth");
            tracing::info!("  tengra-proxy --auth-antigravity <account_id> # Antigravity Auth");
            tracing::info!("  tengra-proxy --auth-claude <account_id>      # Claude Auth");
            tracing::info!(
                "  tengra-proxy --set-key <provider> <api_key> [account_id]  # Set API Key"
            );
            tracing::info!("  tengra-proxy --list-keys [provider]           # List API Keys");
            tracing::info!(
                "  tengra-proxy --delete-key <provider> [account_id]         # Delete API Key"
            );
            tracing::info!("  tengra-proxy --proxy                         # Proxy Mode\n");
        }
    }

    Ok(())
}

async fn run_auth_flow(account_id: &str) -> anyhow::Result<()> {
    tracing::info!("--- Tengra Codex Auth Bridge ---");

    // 1. PKCE üret
    let pkce = generate_pkce_codes();

    // 2. Client oluştur
    let client = CodexClient::new().await?;
    let state = generate_oauth_state();
    let auth_url = client.generate_auth_url(&state, &pkce);

    tracing::info!("Giriş URL'si oluşturuldu.");

    // 3. Tarayıcıyı aç
    tracing::info!("Tarayıcı açılıyor...");
    if let Err(e) = open::that(&auth_url) {
        tracing::warn!("Tarayıcı otomatik açılamadı: {}", e);
        tracing::warn!("\nLütfen manuel açın: {}\n", auth_url);
    }

    // 4. Callback beklemek için kanal oluştur
    let (tx, mut rx) = mpsc::channel(1);

    // 5. Callback sunucusunu bir task olarak başlat
    tracing::info!("Lokal callback sunucusu başlatılıyor (Port: 1455)...");
    let _server_task = tokio::spawn(async move {
        if let Err(e) = start_callback_server(1455, tx).await {
            tracing::error!("Sunucu hatası: {}", e);
        }
    });

    // 6. 20 saniye bekle
    tracing::info!("Kullanıcının auth olması bekleniyor (Süre: 20 saniye)...");

    let wait_result = timeout(Duration::from_secs(20), rx.recv()).await;

    match wait_result {
        Ok(Some(params)) => {
            if params.state != state {
                tracing::error!("OAuth state mismatch.");
                std::process::exit(1);
            }

            tracing::info!("Onay kodu alındı. Token değişimi yapılıyor...");

            // 7. Token Exchange
            match client
                .exchange_code(&params.code, &pkce.code_verifier)
                .await
            {
                Ok(token_resp) => {
                    tracing::info!("Giriş Başarılı!");

                    let token_json = serde_json::to_value(&token_resp)?;

                    // DB Save
                    if let Err(e) = db::save_token(token_json, account_id, "codex").await {
                        tracing::error!("DB Kaydetme hatası: {}", e);
                    } else {
                        tracing::info!("Token başarıyla persist edildi.");
                    }

                    // stdout output for backward compatibility if needed
                    println!("{}", serde_json::to_string(&token_resp)?);

                    // 8. Quota Check
                    tracing::info!("Kota bilgileri sorgulanıyor...");
                    match quota::check_quota("codex", &token_resp.access_token).await {
                        Ok(quota_res) => {
                            if let Some(quota) = &quota_res.quota {
                                tracing::info!(
                                    "Codex Kota: {} / {} ",
                                    quota.remaining,
                                    quota.total
                                );

                                // Save quota to DB
                                let quota_value = serde_json::to_value(&quota_res)?;
                                if let Err(e) =
                                    db::update_quota(account_id, "codex", quota_value).await
                                {
                                    tracing::error!("Codex kota DB güncelleme hatası: {}", e);
                                } else {
                                    tracing::info!("Codex kota bilgileri DB'de güncellendi.");
                                }
                            }
                        }
                        Err(e) => tracing::warn!("Codex kota sorgulama başarısız: {}", e),
                    }
                }
                Err(e) => {
                    tracing::error!("Token değişimi başarısız: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Ok(None) => {
            tracing::error!("Kanal kapandı.");
            std::process::exit(1);
        }
        Err(_) => {
            tracing::error!("20 saniye doldu. Kullanıcı giriş yapmadı veya süre yetmedi.");
            std::process::exit(1);
        }
    }

    Ok(())
}

async fn run_antigravity_auth_flow(account_id: &str) -> anyhow::Result<()> {
    tracing::info!("--- Tengra Antigravity Auth Bridge ---");

    // 1. Client oluştur
    let client = auth::antigravity::client::AntigravityClient::new(None).await?;
    let state = generate_oauth_state();
    let auth_url = client.generate_auth_url(&state);

    tracing::info!("Antigravity Giriş URL'si oluşturuldu.");

    // 2. Tarayıcıyı aç
    if let Err(e) = open::that(&auth_url) {
        tracing::warn!("Tarayıcı açılamadı: {}", e);
        tracing::warn!("\nLütfen manuel açın: {}\n", auth_url);
    }

    // 3. Callback kanalı
    let (tx, mut rx) = mpsc::channel(1);

    // 4. Server başlat (Port 51121)
    tracing::info!("Antigravity callback sunucusu başlatılıyor (Port: 51121)...");
    let _server_task = tokio::spawn(async move {
        if let Err(e) = auth::antigravity::server::start_callback_server(51121, tx).await {
            tracing::error!("Antigravity sunucu hatası: {}", e);
        }
    });

    // 5. Bekle (5 dakika)
    tracing::info!("Google Giriş bekleniyor...");
    let wait_result = timeout(Duration::from_secs(300), rx.recv()).await;

    match wait_result {
        Ok(Some(params)) => {
            if params.state != state {
                tracing::error!("Antigravity OAuth state mismatch.");
                std::process::exit(1);
            }

            tracing::info!("Onay kodu alındı. Token değişimi yapılıyor...");

            match client.exchange_code(&params.code).await {
                Ok(token_resp) => {
                    tracing::info!("Antigravity Giriş Başarılı!");

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
                        tracing::error!("DB Kaydetme hatası: {}", e);
                    } else {
                        tracing::info!("Antigravity token başarıyla persist edildi.");
                    }

                    // 6. Quota Check
                    tracing::info!("Kota bilgileri sorgulanıyor...");
                    match quota::check_quota("antigravity", &token_resp.access_token).await {
                        Ok(quota_resp) => {
                            if let Some(quota) = &quota_resp.quota {
                                tracing::info!(
                                    "Kota: {} / {} (Reset: {:?})",
                                    quota.remaining,
                                    quota.total,
                                    quota.reset_at
                                );

                                // Save quota to DB
                                let quota_value = serde_json::to_value(&quota_resp)?;
                                if let Err(e) =
                                    db::update_quota(account_id, "antigravity", quota_value).await
                                {
                                    tracing::error!("Kota DB güncelleme hatası: {}", e);
                                } else {
                                    tracing::info!("Kota bilgileri DB'de güncellendi.");
                                }
                            }
                        }
                        Err(e) => tracing::warn!("Kota sorgulama başarısız: {}", e),
                    }
                }
                Err(e) => tracing::error!("Antigravity Exchange hatası: {}", e),
            }
        }
        _ => tracing::error!("Antigravity Auth zaman aşımı veya hata."),
    }

    Ok(())
}
async fn run_claude_auth_flow(account_id: &str) -> anyhow::Result<()> {
    tracing::info!("--- Tengra Claude Auth Bridge ---");

    // 1. PKCE üret
    let pkce = generate_pkce_codes();

    // 2. Client oluştur
    let client = auth::claude::client::ClaudeClient::new().await?;
    let state = generate_oauth_state();
    let auth_url = client.generate_auth_url(&state, &pkce);

    tracing::info!("Claude Giriş URL'si oluşturuldu.");

    // 3. Tarayıcıyı aç
    if let Err(e) = open::that(&auth_url) {
        tracing::warn!("Tarayıcı açılamadı: {}", e);
        tracing::warn!("\nLütfen manuel açın: {}\n", auth_url);
    }

    // 4. Callback kanalı
    let (tx, mut rx) = mpsc::channel(1);

    // 5. Server başlat (Port 54545)
    tracing::info!("Claude callback sunucusu başlatılıyor (Port: 54545)...");
    let _server_task = tokio::spawn(async move {
        if let Err(e) = auth::claude::server::start_callback_server(54545, tx).await {
            tracing::error!("Claude sunucu hatası: {}", e);
        }
    });

    // 6. Bekle (5 dakika)
    tracing::info!("Claude Giriş bekleniyor...");
    let wait_result = timeout(Duration::from_secs(300), rx.recv()).await;

    match wait_result {
        Ok(Some(params)) => {
            if params.state != state {
                tracing::error!("Claude OAuth state mismatch.");
                std::process::exit(1);
            }

            tracing::info!("Onay kodu alındı. Token değişimi yapılıyor...");

            match client
                .exchange_code(&params.code, &pkce.code_verifier)
                .await
            {
                Ok(token_resp) => {
                    tracing::info!("Claude Giriş Başarılı!");

                    let storage = serde_json::to_value(&token_resp)?;

                    // DB Save
                    if let Err(e) = db::save_token(storage, account_id, "claude").await {
                        tracing::error!("DB Kaydetme hatası: {}", e);
                    } else {
                        tracing::info!("Claude token başarıyla persist edildi.");
                    }
                }
                Err(e) => tracing::error!("Claude Exchange hatası: {}", e),
            }
        }
        _ => tracing::error!("Claude Auth zaman aşımı veya hata."),
    }

    Ok(())
}

const VALID_API_KEY_PROVIDERS: &[&str] = &[
    "openai",     // OpenAI API (sk-...)
    "claude",     // Anthropic Claude API
    "gemini",     // Google Gemini API
    "mistral",    // Mistral AI
    "groq",       // Groq (fast inference)
    "together",   // Together AI
    "perplexity", // Perplexity AI
    "cohere",     // Cohere
    "xai",        // xAI (Grok)
    "openrouter", // OpenRouter (multi-model gateway)
    "deepseek",   // DeepSeek
    "nvidia",     // NVIDIA NIM
    "codex",      // Legacy codex alias
];

async fn run_set_key(provider: &str, api_key: &str, account_id: &str) -> anyhow::Result<()> {
    if provider.is_empty() || api_key.is_empty() {
        tracing::error!("Kullanım: --set-key <provider> <api_key> [account_id]");
        tracing::error!(
            "  Desteklenen providerlar: {}",
            VALID_API_KEY_PROVIDERS.join(", ")
        );
        std::process::exit(1);
    }

    if !VALID_API_KEY_PROVIDERS.contains(&provider) {
        tracing::error!(
            "Desteklenmeyen provider: '{}'. Geçerli providerlar: {}",
            provider,
            VALID_API_KEY_PROVIDERS.join(", ")
        );
        std::process::exit(1);
    }

    tracing::info!(
        "API Key kaydediliyor: provider={}, account={}",
        provider,
        account_id
    );

    match db::save_api_key(provider, api_key, account_id).await {
        Ok(()) => {
            tracing::info!(
                "API key başarıyla kaydedildi: {} ({})",
                provider,
                account_id
            );
            println!(
                "{{\"success\":true,\"provider\":\"{}\",\"account_id\":\"{}\"}}",
                provider, account_id
            );
        }
        Err(e) => {
            tracing::error!("API key kaydedilemedi: {}", e);
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
                tracing::warn!("{} için key listesi alınamadı: {}", prov, e);
            }
        }
    }

    if all_keys.is_empty() {
        tracing::info!("Kayıtlı API key bulunamadı.");
    } else {
        tracing::info!("{} adet API key bulundu.", all_keys.len());
    }

    println!("{}", serde_json::to_string_pretty(&all_keys)?);
    Ok(())
}

async fn run_delete_key(provider: &str, account_id: &str) -> anyhow::Result<()> {
    if provider.is_empty() {
        tracing::error!("Kullanım: --delete-key <provider> [account_id]");
        std::process::exit(1);
    }

    tracing::info!(
        "API Key siliniyor: provider={}, account={}",
        provider,
        account_id
    );

    match db::delete_api_key(provider, account_id).await {
        Ok(()) => {
            tracing::info!("API key silindi: {} ({})", provider, account_id);
            println!(
                "{{\"success\":true,\"deleted\":\"{}/{}\"}}",
                provider, account_id
            );
        }
        Err(e) => {
            tracing::error!("API key silinemedi: {}", e);
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
