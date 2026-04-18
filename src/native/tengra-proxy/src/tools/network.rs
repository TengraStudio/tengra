use crate::tools::ToolDispatchResponse;
/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use serde_json::{json, Value};
use std::process::Command;

pub async fn handle_action(action: &str, args: Value) -> ToolDispatchResponse {
    match action {
        "interfaces" => interfaces().await,
        "ports" => ports().await,
        "ping" => ping(args).await,
        "traceroute" => traceroute(args).await,
        "whois" => whois(args).await,
        _ => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Unknown network action: {}", action)),
        },
    }
}

async fn interfaces() -> ToolDispatchResponse {
    // Basic implementation using ipconfig/ifconfig detection
    let output = if cfg!(windows) {
        Command::new("ipconfig").output()
    } else {
        Command::new("ifconfig").output()
    };

    match output {
        Ok(out) => ToolDispatchResponse {
            success: true,
            result: Some(json!({ "output": String::from_utf8_lossy(&out.stdout) })),
            error: None,
        },
        Err(e) => error_response(&format!("Failed to get interfaces: {}", e)),
    }
}

async fn ports() -> ToolDispatchResponse {
    let output = if cfg!(windows) {
        Command::new("netstat").arg("-an").output()
    } else {
        Command::new("netstat").arg("-tuln").output()
    };

    match output {
        Ok(out) => ToolDispatchResponse {
            success: true,
            result: Some(json!({ "output": String::from_utf8_lossy(&out.stdout) })),
            error: None,
        },
        Err(e) => error_response(&format!("Failed to get ports: {}", e)),
    }
}

async fn ping(args: Value) -> ToolDispatchResponse {
    let host = match args.get("host").and_then(|v| v.as_str()) {
        Some(h) => h,
        None => return error_response("Missing 'host' argument"),
    };

    let output = if cfg!(windows) {
        Command::new("ping").arg("-n").arg("4").arg(host).output()
    } else {
        Command::new("ping").arg("-c").arg("4").arg(host).output()
    };

    match output {
        Ok(out) => ToolDispatchResponse {
            success: true,
            result: Some(json!({ "output": String::from_utf8_lossy(&out.stdout) })),
            error: None,
        },
        Err(e) => error_response(&format!("Failed to ping: {}", e)),
    }
}

async fn traceroute(args: Value) -> ToolDispatchResponse {
    let host = match args.get("host").and_then(|v| v.as_str()) {
        Some(h) => h,
        None => return error_response("Missing 'host' argument"),
    };

    let output = if cfg!(windows) {
        Command::new("tracert").arg(host).output()
    } else {
        Command::new("traceroute").arg(host).output()
    };

    match output {
        Ok(out) => ToolDispatchResponse {
            success: true,
            result: Some(json!({ "output": String::from_utf8_lossy(&out.stdout) })),
            error: None,
        },
        Err(e) => error_response(&format!("Failed to traceroute: {}", e)),
    }
}

async fn whois(args: Value) -> ToolDispatchResponse {
    let domain = match args
        .get("domain")
        .or_else(|| args.get("host"))
        .and_then(|v| v.as_str())
    {
        Some(d) => d,
        None => return error_response("Missing 'domain' argument"),
    };

    // On Windows, whois isn't built-in. We'll try to use a simple TCP client or shell out if available.
    // For now, let's assume it might be in the path (e.g. Sysinternals whois).
    let output = Command::new("whois").arg(domain).output();

    match output {
        Ok(out) => ToolDispatchResponse {
            success: true,
            result: Some(json!({ "output": String::from_utf8_lossy(&out.stdout) })),
            error: None,
        },
        Err(_) => {
            // Fallback: advise user or try alternative
            error_response("whois command not found or failed. Please ensure 'whois' is installed in your system path.")
        }
    }
}

fn error_response(msg: &str) -> ToolDispatchResponse {
    ToolDispatchResponse {
        success: false,
        result: None,
        error: Some(msg.into()),
    }
}
