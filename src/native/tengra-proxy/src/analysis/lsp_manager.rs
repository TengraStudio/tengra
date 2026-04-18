use dashmap::DashMap;
use serde_json::{json, Value};
use std::process::Stdio;
/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{mpsc, oneshot};

pub struct LspManager {
    // Maps language ID (e.g., "rust", "typescript") to active client
    clients: DashMap<String, Arc<LspClient>>,
}

pub struct LspClient {
    pub language_id: String,
    tx: mpsc::Sender<LspRequest>,
}

struct LspRequest {
    method: String,
    params: Value,
    resp_tx: oneshot::Sender<Result<Value, String>>,
}

impl LspManager {
    pub fn new() -> Self {
        Self {
            clients: DashMap::new(),
        }
    }

    pub async fn get_or_start_client(
        &self,
        lang: &str,
        project_path: &str,
    ) -> Result<Arc<LspClient>, String> {
        if let Some(client) = self.clients.get(lang) {
            return Ok(client.clone());
        }

        let client = LspClient::start(lang, project_path).await?;
        let arc_client = Arc::new(client);
        self.clients.insert(lang.to_string(), arc_client.clone());
        Ok(arc_client)
    }
}

impl LspClient {
    pub async fn start(lang: &str, project_path: &str) -> Result<Self, String> {
        let (cmd, args) = match lang {
            "rust" => ("rust-analyzer", vec![]),
            "typescript" | "javascript" => ("typescript-language-server", vec!["--stdio"]),
            _ => return Err(format!("Unsupported language: {}", lang)),
        };

        let mut child = Command::new(cmd)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start LSP {}: {}", lang, e))?;

        let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;

        let (tx, rx) = mpsc::channel(100);

        // Background task to handle communication
        tokio::spawn(async move {
            if let Err(e) = handle_lsp_io(stdin, stdout, rx).await {
                eprintln!("LSP IO error: {}", e);
            }
        });

        let client = Self {
            language_id: lang.to_string(),
            tx,
        };

        // Initialize the LSP
        client
            .request(
                "initialize",
                serde_json::json!({
                    "processId": std::process::id(),
                    "rootUri": format!("file://{}", project_path),
                    "capabilities": {}
                }),
            )
            .await?;

        client.notify("initialized", serde_json::json!({})).await?;

        Ok(client)
    }

    pub async fn request(&self, method: &str, params: Value) -> Result<Value, String> {
        let (resp_tx, resp_rx) = oneshot::channel();
        self.tx
            .send(LspRequest {
                method: method.to_string(),
                params,
                resp_tx,
            })
            .await
            .map_err(|e| e.to_string())?;

        resp_rx.await.map_err(|e| e.to_string())?
    }

    pub async fn notify(&self, method: &str, params: Value) -> Result<(), String> {
        // Notifications don't expect a response, we could implement a separate channel
        // or just reuse the request channel with a dummy resp_tx.
        let (resp_tx, _) = oneshot::channel();
        self.tx
            .send(LspRequest {
                method: method.to_string(),
                params,
                resp_tx,
            })
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

async fn handle_lsp_io(
    mut stdin: tokio::process::ChildStdin,
    stdout: tokio::process::ChildStdout,
    mut rx: mpsc::Receiver<LspRequest>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut reader = BufReader::new(stdout);
    let pending_requests: Arc<DashMap<i64, oneshot::Sender<Result<Value, String>>>> =
        Arc::new(DashMap::new());
    let pending_clone = pending_requests.clone();

    // Reader task
    tokio::spawn(async move {
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) | Err(_) => break,
                _ => {}
            }

            if line.starts_with("Content-Length: ") {
                let len: usize = line["Content-Length: ".len()..].trim().parse().unwrap_or(0);

                // Read the empty line after Content-Length
                line.clear();
                let _ = reader.read_line(&mut line).await;

                let mut buffer = vec![0u8; len];
                if reader.read_exact(&mut buffer).await.is_ok() {
                    if let Ok(resp) = serde_json::from_slice::<Value>(&buffer) {
                        if let Some(id) = resp.get("id").and_then(|v| v.as_i64()) {
                            if let Some((_, tx)) = pending_clone.remove(&id) {
                                if let Some(error) = resp.get("error") {
                                    let _ = tx.send(Err(error.to_string()));
                                } else {
                                    let _ = tx.send(Ok(resp
                                        .get("result")
                                        .cloned()
                                        .unwrap_or(Value::Null)));
                                }
                            }
                        }
                        // Handle notifications (no ID) here if needed
                    }
                }
            }
        }
    });

    let mut id_counter = 0;
    while let Some(req) = rx.recv().await {
        id_counter += 1;
        let id = id_counter;
        pending_requests.insert(id, req.resp_tx);

        let body = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": req.method,
            "params": req.params,
        });

        let body_str = body.to_string();
        let msg = format!("Content-Length: {}\r\n\r\n{}", body_str.len(), body_str);
        if let Err(e) = stdin.write_all(msg.as_bytes()).await {
            eprintln!("Failed to write to LSP stdin: {}", e);
            break;
        }
        let _ = stdin.flush().await;
    }

    Ok(())
}
