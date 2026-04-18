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
use sysinfo::{ProcessRefreshKind, RefreshKind, System};

pub async fn handle_action(action: &str, arguments: Value) -> ToolDispatchResponse {
    match action {
        "get_info" => get_info().await,
        "env_vars" => env_vars().await,
        "process_list" => process_list(arguments).await,
        "kill_process" => kill_process(arguments).await,
        "disk_space" => disk_space().await,
        "usage" => get_info().await, // Already implemented basically
        _ => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Unknown system action: {}", action)),
        },
    }
}

async fn get_info() -> ToolDispatchResponse {
    let mut sys = System::new_all();
    sys.refresh_all();

    let info = json!({
        "os": System::name().unwrap_or_else(|| "Unknown".to_string()),
        "os_version": System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        "kernel_version": System::kernel_version().unwrap_or_else(|| "Unknown".to_string()),
        "hostname": System::host_name().unwrap_or_else(|| "Unknown".to_string()),
        "arch": System::cpu_arch().unwrap_or_else(|| "Unknown".to_string()),
        "cpu_count": sys.cpus().len(),
        "total_memory": sys.total_memory(),
        "used_memory": sys.used_memory(),
    });

    ToolDispatchResponse {
        success: true,
        result: Some(info),
        error: None,
    }
}

async fn env_vars() -> ToolDispatchResponse {
    let vars: std::collections::HashMap<String, String> = std::env::vars().collect();
    ToolDispatchResponse {
        success: true,
        result: Some(json!(vars)),
        error: None,
    }
}

async fn process_list(arguments: Value) -> ToolDispatchResponse {
    let mut sys = System::new_with_specifics(
        RefreshKind::new().with_processes(ProcessRefreshKind::everything()),
    );
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All);

    let limit = arguments
        .get("limit")
        .and_then(|v| v.as_u64())
        .unwrap_or(50) as usize;

    let mut processes: Vec<_> = sys
        .processes()
        .values()
        .map(|p| {
            json!({
                "pid": p.pid().as_u32(),
                "name": p.name(),
                "cpu_usage": p.cpu_usage(),
                "memory_usage": p.memory(),
                "status": format!("{:?}", p.status()),
            })
        })
        .collect();

    // Sort by CPU usage descending
    processes.sort_by(|a, b| {
        b["cpu_usage"]
            .as_f64()
            .unwrap_or(0.0)
            .partial_cmp(&a["cpu_usage"].as_f64().unwrap_or(0.0))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    if processes.len() > limit {
        processes.truncate(limit);
    }

    ToolDispatchResponse {
        success: true,
        result: Some(json!(processes)),
        error: None,
    }
}

async fn kill_process(arguments: Value) -> ToolDispatchResponse {
    let pid = match arguments.get("pid").and_then(|v| v.as_u64()) {
        Some(p) => p as u32,
        None => {
            return ToolDispatchResponse {
                success: false,
                result: None,
                error: Some("Missing 'pid' argument".to_string()),
            }
        }
    };

    let s = System::new_with_specifics(
        RefreshKind::new().with_processes(ProcessRefreshKind::everything()),
    );

    if let Some(process) = s.process(sysinfo::Pid::from_u32(pid)) {
        if process.kill() {
            ToolDispatchResponse {
                success: true,
                result: Some(json!({ "message": format!("Process {} killed", pid) })),
                error: None,
            }
        } else {
            ToolDispatchResponse {
                success: false,
                result: None,
                error: Some(format!("Failed to kill process {}", pid)),
            }
        }
    } else {
        ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Process {} not found", pid)),
        }
    }
}

async fn disk_space() -> ToolDispatchResponse {
    use sysinfo::Disks;
    let mut disks = Disks::new();
    disks.refresh_list();

    let info: Vec<_> = disks
        .iter()
        .map(|d| {
            json!({
                "name": d.name().to_string_lossy(),
                "mount_point": d.mount_point().to_string_lossy(),
                "total_space": d.total_space(),
                "available_space": d.available_space(),
                "is_removable": d.is_removable(),
            })
        })
        .collect();

    ToolDispatchResponse {
        success: true,
        result: Some(json!(info)),
        error: None,
    }
}
