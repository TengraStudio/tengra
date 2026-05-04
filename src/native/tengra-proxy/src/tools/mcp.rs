/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

use anyhow::{anyhow, Result};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, oneshot, RwLock};
use tokio_util::codec::{FramedRead, LinesCodec};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct McpPluginConfig {
    pub name: String,
    pub description: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: Option<HashMap<String, String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: Value,
    method: String,
    params: Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize, Deserialize)]
struct JsonRpcError {
    code: i32,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
}

type ResponseSender = oneshot::Sender<Result<Value>>;

pub struct McpPlugin {
    pub config: McpPluginConfig,
    request_tx: mpsc::Sender<(JsonRpcRequest, ResponseSender)>,
    _handle: tokio::task::JoinHandle<()>,
}

impl McpPlugin {
    pub async fn spawn(config: McpPluginConfig) -> Result<Self> {
        let mut child = Command::new(&config.command)
            .args(&config.args)
            .env_clear()
            .envs(config.env.clone().unwrap_or_default())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        let stdin = child.stdin.take().ok_or_else(|| anyhow!("Failed to open stdin"))?;
        let stdout = child.stdout.take().ok_or_else(|| anyhow!("Failed to open stdout"))?;
        let mut stderr = child.stderr.take().ok_or_else(|| anyhow!("Failed to open stderr"))?;

        let (request_tx, mut request_rx) = mpsc::channel::<(JsonRpcRequest, ResponseSender)>(100);
        let pending_requests = Arc::new(RwLock::new(HashMap::<String, ResponseSender>::new()));
        let pending_requests_clone = Arc::clone(&pending_requests);

        let name = config.name.clone();
        
        // Background Error Reader
        tokio::spawn(async move {
            let mut buffer = [0u8; 1024];
            use tokio::io::AsyncReadExt;
            while let Ok(n) = stderr.read(&mut buffer).await {
                if n == 0 { break; }
                let err_msg = String::from_utf8_lossy(&buffer[..n]);
                tracing::warn!("MCP Plugin [{}] STDERR: {}", name, err_msg);
            }
        });

        let mut framed_stdout = FramedRead::new(stdout, LinesCodec::new());
        let mut writer = stdin;

        let handle = tokio::spawn(async move {
            let mut request_rx = request_rx;
            loop {
                tokio::select! {
                    // Handle outgoing requests
                    Some((req, tx)) = request_rx.recv() => {
                        let id = req.id.as_str().unwrap_or_default().to_string();
                        pending_requests_clone.write().await.insert(id, tx);
                        let json = serde_json::to_string(&req).unwrap() + "\n";
                        if let Err(e) = writer.write_all(json.as_bytes()).await {
                            tracing::error!("Failed to write to MCP plugin: {}", e);
                            break;
                        }
                    }
                    // Handle incoming responses
                    Some(result) = framed_stdout.next() => {
                        match result {
                            Ok(line) => {
                                if let Ok(resp) = serde_json::from_str::<JsonRpcResponse>(&line) {
                                    let id = match &resp.id {
                                        Value::String(s) => s.clone(),
                                        Value::Number(n) => n.to_string(),
                                        _ => continue,
                                    };
                                    if let Some(tx) = pending_requests_clone.write().await.remove(&id) {
                                        if let Some(error) = resp.error {
                                            let _ = tx.send(Err(anyhow!("MCP Error {}: {}", error.code, error.message)));
                                        } else {
                                            let _ = tx.send(Ok(resp.result.unwrap_or(Value::Null)));
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                tracing::error!("Failed to read from MCP plugin: {}", e);
                                break;
                            }
                        }
                    }
                    else => break,
                }
            }
        });

        Ok(Self {
            config,
            request_tx,
            _handle: handle,
        })
    }

    pub async fn call(&self, method: &str, params: Value) -> Result<Value> {
        let (tx, rx) = oneshot::channel();
        let id = Uuid::new_v4().to_string();
        let req = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Value::String(id),
            method: method.to_string(),
            params,
        };

        self.request_tx.send((req, tx)).await.map_err(|_| anyhow!("Plugin closed"))?;
        rx.await.map_err(|_| anyhow!("Plugin response channel closed"))?
    }
}

pub struct McpManager {
    plugins: Arc<RwLock<HashMap<String, Arc<McpPlugin>>>>,
}

impl McpManager {
    pub fn new() -> Self {
        Self {
            plugins: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn register_plugin(&self, config: McpPluginConfig) -> Result<()> {
        let name = config.name.clone();
        let plugin = McpPlugin::spawn(config).await?;
        self.plugins.write().await.insert(name, Arc::new(plugin));
        Ok(())
    }

    pub async fn call_tool(&self, plugin_name: &str, tool_name: &str, arguments: Value) -> Result<Value> {
        let plugins = self.plugins.read().await;
        let plugin = plugins.get(plugin_name).ok_or_else(|| anyhow!("Plugin not found: {}", plugin_name))?;
        
        let params = json!({
            "name": tool_name,
            "arguments": arguments,
        });

        plugin.call("tools/call", params).await
    }

    pub async fn list_plugins(&self) -> Vec<McpPluginConfig> {
        let plugins = self.plugins.read().await;
        plugins.values().map(|p| p.config.clone()).collect()
    }
}
