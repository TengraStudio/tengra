/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

use anyhow::{bail, Context, Result};
use rusqlite::{params, Connection, OptionalExtension};

pub const CODE_SYMBOLS_SEGMENT: &str = "code_symbols";
pub const SEMANTIC_FRAGMENTS_SEGMENT: &str = "semantic_fragments";
pub const TOKEN_USAGE_SEGMENT: &str = "token_usage";
pub const FILE_DIFFS_SEGMENT: &str = "file_diffs";

pub fn legacy_workspace_id_column() -> &'static str {
    "workspace_id"
}

pub fn legacy_workspace_path_column() -> &'static str {
    "workspace_path"
}

pub fn legacy_workspace_table() -> &'static str {
    "workspaces"
}

pub(crate) fn run_migrations_internal(conn: &mut Connection) -> Result<()> {
    // Create migrations tracking table if it doesn't exist
    conn.execute(
        "CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at INTEGER NOT NULL,
            checksum TEXT
        )",
        [],
    )?;

    // Handle legacy migration table without checksum column
    if !column_exists_internal(conn, "_migrations", "checksum")? {
        tracing::info!("Adding checksum column to _migrations table");
        conn.execute("ALTER TABLE _migrations ADD COLUMN checksum TEXT", [])?;
    }

    let migrations = get_migrations_static();

    for (id, name, sql) in migrations {
        let current_checksum = format!("{:x}", md5::compute(&sql));

        let row: Option<(String, String)> = conn
            .query_row(
                "SELECT name, checksum FROM _migrations WHERE id = ?",
                [id],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    ))
                },
            )
            .optional()?;

        if let Some((_applied_name, applied_checksum)) = row {
            if !applied_checksum.is_empty() && applied_checksum != current_checksum {
                bail!(
                    "Migration integrity check failed for {}: {}. Expected {}, found {}",
                    id,
                    name,
                    current_checksum,
                    applied_checksum
                );
            }
            continue;
        }

        tracing::info!("Running migration {}: {}", id, name);

        // Run migration in a transaction
        let tx = conn.transaction()?;

        let mut should_apply = true;
        if id == 9 {
            let projects_exists: bool = tx
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='projects'",
                    [],
                    |row| Ok(row.get::<_, i32>(0)? > 0),
                )
                .unwrap_or(false);

            if !projects_exists {
                tracing::info!("Table 'projects' not found, skipping rename migration 9");
                should_apply = false;
            }
        }

        if should_apply {
            tx.execute_batch(&sql)?;
        }

        tx.execute(
            "INSERT INTO _migrations (id, name, applied_at, checksum) VALUES (?, ?, ?, ?)",
            params![
                id,
                name,
                chrono::Utc::now().timestamp_millis(),
                current_checksum
            ],
        )?;

        tx.commit()?;
    }

    Ok(())
}

pub(crate) fn table_exists_internal(conn: &Connection, table_name: &str) -> Result<bool> {
    conn.query_row(
        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name = ?",
        [table_name],
        |row| Ok(row.get::<_, i32>(0)? > 0),
    )
    .context("Failed to inspect sqlite_master")
}

pub(crate) fn column_exists_internal(
    conn: &Connection,
    table_name: &str,
    column_name: &str,
) -> Result<bool> {
    let pragma_sql = format!("PRAGMA table_info({table_name})");
    let mut stmt = conn.prepare(&pragma_sql)?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    for row in rows {
        if row? == column_name {
            return Ok(true);
        }
    }
    Ok(false)
}

pub(crate) fn repair_workspace_schema_internal(conn: &mut Connection) -> Result<()> {
    let has_projects = table_exists_internal(conn, "projects")?;
    let has_workspaces = table_exists_internal(conn, "workspaces")?;

    if has_projects && !has_workspaces {
        tracing::warn!("Repairing legacy schema: renaming projects table to workspaces");
        conn.execute_batch("ALTER TABLE projects RENAME TO workspaces;")?;
    }

    if column_exists_internal(conn, "chats", "project_id")?
        && !column_exists_internal(conn, "chats", "workspace_id")?
    {
        tracing::warn!("Repairing legacy schema: renaming chats.project_id to workspace_id");
        conn.execute_batch("ALTER TABLE chats RENAME COLUMN project_id TO workspace_id;")?;
    }

    for table_name in [
        SEMANTIC_FRAGMENTS_SEGMENT,
        FILE_DIFFS_SEGMENT,
        TOKEN_USAGE_SEGMENT,
        CODE_SYMBOLS_SEGMENT,
    ] {
        if column_exists_internal(conn, table_name, "project_path")?
            && !column_exists_internal(conn, table_name, legacy_workspace_path_column())?
        {
            let alter_sql = format!(
                "ALTER TABLE {table_name} RENAME COLUMN project_path TO {};",
                legacy_workspace_path_column()
            );
            tracing::warn!(
                "Repairing legacy schema: renaming {table_name}.project_path to {}",
                legacy_workspace_path_column()
            );
            conn.execute_batch(&alter_sql)?;
        }
    }

    Ok(())
}

pub(crate) fn ensure_runtime_support_tables_internal(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS advanced_memories (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            embedding BLOB,
            metadata TEXT,
            importance REAL,
            created_at INTEGER,
            updated_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS linked_accounts (
            id TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            email TEXT,
            access_token TEXT,
            refresh_token TEXT,
            metadata TEXT,
            is_active INTEGER DEFAULT 1,
            created_at INTEGER,
            updated_at INTEGER
        );
        "#,
    )
    .context("Failed to ensure runtime support tables")
}

fn get_migrations_static() -> Vec<(i32, String, String)> {
    let workspace_id = legacy_workspace_id_column();
    let workspace_path = legacy_workspace_path_column();
    let workspace_table = legacy_workspace_table();

    vec![
        (1, "initial_schema".into(), format!(
            "CREATE TABLE IF NOT EXISTS {workspace_table} (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                metadata TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                parent_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS prompts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                folder_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );"
        )),
        (2, "chats_table".into(), format!(
            "CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                model TEXT NOT NULL,
                backend TEXT NOT NULL,
                folder_id TEXT,
                {workspace_id} TEXT,
                is_pinned INTEGER DEFAULT 0,
                is_favorite INTEGER DEFAULT 0,
                is_archived INTEGER DEFAULT 0,
                metadata TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );"
        )),
        (3, "messages_table".into(), format!(
            "CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
            );"
        )),
        (4, "knowledge_tables".into(), format!(
            "CREATE TABLE IF NOT EXISTS code_symbols (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                kind TEXT NOT NULL,
                path TEXT NOT NULL,
                range_start_line INTEGER,
                range_start_col INTEGER,
                range_end_line INTEGER,
                range_end_col INTEGER,
                embedding BLOB,
                {workspace_path} TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS semantic_fragments (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                embedding BLOB,
                source TEXT,
                source_id TEXT,
                tags TEXT,
                importance REAL DEFAULT 0.0,
                {workspace_path} TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );"
        )),
        (5, "token_usage_table".into(), format!(
            "CREATE TABLE IF NOT EXISTS token_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model TEXT NOT NULL,
                prompt_tokens INTEGER NOT NULL,
                completion_tokens INTEGER NOT NULL,
                total_tokens INTEGER NOT NULL,
                cost REAL,
                {workspace_path} TEXT,
                created_at INTEGER NOT NULL
            );"
        )),
        (6, "file_diffs_table".into(), format!(
            "CREATE TABLE IF NOT EXISTS file_diffs (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                path TEXT NOT NULL,
                diff TEXT NOT NULL,
                status TEXT NOT NULL,
                {workspace_path} TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
            );"
        )),
        (7, "fix_folders_schema".into(), 
            "CREATE TABLE IF NOT EXISTS folders_new (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                parent_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            INSERT OR IGNORE INTO folders_new SELECT id, name, parent_id, created_at, updated_at FROM folders;
            DROP TABLE folders;
            ALTER TABLE folders_new RENAME TO folders;".into()
        ),
        (8, "add_vector_to_messages".into(), 
            "ALTER TABLE messages ADD COLUMN vector BLOB;".into()
        ),
        (9, "rename_projects_to_workspaces".into(), 
            "ALTER TABLE projects RENAME TO workspaces;
             ALTER TABLE chats RENAME COLUMN project_id TO workspace_id;".into()
        ),
    ]
}
