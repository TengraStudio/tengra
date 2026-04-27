/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::{anyhow, Result};
use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;

const AES_GCM_NONCE_LENGTH: usize = 12;
const AES_GCM_TAG_LENGTH: usize = 16;

static MASTER_KEY_CACHE: OnceLock<std::result::Result<Vec<u8>, String>> = OnceLock::new();

pub fn get_security_key_path() -> Option<PathBuf> {
    let app_data = std::env::var("APPDATA").ok()?;
    let roots = ["Tengra", "tengra"];
    let relative_paths = [
        PathBuf::from("data").join("config").join("security.key"),
        PathBuf::from("config").join("security.key"),
    ];

    for root in roots {
        for relative_path in &relative_paths {
            let candidate = PathBuf::from(&app_data).join(root).join(relative_path);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    None
}

/// Decrypts a master key from security.key using Windows DPAPI.
pub fn load_master_key() -> Result<Vec<u8>> {
    let cached = MASTER_KEY_CACHE.get_or_init(load_master_key_uncached);
    cached.clone().map_err(|message| anyhow!(message))
}

fn load_master_key_uncached() -> std::result::Result<Vec<u8>, String> {
    if let Ok(env_key) = std::env::var("TENGRA_MASTER_KEY_HEX") {
        let trimmed = env_key.trim();
        if !trimmed.is_empty() {
            let key_bytes = hex::decode(trimmed).map_err(|error| error.to_string())?;
            if key_bytes.len() != 32 {
                return Err(format!(
                    "Invalid env master key length: expected 32 bytes, got {}",
                    key_bytes.len()
                ));
            }
            return Ok(key_bytes);
        }
    }

    let key_path =
        get_security_key_path().ok_or_else(|| "security.key file not found".to_string())?;

    let content = fs::read_to_string(key_path)
        .map_err(|error| error.to_string())?
        .trim()
        .to_string();

    if !content.starts_with("v2:") {
        return Err("Unsupported security key format (expected v2:)".to_string());
    }

    let encrypted_bytes = general_purpose::STANDARD
        .decode(&content[3..])
        .map_err(|error| error.to_string())?;

    #[cfg(target_os = "windows")]
    {
        use std::ptr;
        use winapi::um::dpapi::CryptUnprotectData;
        use winapi::um::wincrypt::DATA_BLOB;

        let mut input = DATA_BLOB {
            cbData: encrypted_bytes.len() as u32,
            pbData: encrypted_bytes.as_ptr() as *mut _,
        };
        let mut output = DATA_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };

        let success = unsafe {
            CryptUnprotectData(
                &mut input as *mut _,
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
                0,
                &mut output as *mut _,
            )
        };

        if success == 0 {
            return Err("DPAPI CryptUnprotectData failed".to_string());
        }

        let decrypted_bytes =
            unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };

        // Free the memory allocated by Windows
        unsafe {
            winapi::um::winbase::LocalFree(output.pbData as *mut _);
        }

        // The decrypted result is a hex string of the 32-byte key
        let hex_str = String::from_utf8(decrypted_bytes).map_err(|error| error.to_string())?;
        let key_bytes = hex::decode(hex_str.trim()).map_err(|error| error.to_string())?;

        if key_bytes.len() != 32 {
            return Err(format!(
                "Invalid master key length: expected 32 bytes, got {}",
                key_bytes.len()
            ));
        }

        Ok(key_bytes)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("DPAPI decryption is only supported on Windows".to_string())
    }
}

/// Decrypts a token encrypted with Tengra:v1 format.
/// Format: Tengra:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
pub fn decrypt_token(encrypted_text: &str, master_key: &[u8]) -> Result<String> {
    if !encrypted_text.starts_with("Tengra:v1:") {
        return Ok(encrypted_text.to_string());
    }

    let parts: Vec<&str> = encrypted_text.split(':').collect();
    if parts.len() < 5 {
        return Err(anyhow!("Invalid Tengra:v1 token format"));
    }

    let iv_bytes = general_purpose::STANDARD.decode(parts[2])?;
    let tag_bytes = general_purpose::STANDARD.decode(parts[3])?;
    let ciphertext_bytes = general_purpose::STANDARD.decode(parts[4])?;

    if iv_bytes.len() != AES_GCM_NONCE_LENGTH {
        return Err(anyhow!(
            "Invalid IV length: expected {}, got {}",
            AES_GCM_NONCE_LENGTH,
            iv_bytes.len()
        ));
    }

    if tag_bytes.len() != AES_GCM_TAG_LENGTH {
        return Err(anyhow!(
            "Invalid tag length: expected {}, got {}",
            AES_GCM_TAG_LENGTH,
            tag_bytes.len()
        ));
    }

    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(master_key);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(&iv_bytes);

    // Combine ciphertext and tag for aes-gcm crate 0.10
    let mut payload = ciphertext_bytes;
    payload.extend_from_slice(&tag_bytes);

    let decrypted_bytes = cipher
        .decrypt(nonce, payload.as_ref())
        .map_err(|e| anyhow!("AES-GCM decryption failed: {}", e))?;

    Ok(String::from_utf8(decrypted_bytes)?)
}
/// Encrypts a string using Tengra:v1 format.
/// Format: Tengra:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
pub fn encrypt_token(plain_text: &str, master_key: &[u8]) -> Result<String> {
    use rand::{thread_rng, RngCore};

    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(master_key);
    let cipher = Aes256Gcm::new(key);

    let mut iv = [0u8; 12];
    thread_rng().fill_bytes(&mut iv);
    let nonce = Nonce::from_slice(&iv);

    let ciphertext_and_tag = cipher
        .encrypt(nonce, plain_text.as_bytes())
        .map_err(|e| anyhow!("AES-GCM encryption failed: {}", e))?;

    // Split ciphertext and tag (tag is last 16 bytes)
    if ciphertext_and_tag.len() < 16 {
        return Err(anyhow!("Invalid ciphertext length from aes-gcm"));
    }

    let (ciphertext, tag) = ciphertext_and_tag.split_at(ciphertext_and_tag.len() - 16);

    let iv_b64 = general_purpose::STANDARD.encode(iv);
    let tag_b64 = general_purpose::STANDARD.encode(tag);
    let ciphertext_b64 = general_purpose::STANDARD.encode(ciphertext);

    Ok(format!(
        "Tengra:v1:{}:{}:{}",
        iv_b64, tag_b64, ciphertext_b64
    ))
}
