/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use base64::prelude::BASE64_STANDARD;
use base64::Engine;
use reqwest::RequestBuilder;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::OnceLock;

use crate::proxy::antigravity::DEFAULT_USER_AGENT;

static CURSOR_CLIENT_VERSION: OnceLock<String> = OnceLock::new();

pub fn apply_headers(
    mut builder: RequestBuilder,
    provider: &str,
    auth_token: &str,
    is_stream: bool,
    active_key_row: &serde_json::Value,
    session_id: Option<&str>,
    prior_signature: Option<&str>,
) -> RequestBuilder {
    match provider {
        "claude" => {
            builder = builder
                .header("X-Api-Key", auth_token)
                .header("Anthropic-Version", "2023-06-01")
                .header(
                    "Anthropic-Beta",
                    "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14,ccr-byoc-2025-07-29"
                )
                .header("Anthropic-Dangerous-Direct-Browser-Access", "true")
                .header("User-Agent", "claude-code/0.2.29 (Windows; x64)")
                .header("x-anthropic-billing-header", build_anthropic_billing_header())
                .header("X-App", "claude-code")
                .header("X-Stainless-Runtime", "node")
                .header("X-Stainless-Lang", "js")
                .header("Connection", "keep-alive")
                .header("Accept", "application/json");

            if let Some(sid) = session_id {
                builder = builder.header("X-Claude-Code-Session-Id", sid);
            }
            if let Some(sig) = prior_signature {
                builder = builder.header("X-Anthropic-Prior-Signature", sig);
            }
        }
        "antigravity" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("User-Agent", antigravity_user_agent(active_key_row))
                .header("Connection", "keep-alive")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        "copilot" => {
            let final_token = extract_session_token(auth_token, active_key_row);
            builder = builder
                .header("Authorization", format!("Bearer {}", final_token))
                .header("User-Agent", "gh-copilot/1.0.0")
                .header("Copilot-Integration-Id", "gh-copilot")
                .header("Editor-Version", "gh/2.61.0")
                .header("Editor-Plugin-Version", "gh-copilot/1.0.0")
                .header("Openai-Intent", "conversation-panel")
                .header("X-Request-Id", uuid::Uuid::new_v4().to_string())
                .header("Openai-Organization", "github-copilot")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        "codex" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Version", "0.125.0")
                .header("Openai-Beta", "responses=experimental")
                .header("User-Agent", "codex-cli/0.125.0 (Windows 10; x64)")
                .header("Originator", "codex-cli")
                .header("Accept", "*/*");

            // Extract Chatgpt-Account-Id from metadata
            if let Some(metadata) = active_key_row.get("metadata").and_then(|v| v.as_str()) {
                if let Ok(meta_json) = serde_json::from_str::<Value>(metadata) {
                    if let Some(account_id) = meta_json.get("account_id").and_then(|v| v.as_str()) {
                        builder = builder.header("Chatgpt-Account-Id", account_id);
                    }
                }
            }
        }
        // OpenAI API (sk-... keys)
        "openai" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        // Google Gemini API
        "gemini" => {
            builder = builder
                .header("x-goog-api-key", auth_token)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json");
        }
        // Mistral AI
        "mistral" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        "kimi" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        // Groq
        "groq" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        // xAI (Grok)
        "xai" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        // DeepSeek
        "deepseek" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        // OpenRouter
        "openrouter" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header("HTTP-Referer", "https://tengra.app")
                .header("X-Title", "Tengra")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        // NVIDIA NIM
        "nvidia" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        "opencode" => {
            builder = builder
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .header(
                    "Accept",
                    if is_stream {
                        "text/event-stream"
                    } else {
                        "application/json"
                    },
                );
        }
        "cursor" => {
            let metadata = cursor_metadata(active_key_row);
            let machine_id = metadata
                .get("machineId")
                .and_then(Value::as_str)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .unwrap_or_else(random_cursor_machine_id);
            let mac_machine_id = metadata
                .get("macMachineId")
                .and_then(Value::as_str)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .unwrap_or_else(random_cursor_machine_id);
            let sqm_id = metadata
                .get("sqmId")
                .and_then(Value::as_str)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .unwrap_or_else(random_cursor_sqm_id);
            let dev_device_id = metadata
                .get("devDeviceId")
                .and_then(Value::as_str)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .unwrap_or_else(random_cursor_device_id);

            builder = apply_cursor_headers(
                builder,
                &machine_id,
                &mac_machine_id,
                &sqm_id,
                &dev_device_id,
                auth_token,
            )
            .header("Content-Type", "application/connect+json")
            .header("Connect-Protocol-Version", "1");
        }
        _ => {
            // Default: OpenAI-compatible
            builder = builder.header("Authorization", format!("Bearer {}", auth_token));
        }
    }

    builder
}

fn build_anthropic_billing_header() -> String {
    let version = "0.2.29.tengra";
    let entrypoint = "cli";
    let cch = "00000"; // Placeholder for Bun-style attestation
    format!(
        "cc_version={}; cc_entrypoint={}; cch={};",
        version, entrypoint, cch
    )
}

fn antigravity_user_agent(row: &Value) -> String {
    if let Some(metadata_str) = row.get("metadata").and_then(Value::as_str) {
        if let Ok(meta_json) = serde_json::from_str::<Value>(metadata_str) {
            if let Some(user_agent) = meta_json.get("user_agent").and_then(Value::as_str) {
                let trimmed = user_agent.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            }
        }
    }
    DEFAULT_USER_AGENT.to_string()
}

fn extract_session_token(raw_token: &str, row: &Value) -> String {
    if let Some(metadata_str) = row.get("metadata").and_then(|v| v.as_str()) {
        if let Ok(meta_json) = serde_json::from_str::<Value>(metadata_str) {
            if let Some(session_token) = meta_json.get("session_token").and_then(|v| v.as_str()) {
                return session_token.to_string();
            } else if let Some(token) = meta_json.get("token").and_then(|v| v.as_str()) {
                return token.to_string();
            }
        }
    }
    raw_token.to_string()
}

fn cursor_metadata(row: &Value) -> serde_json::Map<String, Value> {
    if let Some(metadata) = row.get("metadata").and_then(Value::as_object) {
        return metadata.clone();
    }

    row.get("metadata")
        .and_then(Value::as_str)
        .and_then(|text| serde_json::from_str::<Value>(text).ok())
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default()
}

fn generate_cursor_checksum(machine_id: &str, mac_machine_id: Option<&str>) -> String {
    let now = chrono::Utc::now().timestamp_millis();
    let t = now / 1_000_000;

    // Create 48-bit big-endian representation
    let mut bytes = vec![
        ((t >> 40) & 0xFF) as u8,
        ((t >> 32) & 0xFF) as u8,
        ((t >> 24) & 0xFF) as u8,
        ((t >> 16) & 0xFF) as u8,
        ((t >> 8) & 0xFF) as u8,
        (t & 0xFF) as u8,
    ];

    // R6y implementation: n[t] = (n[t] ^ e) + t % 256; e = n[t]
    let mut e: u8 = 165;
    for (t_idx, byte) in bytes.iter_mut().enumerate() {
        *byte = (*byte ^ e).wrapping_add((t_idx % 256) as u8);
        e = *byte;
    }

    let base64_timestamp = BASE64_STANDARD.encode(&bytes);

    match mac_machine_id {
        Some(mac_id) if !mac_id.is_empty() => {
            format!("{}{}/{}", base64_timestamp, machine_id, mac_id)
        }
        _ => format!("{}{}", base64_timestamp, machine_id),
    }
}

pub fn detected_cursor_client_version() -> String {
    CURSOR_CLIENT_VERSION
        .get_or_init(read_local_cursor_client_version)
        .clone()
}

fn read_local_cursor_client_version() -> String {
    let version = cursor_package_json_path()
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|value| {
            value
                .get("version")
                .and_then(Value::as_str)
                .map(str::to_string)
        });

    version.unwrap_or_else(|| "3.3.40".to_string())
}

fn cursor_package_json_path() -> Option<PathBuf> {
    if cfg!(target_os = "windows") {
        let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
        return Some(
            PathBuf::from(local_app_data)
                .join("Programs")
                .join("Cursor")
                .join("resources")
                .join("app")
                .join("package.json"),
        );
    }

    if cfg!(target_os = "macos") {
        return Some(
            PathBuf::from("/Applications")
                .join("Cursor.app")
                .join("Contents")
                .join("Resources")
                .join("app")
                .join("package.json"),
        );
    }

    Some(
        PathBuf::from("/usr/share")
            .join("cursor")
            .join("resources")
            .join("app")
            .join("package.json"),
    )
}

pub fn generate_cursor_install_ids() -> (String, String, String, String) {
    (
        random_cursor_machine_id(),
        random_cursor_machine_id(),
        random_cursor_sqm_id(),
        random_cursor_device_id(),
    )
}

fn random_cursor_machine_id() -> String {
    hex::encode(uuid::Uuid::new_v4().as_bytes()) + &hex::encode(uuid::Uuid::new_v4().as_bytes())
}

fn random_cursor_sqm_id() -> String {
    format!("{{{}}}", uuid::Uuid::new_v4().to_string().to_uppercase())
}

fn random_cursor_device_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn cursor_client_os() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

fn cursor_client_arch() -> &'static str {
    if cfg!(target_arch = "x86_64") {
        "x64"
    } else if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        std::env::consts::ARCH
    }
}

fn cursor_os_version() -> String {
    if cfg!(target_os = "windows") {
        return std::env::var("OS").unwrap_or_else(|_| "Windows_NT".to_string());
    }

    std::env::consts::OS.to_string()
}

fn cursor_timezone_header() -> String {
    if let Ok(tz) = std::env::var("TZ") {
        let trimmed = tz.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    let offset = chrono::Local::now().offset().local_minus_utc();
    let sign = if offset >= 0 { '+' } else { '-' };
    let total_minutes = offset.abs() / 60;
    let hours = total_minutes / 60;
    let minutes = total_minutes % 60;
    format!("UTC{}{:02}:{:02}", sign, hours, minutes)
}

pub fn apply_cursor_headers(
    builder: RequestBuilder,
    machine_id: &str,
    mac_machine_id: &str,
    sqm_id: &str,
    dev_device_id: &str,
    auth_token: &str,
) -> RequestBuilder {
    let cursor_version = detected_cursor_client_version();
    let session_id = uuid::Uuid::new_v4().to_string();
    let request_id = uuid::Uuid::new_v4().to_string();
    let checksum = generate_cursor_checksum(machine_id, Some(mac_machine_id));

    builder
        .header("Authorization", format!("Bearer {}", auth_token))
        .header("x-cursor-checksum", checksum)
        .header("x-cursor-mac-machine-id", mac_machine_id)
        .header("x-cursor-sqm-id", sqm_id)
        .header("x-cursor-dev-device-id", dev_device_id)
        .header("x-client-key", machine_id)
        .header("x-session-id", &session_id)
        .header("x-request-id", &request_id)
        .header("x-amzn-trace-id", format!("Root={}", request_id))
        .header("x-cursor-config-version", &cursor_version)
        .header("x-cursor-client-version", &cursor_version)
        .header("x-cursor-client-type", "ide")
        .header("x-cursor-client-layout", "ide")
        .header("x-cursor-client-os", cursor_client_os())
        .header("x-cursor-client-arch", cursor_client_arch())
        .header("x-cursor-client-os-version", cursor_os_version())
        .header("x-cursor-client-device-type", "desktop")
        .header("x-cursor-timezone", cursor_timezone_header())
        .header("x-new-onboarding-completed", "true")
        .header("x-ghost-mode", "false")
        .header("User-Agent", format!("Cursor/{}", cursor_version))
        .header("Accept", "*/*")
}

#[cfg(test)]
mod tests {
    use super::{
        detected_cursor_client_version, generate_cursor_checksum, generate_cursor_install_ids,
    };
    use regex::Regex;

    #[test]
    fn generated_cursor_ids_match_expected_shapes() {
        let (machine_id, mac_machine_id, sqm_id, dev_device_id) = generate_cursor_install_ids();
        let hex64 = Regex::new(r"^[a-f0-9]{64}$").unwrap();
        let sqm = Regex::new(r"^\{[A-F0-9-]{36}\}$").unwrap();
        let uuid = Regex::new(r"^[a-f0-9-]{36}$").unwrap();

        assert!(hex64.is_match(&machine_id));
        assert!(hex64.is_match(&mac_machine_id));
        assert!(sqm.is_match(&sqm_id));
        assert!(uuid.is_match(&dev_device_id));
    }

    #[test]
    fn cursor_checksum_includes_machine_ids() {
        let checksum = generate_cursor_checksum("machine", Some("mac"));
        assert!(checksum.contains("machine/mac"));
    }

    #[test]
    fn cursor_version_is_not_empty() {
        assert!(!detected_cursor_client_version().is_empty());
    }
}
