/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{thread_rng, RngCore};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone)]
pub struct PKCECodes {
    pub code_verifier: String,
    pub code_challenge: String,
}

pub fn generate_pkce_codes() -> PKCECodes {
    // 1. Code Verifier üretimi (96 rastgele byte -> ~128 karakter base64)
    let mut bytes = [0u8; 96];
    thread_rng().fill_bytes(&mut bytes);
    let code_verifier = URL_SAFE_NO_PAD.encode(bytes);

    // 2. Code Challenge üretimi (S256 hashing)
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let hash = hasher.finalize();
    let code_challenge = URL_SAFE_NO_PAD.encode(hash);

    PKCECodes {
        code_verifier,
        code_challenge,
    }
}

pub fn generate_challenge(code_verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}
