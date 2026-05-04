/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

use anyhow::{Context, Result};
use rusqlite::{Connection, OpenFlags};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

pub mod chats;
pub mod workspaces;
pub mod knowledge;
pub mod system;
pub mod migrations;

use crate::types::*;

/// Database wrapper providing thread-safe access to SQLite
pub struct Database {
    pub(crate) conn: Arc<Mutex<Connection>>,
    pub(crate) db_path: PathBuf,
}

impl Database {
    /// Create a new database instance at the specified path
    pub fn new(path: &Path) -> Result<Self> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(path).context("Failed to open database")?;

        // Enable WAL mode for better concurrency
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            db_path: path.to_path_buf(),
        })
    }

    pub(crate) fn open_read_connection(&self) -> Result<Connection> {
        let conn = Connection::open_with_flags(
            &self.db_path,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .context("Failed to open read-only database connection")?;
        conn.busy_timeout(std::time::Duration::from_millis(1_000))?;
        Ok(conn)
    }

    pub(crate) async fn execute<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&Connection) -> Result<T> + Send + 'static,
        T: Send + 'static,
    {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || {
            let conn = conn.lock().map_err(|_| anyhow::anyhow!("Database lock poisoned"))?;
            f(&conn)
        })
        .await?
    }

    pub(crate) async fn execute_mut<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&mut Connection) -> Result<T> + Send + 'static,
        T: Send + 'static,
    {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || {
            let mut conn = conn.lock().map_err(|_| anyhow::anyhow!("Database lock poisoned"))?;
            f(&mut conn)
        })
        .await?
    }

    /// Initialize the database schema
    pub async fn initialize(&self) -> Result<()> {
        let conn = self.conn.clone();
        tokio::task::spawn_blocking(move || {
            let mut conn = conn.lock().map_err(|_| anyhow::anyhow!("Database lock poisoned"))?;
            migrations::run_migrations_internal(&mut conn)?;
            migrations::repair_workspace_schema_internal(&mut conn)?;
            migrations::ensure_runtime_support_tables_internal(&mut conn)?;
            Ok::<(), anyhow::Error>(())
        }).await??;
        Ok(())
    }
}
