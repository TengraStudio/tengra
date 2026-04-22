/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::tools::ToolDispatchResponse;
use serde_json::{json, Value};
use std::path::Path;
use tokio::fs;

pub async fn handle_action(action: &str, args: Value) -> ToolDispatchResponse {
    match action {
        "read" => read_file(args).await,
        "write" => write_file(args).await,
        "list" => list_directory(args).await,
        "extract_strings" => extract_strings(args).await,
        "unzip" => unzip_file(args).await,
        "download" => download_file(args).await,
        _ => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Unknown filesystem action: {}", action)),
        },
    }
}

async fn extract_strings(args: Value) -> ToolDispatchResponse {
    let path = match args.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_response("Missing 'path' argument"),
    };
    let min_length = args.get("minLength").and_then(|v| v.as_u64()).unwrap_or(4) as usize;

    match fs::read(path).await {
        Ok(bytes) => {
            let re = match regex::bytes::Regex::new(&format!(r"[[:print:]]{{{},}}", min_length)) {
                Ok(re) => re,
                Err(e) => return error_response(&format!("Failed to build extraction regex: {}", e)),
            };
            let strings: Vec<String> = re
                .find_iter(&bytes)
                .map(|m| String::from_utf8_lossy(m.as_bytes()).into_owned())
                .collect();

            ToolDispatchResponse {
                success: true,
                result: Some(json!({ "strings": strings })),
                error: None,
            }
        }
        Err(e) => error_response(&format!("Failed to read file for extraction: {}", e)),
    }
}

async fn unzip_file(args: Value) -> ToolDispatchResponse {
    let zip_path = match args.get("zipPath").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_response("Missing 'zipPath' argument"),
    };
    let dest_path = match args.get("destPath").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_response("Missing 'destPath' argument"),
    };

    let file = match std::fs::File::open(zip_path) {
        Ok(f) => f,
        Err(e) => return error_response(&format!("Failed to open zip file: {}", e)),
    };

    let mut archive = match zip::ZipArchive::new(file) {
        Ok(a) => a,
        Err(e) => return error_response(&format!("Failed to parse zip archive: {}", e)),
    };

    for i in 0..archive.len() {
        let mut file = match archive.by_index(i) {
            Ok(file) => file,
            Err(e) => return error_response(&format!("Failed to read zip entry {}: {}", i, e)),
        };
        let outpath = match file.enclosed_name() {
            Some(path) => Path::new(dest_path).join(path),
            None => continue,
        };

        if (*file.name()).ends_with('/') {
            if let Err(e) = std::fs::create_dir_all(&outpath) {
                return error_response(&format!("Failed to create directory from zip: {}", e));
            }
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    if let Err(e) = std::fs::create_dir_all(p) {
                        return error_response(&format!("Failed to create zip parent directory: {}", e));
                    }
                }
            }
            let mut outfile = match std::fs::File::create(&outpath) {
                Ok(outfile) => outfile,
                Err(e) => return error_response(&format!("Failed to create extracted file: {}", e)),
            };
            if let Err(e) = std::io::copy(&mut file, &mut outfile) {
                return error_response(&format!("Failed to write extracted file: {}", e));
            }
        }
    }

    ToolDispatchResponse {
        success: true,
        result: Some(json!({ "success": true })),
        error: None,
    }
}

async fn download_file(args: Value) -> ToolDispatchResponse {
    let url = match args.get("url").and_then(|v| v.as_str()) {
        Some(u) => u,
        None => return error_response("Missing 'url' argument"),
    };
    let dest_path = match args.get("destPath").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_response("Missing 'destPath' argument"),
    };

    match reqwest::get(url).await {
        Ok(response) => {
            if !response.status().is_success() {
                return error_response(&format!(
                    "Download failed with status: {}",
                    response.status()
                ));
            }
            match response.bytes().await {
                Ok(bytes) => {
                    if let Err(e) = fs::write(dest_path, bytes).await {
                        error_response(&format!("Failed to save downloaded file: {}", e))
                    } else {
                        ToolDispatchResponse {
                            success: true,
                            result: Some(json!({ "success": true })),
                            error: None,
                        }
                    }
                }
                Err(e) => error_response(&format!("Failed to read download stream: {}", e)),
            }
        }
        Err(e) => error_response(&format!("Request failed: {}", e)),
    }
}

fn error_response(msg: &str) -> ToolDispatchResponse {
    ToolDispatchResponse {
        success: false,
        result: None,
        error: Some(msg.into()),
    }
}

async fn read_file(args: Value) -> ToolDispatchResponse {
    let path = match args.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => {
            return ToolDispatchResponse {
                success: false,
                result: None,
                error: Some("Missing 'path' argument".into()),
            }
        }
    };

    match fs::read_to_string(path).await {
        Ok(content) => ToolDispatchResponse {
            success: true,
            result: Some(json!({ "content": content })),
            error: None,
        },
        Err(e) => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Failed to read file: {}", e)),
        },
    }
}

async fn write_file(args: Value) -> ToolDispatchResponse {
    let path = match args.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => {
            return ToolDispatchResponse {
                success: false,
                result: None,
                error: Some("Missing 'path' argument".into()),
            }
        }
    };
    let content = match args.get("content").and_then(|v| v.as_str()) {
        Some(c) => c,
        None => {
            return ToolDispatchResponse {
                success: false,
                result: None,
                error: Some("Missing 'content' argument".into()),
            }
        }
    };

    // Ensure parent directory exists
    if let Some(parent) = Path::new(path).parent() {
        if let Err(e) = fs::create_dir_all(parent).await {
            return ToolDispatchResponse {
                success: false,
                result: None,
                error: Some(format!("Failed to create parent directory: {}", e)),
            };
        }
    }

    match fs::write(path, content).await {
        Ok(_) => ToolDispatchResponse {
            success: true,
            result: Some(json!({ "success": true })),
            error: None,
        },
        Err(e) => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Failed to write file: {}", e)),
        },
    }
}

async fn list_directory(args: Value) -> ToolDispatchResponse {
    let path = match args.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => {
            return ToolDispatchResponse {
                success: false,
                result: None,
                error: Some("Missing 'path' argument".into()),
            }
        }
    };

    let mut entries = Vec::new();
    match fs::read_dir(path).await {
        Ok(mut dir) => {
            while let Ok(Some(entry)) = dir.next_entry().await {
                let name = entry.file_name().to_string_lossy().into_owned();
                let is_dir = entry.file_type().await.map(|t| t.is_dir()).unwrap_or(false);
                entries.push(json!({
                    "name": name,
                    "isDirectory": is_dir
                }));
            }
            ToolDispatchResponse {
                success: true,
                result: Some(json!({ "entries": entries })),
                error: None,
            }
        }
        Err(e) => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Failed to list directory: {}", e)),
        },
    }
}
