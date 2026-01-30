// Hide console window on Windows (prevents conhost.exe)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use axum::{
    routing::post,
    Json, Router,
    extract::State,
};
use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;
use std::fs;
use tokio::net::TcpListener;

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
enum Request {
    Init { path: String },
    InsertVector { id: String, content: String, embedding: Vec<f32>, metadata: Option<String> },
    SearchVector { embedding: Vec<f32>, limit: i64 },
    GetCache { hash: String },
    SetCache { hash: String, response: String, ttl: i64 },
}

#[derive(Serialize)]
struct Response {
    success: bool,
    data: Option<serde_json::Value>,
    error: Option<String>,
}

struct MemoryService {
    conn: Option<Connection>,
}

impl MemoryService {
    fn new() -> Self {
        Self { conn: None }
    }

    fn init(&mut self, path: &str) -> Result<()> {
        let conn = Connection::open(path).context("Failed to open database")?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS vectors (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                embedding BLOB NOT NULL,
                metadata TEXT,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS model_cache (
                hash TEXT PRIMARY KEY,
                response TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                ttl INTEGER NOT NULL
            )",
            [],
        )?;
        self.conn = Some(conn);
        Ok(())
    }

    fn insert_vector(&self, id: &str, content: &str, embedding: &[f32], metadata: Option<&str>) -> Result<()> {
        let conn = self.conn.as_ref().context("Database not initialized")?;
        let embedding_bytes = bincode::serialize(embedding)?;
        let now = Utc::now().timestamp_millis();
        conn.execute(
            "INSERT OR REPLACE INTO vectors (id, content, embedding, metadata, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, content, embedding_bytes, metadata, now],
        )?;
        Ok(())
    }

    fn search_vector(&self, query_embedding: &[f32], limit: i64) -> Result<Vec<serde_json::Value>> {
        let conn = self.conn.as_ref().context("Database not initialized")?;
        let mut stmt = conn.prepare("SELECT id, content, embedding, metadata, created_at FROM vectors")?;
        let rows = stmt.query_map([], |row| {
            let embedding_blob: Vec<u8> = row.get(2)?;
            let embedding: Vec<f32> = bincode::deserialize(&embedding_blob).unwrap_or_default();
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, embedding, row.get::<_, Option<String>>(3)?, row.get::<_, i64>(4)?))
        })?;

        let mut results = Vec::new();
        for row in rows {
            let (id, content, embedding, metadata, created_at) = row?;
            let similarity = cosine_similarity(query_embedding, &embedding);
            results.push((similarity, id, content, metadata, created_at));
        }
        results.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(limit as usize);

        Ok(results.into_iter().map(|(score, id, content, metadata, created_at)| {
            serde_json::json!({ "id": id, "content": content, "score": score, "metadata": metadata, "created_at": created_at })
        }).collect())
    }

    fn get_cache(&self, hash: &str) -> Result<Option<String>> {
        let conn = self.conn.as_ref().context("Database not initialized")?;
        let now = Utc::now().timestamp_millis();
        conn.execute("DELETE FROM model_cache WHERE created_at + ttl < ?", params![now]).ok();
        let mut stmt = conn.prepare("SELECT response FROM model_cache WHERE hash = ?")?;
        Ok(stmt.query_row(params![hash], |row| row.get(0)).optional()?)
    }

    fn set_cache(&self, hash: &str, response: &str, ttl: i64) -> Result<()> {
        let conn = self.conn.as_ref().context("Database not initialized")?;
        let now = Utc::now().timestamp_millis();
        conn.execute("INSERT OR REPLACE INTO model_cache (hash, response, created_at, ttl) VALUES (?1, ?2, ?3, ?4)", params![hash, response, now, ttl])?;
        Ok(())
    }
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let dot_product: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 { 0.0 } else { dot_product / (norm_a * norm_b) }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let service = Arc::new(Mutex::new(MemoryService::new()));

    let app = Router::new()
        .route("/rpc", post(handle_rpc))
        .with_state(service);

    let addr = SocketAddr::from(([127, 0, 0, 1], 0));
    let listener = TcpListener::bind(addr).await?;
    let local_addr = listener.local_addr()?;
    let port = local_addr.port();

    println!("Memory service listening on {}", local_addr);

    if let Ok(appdata) = std::env::var("APPDATA") {
        let services_dir = std::path::Path::new(&appdata).join("Tandem").join("services");
        fs::create_dir_all(&services_dir)?;
        let port_file = services_dir.join("memory-service.port");
        fs::write(port_file, port.to_string())?;
    }

    axum::serve(listener, app).await?;
    Ok(())
}

async fn handle_rpc(
    State(service): State<Arc<Mutex<MemoryService>>>,
    Json(req): Json<Request>,
) -> Json<Response> {
    let mut service = service.lock().await;
    let res = match req {
        Request::Init { path } => match service.init(&path) {
            Ok(_) => Response { success: true, data: None, error: None },
            Err(e) => Response { success: false, data: None, error: Some(e.to_string()) },
        },
        Request::InsertVector { id, content, embedding, metadata } => {
            match service.insert_vector(&id, &content, &embedding, metadata.as_deref()) {
                Ok(_) => Response { success: true, data: None, error: None },
                Err(e) => Response { success: false, data: None, error: Some(e.to_string()) },
            }
        },
        Request::SearchVector { embedding, limit } => {
            match service.search_vector(&embedding, limit) {
                Ok(results) => Response { success: true, data: Some(serde_json::Value::Array(results)), error: None },
                Err(e) => Response { success: false, data: None, error: Some(e.to_string()) },
            }
        },
        Request::GetCache { hash } => match service.get_cache(&hash) {
            Ok(Some(res)) => Response { success: true, data: Some(serde_json::json!({ "response": res })), error: None },
            Ok(None) => Response { success: true, data: None, error: None },
            Err(e) => Response { success: false, data: None, error: Some(e.to_string()) },
        },
        Request::SetCache { hash, response, ttl } => match service.set_cache(&hash, &response, ttl) {
            Ok(_) => Response { success: true, data: None, error: None },
            Err(e) => Response { success: false, data: None, error: Some(e.to_string()) },
        },
    };
    Json(res)
}

