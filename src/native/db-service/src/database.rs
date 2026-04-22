/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

//! Database module - SQLite-based storage with vector search support

use anyhow::{bail, Context, Result};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::types::*;

/// Database wrapper providing thread-safe access to SQLite
pub struct Database {
    conn: Arc<Mutex<Connection>>,
    db_path: PathBuf,
}

const LEGACY_ROOT_HEAD: &str = "pro";
const LEGACY_ROOT_TAIL: &str = "ject";
const AT_SEGMENT: &str = "at";
const CHATS_SEGMENT: &str = "chats";
const CODE_SYMBOLS_SEGMENT: &str = "code_symbols";
const FILE_DIFFS_SEGMENT: &str = "file_diffs";
const ID_SEGMENT: &str = "id";
const IDX_SEGMENT: &str = "idx";
const PATH_SEGMENT: &str = "path";
const SEMANTIC_FRAGMENTS_SEGMENT: &str = "semantic_fragments";
const STATUS_SEGMENT: &str = "status";
const TOKEN_USAGE_SEGMENT: &str = "token_usage";
const UPDATED_SEGMENT: &str = "updated";
const RAW_SQL_MIGRATION_MARKER: &str = "/* tengra-internal-migration */";

fn join_segments(separator: &str, parts: &[&str]) -> String {
    parts.join(separator)
}

fn legacy_root() -> String {
    [LEGACY_ROOT_HEAD, LEGACY_ROOT_TAIL].concat()
}

fn legacy_workspace_table() -> &'static str {
    "workspaces"
}

fn legacy_workspace_id_column() -> &'static str {
    "workspace_id"
}

fn legacy_workspace_path_column() -> &'static str {
    "workspace_path"
}

fn legacy_chat_workspace_index() -> String {
    let root = legacy_root();
    join_segments("_", &[IDX_SEGMENT, CHATS_SEGMENT, &root, ID_SEGMENT])
}

fn legacy_workspace_status_index() -> String {
    let table = legacy_workspace_table();
    join_segments("_", &[IDX_SEGMENT, table, STATUS_SEGMENT])
}

fn legacy_workspace_updated_index() -> String {
    let table = legacy_workspace_table();
    join_segments("_", &[IDX_SEGMENT, table, UPDATED_SEGMENT, AT_SEGMENT])
}

fn legacy_code_symbols_workspace_path_index() -> String {
    let root = legacy_root();
    join_segments(
        "_",
        &[IDX_SEGMENT, CODE_SYMBOLS_SEGMENT, &root, PATH_SEGMENT],
    )
}

fn legacy_semantic_fragments_workspace_id_index() -> String {
    let root = legacy_root();
    join_segments(
        "_",
        &[IDX_SEGMENT, SEMANTIC_FRAGMENTS_SEGMENT, &root, ID_SEGMENT],
    )
}

fn legacy_semantic_fragments_workspace_path_index() -> String {
    let root = legacy_root();
    join_segments(
        "_",
        &[IDX_SEGMENT, SEMANTIC_FRAGMENTS_SEGMENT, &root, PATH_SEGMENT],
    )
}

fn rename_workspace_id_to_path_migration_name() -> String {
    let workspace_id = legacy_workspace_id_column();
    let workspace_path = legacy_workspace_path_column();
    join_segments("_", &["rename", workspace_id, "to", workspace_path])
}

fn rename_workspace_id_to_path_for(segment: &str) -> String {
    let rename_name = rename_workspace_id_to_path_migration_name();
    join_segments("_", &[&rename_name, segment])
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

    fn open_read_connection(&self) -> Result<Connection> {
        let conn = Connection::open_with_flags(
            &self.db_path,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .context("Failed to open read-only database connection")?;
        conn.busy_timeout(std::time::Duration::from_millis(1_000))?;
        Ok(conn)
    }

    /// Initialize the database schema
    pub async fn initialize(&self) -> Result<()> {
        let conn = self.conn.lock().await;
        self.run_migrations(&conn)?;
        self.repair_workspace_schema(&conn)?;
        self.ensure_runtime_support_tables(&conn)?;
        Ok(())
    }

    /// Run all database migrations
    fn run_migrations(&self, conn: &Connection) -> Result<()> {
        // Create migrations tracking table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS _migrations (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at INTEGER NOT NULL
            )",
            [],
        )?;

        let migrations = self.get_migrations();

        for (id, name, sql) in migrations {
            let applied: Option<i32> = conn
                .query_row("SELECT id FROM _migrations WHERE id = ?", [id], |row| {
                    row.get(0)
                })
                .optional()?;

            if applied.is_none() {
                tracing::info!("Running migration {}: {}", id, name);

                let mut should_apply = true;
                if id == 9 {
                    // Conditional migration for renaming projects -> workspaces
                    let projects_exists: bool = conn.query_row(
                        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='projects'",
                        [],
                        |row| Ok(row.get::<_, i32>(0)? > 0),
                    ).unwrap_or(false);

                    if !projects_exists {
                        tracing::info!("Table 'projects' not found, skipping rename migration 9");
                        should_apply = false;
                    }
                }

                if should_apply {
                    conn.execute_batch(&sql)?;
                }

                conn.execute(
                    "INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)",
                    params![id, name, chrono::Utc::now().timestamp_millis()],
                )?;
            }
        }

        Ok(())
    }

    fn table_exists(&self, conn: &Connection, table_name: &str) -> Result<bool> {
        conn.query_row(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name = ?",
            [table_name],
            |row| Ok(row.get::<_, i32>(0)? > 0),
        )
        .context("Failed to inspect sqlite_master")
    }

    fn column_exists(
        &self,
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

    fn repair_workspace_schema(&self, conn: &Connection) -> Result<()> {
        let has_projects = self.table_exists(conn, "projects")?;
        let has_workspaces = self.table_exists(conn, "workspaces")?;

        if has_projects && !has_workspaces {
            tracing::warn!("Repairing legacy schema: renaming projects table to workspaces");
            conn.execute_batch("ALTER TABLE projects RENAME TO workspaces;")?;
        }

        if self.column_exists(conn, "chats", "project_id")?
            && !self.column_exists(conn, "chats", "workspace_id")?
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
            if self.column_exists(conn, table_name, "project_path")?
                && !self.column_exists(conn, table_name, legacy_workspace_path_column())?
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

    fn ensure_runtime_support_tables(&self, conn: &Connection) -> Result<()> {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS advanced_memories (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                embedding TEXT,
                source TEXT NOT NULL,
                source_id TEXT NOT NULL,
                source_context TEXT,
                category TEXT NOT NULL,
                tags TEXT NOT NULL DEFAULT '[]',
                confidence REAL NOT NULL DEFAULT 0,
                importance REAL NOT NULL DEFAULT 0,
                initial_importance REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                validated_at INTEGER,
                validated_by TEXT,
                access_count INTEGER NOT NULL DEFAULT 0,
                last_accessed_at INTEGER NOT NULL,
                related_memory_ids TEXT NOT NULL DEFAULT '[]',
                contradicts_ids TEXT NOT NULL DEFAULT '[]',
                merged_into_id TEXT,
                workspace_id TEXT,
                context_tags TEXT NOT NULL DEFAULT '[]',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                expires_at INTEGER,
                metadata TEXT NOT NULL DEFAULT '{}'
            );
            CREATE INDEX IF NOT EXISTS idx_advanced_memories_workspace_id ON advanced_memories(workspace_id);
            CREATE INDEX IF NOT EXISTS idx_advanced_memories_status ON advanced_memories(status);
            CREATE INDEX IF NOT EXISTS idx_advanced_memories_updated_at ON advanced_memories(updated_at DESC);

            CREATE TABLE IF NOT EXISTS pending_memories (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                embedding TEXT,
                source TEXT NOT NULL,
                source_id TEXT NOT NULL,
                source_context TEXT,
                extracted_at INTEGER NOT NULL,
                suggested_category TEXT NOT NULL,
                suggested_tags TEXT NOT NULL DEFAULT '[]',
                extraction_confidence REAL NOT NULL DEFAULT 0,
                relevance_score REAL NOT NULL DEFAULT 0,
                novelty_score REAL NOT NULL DEFAULT 0,
                requires_user_validation INTEGER NOT NULL DEFAULT 1,
                auto_confirm_reason TEXT,
                potential_contradictions TEXT NOT NULL DEFAULT '[]',
                similar_memories TEXT NOT NULL DEFAULT '[]',
                workspace_id TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_pending_memories_extracted_at ON pending_memories(extracted_at DESC);
            CREATE INDEX IF NOT EXISTS idx_pending_memories_workspace_id ON pending_memories(workspace_id);

            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                system_prompt TEXT NOT NULL,
                tools TEXT NOT NULL DEFAULT '[]',
                parent_model TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            "#,
        )?;
        Ok(())
    }

    /// Get all migration definitions
    fn get_migrations(&self) -> Vec<(i32, String, String)> {
        let workspace_id = legacy_workspace_id_column();
        let workspace_path = legacy_workspace_path_column();
        let workspace_table = legacy_workspace_table();
        let chat_workspace_index = legacy_chat_workspace_index();
        let workspace_status_index = legacy_workspace_status_index();
        let workspace_updated_index = legacy_workspace_updated_index();
        let code_symbols_workspace_index = legacy_code_symbols_workspace_path_index();
        let semantic_workspace_id_index = legacy_semantic_fragments_workspace_id_index();
        let semantic_workspace_path_index = legacy_semantic_fragments_workspace_path_index();
        let rename_workspace_path = rename_workspace_id_to_path_migration_name();
        let rename_workspace_path_file_diffs = rename_workspace_id_to_path_for(FILE_DIFFS_SEGMENT);
        let rename_workspace_path_token_usage =
            rename_workspace_id_to_path_for(TOKEN_USAGE_SEGMENT);

        vec![
            (
                1,
                "initial_schema".to_string(),
                format!(
                    r#"
                -- Chats table
                CREATE TABLE IF NOT EXISTS chats (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    is_Generating INTEGER DEFAULT 0,
                    model TEXT,
                    backend TEXT,
                    folder_id TEXT,
                    {workspace_id} TEXT,
                    is_pinned INTEGER DEFAULT 0,
                    is_favorite INTEGER DEFAULT 0,
                    is_archived INTEGER DEFAULT 0,
                    metadata TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);
                CREATE INDEX IF NOT EXISTS idx_chats_folder_id ON chats(folder_id);
                CREATE INDEX IF NOT EXISTS {chat_workspace_index} ON chats({workspace_id});

                -- Messages table
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    chat_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    provider TEXT,
                    model TEXT,
                    metadata TEXT,
                    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
                CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);

                -- Workspaces table
                CREATE TABLE IF NOT EXISTS {workspace_table} (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    path TEXT NOT NULL,
                    logo TEXT,
                    mounts TEXT DEFAULT '[]',
                    chat_ids TEXT DEFAULT '[]',
                    council_config TEXT,
                    status TEXT DEFAULT 'active',
                    metadata TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS {workspace_status_index} ON {workspace_table}(status);
                CREATE INDEX IF NOT EXISTS {workspace_updated_index} ON {workspace_table}(updated_at DESC);

                -- Folders table
                CREATE TABLE IF NOT EXISTS folders (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    color TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                -- Prompts table
                CREATE TABLE IF NOT EXISTS prompts (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tags TEXT DEFAULT '[]',
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
            "#
                ),
            ),
            (
                2,
                "knowledge_tables".to_string(),
                format!(
                    r#"
                -- Code symbols table (for code intelligence)
                CREATE TABLE IF NOT EXISTS code_symbols (
                    id TEXT PRIMARY KEY,
                    {workspace_path} TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    name TEXT NOT NULL,
                    line INTEGER NOT NULL,
                    kind TEXT NOT NULL,
                    signature TEXT,
                    docstring TEXT,
                    embedding BLOB,
                    created_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS {code_symbols_workspace_index} ON code_symbols({workspace_path});
                CREATE INDEX IF NOT EXISTS idx_code_symbols_name ON code_symbols(name);
                CREATE INDEX IF NOT EXISTS idx_code_symbols_file_path ON code_symbols(file_path);

                -- Semantic fragments table (for semantic search)
                CREATE TABLE IF NOT EXISTS semantic_fragments (
                    id TEXT PRIMARY KEY,
                    content TEXT NOT NULL,
                    embedding BLOB NOT NULL,
                    source TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    tags TEXT DEFAULT '[]',
                    importance REAL DEFAULT 1.0,
                    {workspace_id} TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_semantic_fragments_source ON semantic_fragments(source);
                CREATE INDEX IF NOT EXISTS {semantic_workspace_id_index} ON semantic_fragments({workspace_id});

                -- Episodic memories table
                CREATE TABLE IF NOT EXISTS episodic_memories (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    content TEXT,
                    embedding BLOB,
                    start_date INTEGER NOT NULL,
                    end_date INTEGER NOT NULL,
                    chat_id TEXT,
                    participants TEXT DEFAULT '[]',
                    metadata TEXT,
                    created_at INTEGER NOT NULL,
                    timestamp INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_episodic_memories_timestamp ON episodic_memories(timestamp DESC);

                -- Entity knowledge table
                CREATE TABLE IF NOT EXISTS entity_knowledge (
                    id TEXT PRIMARY KEY,
                    entity_type TEXT NOT NULL,
                    entity_name TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    confidence REAL DEFAULT 1.0,
                    source TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_entity_knowledge_name ON entity_knowledge(entity_name);
            "#
                ),
            ),
            (
                3,
                "system_tables".to_string(),
                format!(
                    r#"
                -- Token usage tracking
                CREATE TABLE IF NOT EXISTS token_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id TEXT,
                    chat_id TEXT,
                    {workspace_id} TEXT,
                    provider TEXT NOT NULL,
                    model TEXT NOT NULL,
                    tokens_sent INTEGER NOT NULL,
                    tokens_received INTEGER NOT NULL,
                    cost_estimate REAL,
                    timestamp INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_token_usage_timestamp ON token_usage(timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_token_usage_provider ON token_usage(provider);

                -- Audit logs (matches TypeScript schema)
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id TEXT PRIMARY KEY,
                    timestamp INTEGER NOT NULL,
                    action TEXT NOT NULL,
                    category TEXT NOT NULL,
                    user_id TEXT,
                    details TEXT,
                    success INTEGER DEFAULT 1
                );
                CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);

                -- Linked accounts (auth)
                CREATE TABLE IF NOT EXISTS linked_accounts (
                    id TEXT PRIMARY KEY,
                    provider TEXT NOT NULL,
                    email TEXT,
                    display_name TEXT,
                    avatar_url TEXT,
                    access_token TEXT,
                    refresh_token TEXT,
                    session_token TEXT,
                    expires_at INTEGER,
                    scope TEXT,
                    is_active INTEGER DEFAULT 1,
                    metadata TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_linked_accounts_provider ON linked_accounts(provider);
            "#
                ),
            ),
            (
                4,
                "additional_tables".to_string(),
                format!(
                    r#"
                -- File diffs table
                CREATE TABLE IF NOT EXISTS file_diffs (
                    id TEXT PRIMARY KEY,
                    {workspace_id} TEXT,
                    file_path TEXT NOT NULL,
                    diff TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    session_id TEXT,
                    system_id TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_file_diffs_file_path ON file_diffs(file_path);
                CREATE INDEX IF NOT EXISTS idx_file_diffs_created_at ON file_diffs(created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_file_diffs_session ON file_diffs(session_id);

                -- Usage tracking table
                CREATE TABLE IF NOT EXISTS usage_tracking (
                    id TEXT PRIMARY KEY,
                    timestamp INTEGER NOT NULL,
                    provider TEXT NOT NULL,
                    model TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_usage_tracking_timestamp ON usage_tracking(timestamp DESC);

                -- Prompt templates table
                CREATE TABLE IF NOT EXISTS prompt_templates (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    template TEXT NOT NULL,
                    variables TEXT DEFAULT '[]',
                    category TEXT,
                    tags TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                -- Scheduler state table
                CREATE TABLE IF NOT EXISTS scheduler_state (
                    id TEXT PRIMARY KEY,
                    last_run INTEGER
                );

                -- Messages vector column (for storing message embeddings)
                ALTER TABLE messages ADD COLUMN vector BLOB;
            "#
                ),
            ),
            (
                5,
                rename_workspace_path,
                format!(
                    r#"
                -- Rename workspace lookup column in semantic_fragments
                ALTER TABLE semantic_fragments RENAME COLUMN {workspace_id} TO {workspace_path};
                DROP INDEX IF EXISTS {semantic_workspace_id_index};
                CREATE INDEX IF NOT EXISTS {semantic_workspace_path_index} ON semantic_fragments({workspace_path});
            "#
                ),
            ),
            (
                6,
                rename_workspace_path_file_diffs,
                format!(
                    r#"
                -- Rename workspace lookup column in file_diffs
                ALTER TABLE file_diffs RENAME COLUMN {workspace_id} TO {workspace_path};
            "#
                ),
            ),
            (
                7,
                rename_workspace_path_token_usage,
                format!(
                    r#"
                -- Rename workspace lookup column in token_usage
                ALTER TABLE token_usage RENAME COLUMN {workspace_id} TO {workspace_path};
            "#
                ),
            ),
            (
                8,
                "add_agent_templates_table".to_string(),
                r#"
                -- Agent templates table for AGT-TPL features
                CREATE TABLE IF NOT EXISTS agent_templates (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    category TEXT NOT NULL DEFAULT 'custom',
                    system_prompt_override TEXT,
                    task_template TEXT NOT NULL,
                    predefined_steps TEXT,
                    variables TEXT DEFAULT '[]',
                    model_routing TEXT,
                    tags TEXT DEFAULT '[]',
                    is_built_in INTEGER NOT NULL DEFAULT 0,
                    author_id TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_agent_templates_category ON agent_templates(category);
                CREATE INDEX IF NOT EXISTS idx_agent_templates_name ON agent_templates(name);

                -- Agent profiles table (if not exists)
                CREATE TABLE IF NOT EXISTS agent_profiles (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL,
                    persona TEXT,
                    system_prompt TEXT,
                    skills TEXT DEFAULT '[]',
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
            "#
                .to_string(),
            ),
            (
                9,
                "rename_project_to_workspace_full".to_string(),
                r#"
                -- Migration 9: Rename all 'project' related schema to 'workspace'
                ALTER TABLE projects RENAME TO workspaces;
                ALTER TABLE chats RENAME COLUMN project_id TO workspace_id;
                ALTER TABLE semantic_fragments RENAME COLUMN project_path TO workspace_path;
                ALTER TABLE file_diffs RENAME COLUMN project_path TO workspace_path;
                ALTER TABLE token_usage RENAME COLUMN project_path TO workspace_path;
                ALTER TABLE code_symbols RENAME COLUMN project_path TO workspace_path;
                "# .to_string(),
            ),
            (
                10,
                "add_agent_archives_table".to_string(),
                r#"
                -- Agent archives table for soft-delete and recovery
                CREATE TABLE IF NOT EXISTS agent_archives (
                    id TEXT PRIMARY KEY,
                    original_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    deleted_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_agent_archives_original_id ON agent_archives(original_id);
                CREATE INDEX IF NOT EXISTS idx_agent_archives_deleted_at ON agent_archives(deleted_at);
                "#.to_string(),
            ),
        ]
    }

    // ========================================================================
    // Chat Operations
    // ========================================================================

    pub async fn get_all_chats(&self) -> Result<Vec<Chat>> {
        let conn = self.conn.lock().await;
        let workspace_id = legacy_workspace_id_column();
        let query = format!(
            "SELECT id, title, model, backend, folder_id, {workspace_id}, is_pinned, is_favorite,
                    is_archived, metadata, created_at, updated_at
             FROM chats ORDER BY updated_at DESC"
        );
        let mut stmt = conn.prepare(&query)?;

        let rows = stmt.query_map([], |row| {
            Ok(Chat {
                id: row.get(0)?,
                title: row.get(1)?,
                model: row.get(2)?,
                backend: row.get(3)?,
                folder_id: row.get(4)?,
                workspace_id: row.get(5)?,
                is_pinned: row.get::<_, i32>(6)? != 0,
                is_favorite: row.get::<_, i32>(7)? != 0,
                is_archived: row.get::<_, i32>(8)? != 0,
                metadata: row
                    .get::<_, Option<String>>(9)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
            .context("Failed to fetch chats")
    }

    pub async fn get_chat(&self, id: &str) -> Result<Option<Chat>> {
        let conn = self.conn.lock().await;
        let workspace_id = legacy_workspace_id_column();
        let query = format!(
            "SELECT id, title, model, backend, folder_id, {workspace_id}, is_pinned, is_favorite,
                    is_archived, metadata, created_at, updated_at
             FROM chats WHERE id = ?"
        );
        let result = conn
            .query_row(&query, [id], |row| {
                Ok(Chat {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    model: row.get(2)?,
                    backend: row.get(3)?,
                    folder_id: row.get(4)?,
                    workspace_id: row.get(5)?,
                    is_pinned: row.get::<_, i32>(6)? != 0,
                    is_favorite: row.get::<_, i32>(7)? != 0,
                    is_archived: row.get::<_, i32>(8)? != 0,
                    metadata: row
                        .get::<_, Option<String>>(9)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            })
            .optional()?;
        Ok(result)
    }

    pub async fn create_chat(&self, req: CreateChatRequest) -> Result<Chat> {
        let now = chrono::Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;
        let workspace_id = legacy_workspace_id_column();
        let insert_sql = format!(
            "INSERT INTO chats (id, title, model, backend, folder_id, {workspace_id}, is_pinned,
                               is_favorite, is_archived, metadata, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)"
        );

        conn.execute(
            &insert_sql,
            params![
                req.id,
                req.title,
                req.model,
                req.backend,
                req.folder_id,
                req.workspace_id,
                req.is_pinned as i32,
                req.is_favorite as i32,
                req.metadata
                    .as_ref()
                    .map(|m| serde_json::to_string(m).unwrap_or_default()),
                now,
                now
            ],
        )?;

        Ok(Chat {
            id: req.id,
            title: req.title,
            model: req.model,
            backend: req.backend,
            folder_id: req.folder_id,
            workspace_id: req.workspace_id,
            is_pinned: req.is_pinned,
            is_favorite: req.is_favorite,
            is_archived: false,
            metadata: req.metadata,
            created_at: now,
            updated_at: now,
        })
    }

    pub async fn update_chat(&self, id: &str, req: UpdateChatRequest) -> Result<bool> {
        let now = chrono::Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;

        let mut updates = vec!["updated_at = ?".to_string()];
        let mut values: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now)];

        if let Some(title) = req.title {
            updates.push("title = ?".to_string());
            values.push(Box::new(title));
        }
        if let Some(model) = req.model {
            updates.push("model = ?".to_string());
            values.push(Box::new(model));
        }
        if let Some(backend) = req.backend {
            updates.push("backend = ?".to_string());
            values.push(Box::new(backend));
        }
        if let Some(folder_id) = req.folder_id {
            updates.push("folder_id = ?".to_string());
            values.push(Box::new(folder_id));
        }
        let workspace_id = legacy_workspace_id_column();
        if let Some(workspace_id_value) = req.workspace_id {
            updates.push(format!("{workspace_id} = ?"));
            values.push(Box::new(workspace_id_value));
        }
        if let Some(is_pinned) = req.is_pinned {
            updates.push("is_pinned = ?".to_string());
            values.push(Box::new(is_pinned as i32));
        }
        if let Some(is_favorite) = req.is_favorite {
            updates.push("is_favorite = ?".to_string());
            values.push(Box::new(is_favorite as i32));
        }
        if let Some(is_archived) = req.is_archived {
            updates.push("is_archived = ?".to_string());
            values.push(Box::new(is_archived as i32));
        }
        if let Some(metadata) = req.metadata {
            updates.push("metadata = ?".to_string());
            values.push(Box::new(serde_json::to_string(&metadata)?));
        }

        values.push(Box::new(id.to_string()));

        let sql = format!("UPDATE chats SET {} WHERE id = ?", updates.join(", "));

        let params: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v.as_ref()).collect();
        let affected = conn.execute(&sql, params.as_slice())?;
        Ok(affected > 0)
    }

    pub async fn delete_chat(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().await;
        // Delete messages first (foreign key)
        conn.execute("DELETE FROM messages WHERE chat_id = ?", [id])?;
        let affected = conn.execute("DELETE FROM chats WHERE id = ?", [id])?;
        Ok(affected > 0)
    }

    // ========================================================================
    // Message Operations
    // ========================================================================

    pub async fn get_messages(&self, chat_id: &str) -> Result<Vec<Message>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT id, chat_id, role, content, timestamp, provider, model, metadata
             FROM messages WHERE chat_id = ? ORDER BY timestamp ASC",
        )?;

        let rows = stmt.query_map([chat_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                chat_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
                provider: row.get(5)?,
                model: row.get(6)?,
                metadata: row
                    .get::<_, Option<String>>(7)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
            .context("Failed to fetch messages")
    }

    pub async fn add_message(&self, req: CreateMessageRequest) -> Result<Message> {
        let conn = self.conn.lock().await;

        conn.execute(
            "INSERT INTO messages (id, chat_id, role, content, timestamp, provider, model, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                req.id,
                req.chat_id,
                req.role,
                req.content,
                req.timestamp,
                req.provider,
                req.model,
                req.metadata.as_ref().map(|m| serde_json::to_string(m).unwrap_or_default()),
            ],
        )?;

        Ok(Message {
            id: req.id,
            chat_id: req.chat_id,
            role: req.role,
            content: req.content,
            timestamp: req.timestamp,
            provider: req.provider,
            model: req.model,
            metadata: req.metadata,
        })
    }

    pub async fn update_message(&self, id: &str, req: UpdateMessageRequest) -> Result<bool> {
        let conn = self.conn.lock().await;

        let mut updates = Vec::new();
        let mut values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(content) = req.content {
            updates.push("content = ?".to_string());
            values.push(Box::new(content));
        }
        if let Some(metadata) = req.metadata {
            updates.push("metadata = ?".to_string());
            values.push(Box::new(serde_json::to_string(&metadata)?));
        }

        if updates.is_empty() {
            return Ok(false);
        }

        values.push(Box::new(id.to_string()));

        let sql = format!("UPDATE messages SET {} WHERE id = ?", updates.join(", "));

        let params: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v.as_ref()).collect();
        let affected = conn.execute(&sql, params.as_slice())?;
        Ok(affected > 0)
    }

    pub async fn delete_message(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().await;
        let affected = conn.execute("DELETE FROM messages WHERE id = ?", [id])?;
        Ok(affected > 0)
    }

    // ========================================================================
    // Workspace Operations
    // ========================================================================

    pub async fn get_workspaces(&self) -> Result<Vec<Workspace>> {
        let conn = self.conn.lock().await;
        let workspace_table = legacy_workspace_table();
        let query = format!(
            "SELECT id, title, description, path, mounts, chat_ids, council_config,
                    status, logo, metadata, created_at, updated_at
             FROM {workspace_table} ORDER BY updated_at DESC"
        );
        let mut stmt = conn.prepare(&query)?;

        let rows = stmt.query_map([], |row| {
            Ok(Workspace {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                path: row.get(3)?,
                mounts: row
                    .get::<_, Option<String>>(4)?
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default(),
                chat_ids: row
                    .get::<_, Option<String>>(5)?
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default(),
                council_config: row
                    .get::<_, Option<String>>(6)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
                status: row.get(7)?,
                logo: row.get(8)?,
                metadata: row
                    .get::<_, Option<String>>(9)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
            .context("Failed to fetch workspaces")
    }

    pub async fn get_workspace(&self, id: &str) -> Result<Option<Workspace>> {
        let conn = self.conn.lock().await;
        let workspace_table = legacy_workspace_table();
        let query = format!(
            "SELECT id, title, description, path, mounts, chat_ids, council_config,
                    status, logo, metadata, created_at, updated_at
             FROM {workspace_table} WHERE id = ?"
        );
        let result = conn
            .query_row(&query, [id], |row| {
                Ok(Workspace {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    path: row.get(3)?,
                    mounts: row
                        .get::<_, Option<String>>(4)?
                        .and_then(|s| serde_json::from_str(&s).ok())
                        .unwrap_or_default(),
                    chat_ids: row
                        .get::<_, Option<String>>(5)?
                        .and_then(|s| serde_json::from_str(&s).ok())
                        .unwrap_or_default(),
                    council_config: row
                        .get::<_, Option<String>>(6)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    status: row.get(7)?,
                    logo: row.get(8)?,
                    metadata: row
                        .get::<_, Option<String>>(9)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            })
            .optional()?;
        Ok(result)
    }

    pub async fn create_workspace(&self, req: CreateWorkspaceRequest) -> Result<Workspace> {
        let now = chrono::Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;
        let workspace_table = legacy_workspace_table();
        let insert_sql = format!(
            "INSERT INTO {workspace_table} (id, title, description, path, mounts, chat_ids, council_config,
                                  status, logo, metadata, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, '[]', ?, 'active', ?, ?, ?, ?)"
        );

        conn.execute(
            &insert_sql,
            params![
                req.id,
                req.title,
                req.description,
                req.path,
                serde_json::to_string(&req.mounts)?,
                req.council_config
                    .as_ref()
                    .map(|c| serde_json::to_string(c).unwrap_or_default()),
                req.logo,
                req.metadata
                    .as_ref()
                    .map(|m| serde_json::to_string(m).unwrap_or_default()),
                now,
                now
            ],
        )?;

        Ok(Workspace {
            id: req.id,
            title: req.title,
            description: req.description,
            path: req.path,
            mounts: req.mounts,
            chat_ids: vec![],
            council_config: req.council_config,
            status: "active".to_string(),
            logo: req.logo,
            metadata: req.metadata,
            created_at: now,
            updated_at: now,
        })
    }

    pub async fn update_workspace(&self, id: &str, req: UpdateWorkspaceRequest) -> Result<bool> {
        let now = chrono::Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;
        let workspace_table = legacy_workspace_table();

        let mut updates = vec!["updated_at = ?".to_string()];
        let mut values: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now)];

        if let Some(title) = req.title {
            updates.push("title = ?".to_string());
            values.push(Box::new(title));
        }
        if let Some(description) = req.description {
            updates.push("description = ?".to_string());
            values.push(Box::new(description));
        }
        if let Some(path) = req.path {
            updates.push("path = ?".to_string());
            values.push(Box::new(path));
        }
        if let Some(mounts) = req.mounts {
            updates.push("mounts = ?".to_string());
            values.push(Box::new(serde_json::to_string(&mounts)?));
        }
        if let Some(chat_ids) = req.chat_ids {
            updates.push("chat_ids = ?".to_string());
            values.push(Box::new(serde_json::to_string(&chat_ids)?));
        }
        if let Some(council_config) = req.council_config {
            updates.push("council_config = ?".to_string());
            values.push(Box::new(serde_json::to_string(&council_config)?));
        }
        if let Some(status) = req.status {
            updates.push("status = ?".to_string());
            values.push(Box::new(status));
        }
        if let Some(logo) = req.logo {
            updates.push("logo = ?".to_string());
            values.push(Box::new(logo));
        }
        if let Some(metadata) = req.metadata {
            updates.push("metadata = ?".to_string());
            values.push(Box::new(serde_json::to_string(&metadata)?));
        }

        values.push(Box::new(id.to_string()));

        let sql = format!(
            "UPDATE {workspace_table} SET {} WHERE id = ?",
            updates.join(", ")
        );

        let params: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v.as_ref()).collect();
        let affected = conn.execute(&sql, params.as_slice())?;
        Ok(affected > 0)
    }

    pub async fn delete_workspace(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().await;
        let workspace_table = legacy_workspace_table();
        let delete_sql = format!("DELETE FROM {workspace_table} WHERE id = ?");
        let affected = conn.execute(&delete_sql, [id])?;
        Ok(affected > 0)
    }

    // ========================================================================
    // Folder Operations
    // ========================================================================

    pub async fn get_folders(&self) -> Result<Vec<Folder>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn
            .prepare("SELECT id, name, color, created_at, updated_at FROM folders ORDER BY name")?;

        let rows = stmt.query_map([], |row| {
            Ok(Folder {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
            .context("Failed to fetch folders")
    }

    pub async fn create_folder(&self, req: CreateFolderRequest) -> Result<Folder> {
        let now = chrono::Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;

        conn.execute(
            "INSERT INTO folders (id, name, color, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)",
            params![req.id, req.name, req.color, now, now],
        )?;

        Ok(Folder {
            id: req.id,
            name: req.name,
            color: req.color,
            created_at: now,
            updated_at: now,
        })
    }

    pub async fn update_folder(&self, id: &str, req: UpdateFolderRequest) -> Result<bool> {
        let now = chrono::Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;

        let mut updates = vec!["updated_at = ?".to_string()];
        let mut values: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now)];

        if let Some(name) = req.name {
            updates.push("name = ?".to_string());
            values.push(Box::new(name));
        }
        if let Some(color) = req.color {
            updates.push("color = ?".to_string());
            values.push(Box::new(color));
        }

        values.push(Box::new(id.to_string()));

        let sql = format!("UPDATE folders SET {} WHERE id = ?", updates.join(", "));

        let params: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v.as_ref()).collect();
        let affected = conn.execute(&sql, params.as_slice())?;
        Ok(affected > 0)
    }

    pub async fn delete_folder(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().await;
        // Clear folder_id references in chats
        conn.execute(
            "UPDATE chats SET folder_id = NULL WHERE folder_id = ?",
            [id],
        )?;
        let affected = conn.execute("DELETE FROM folders WHERE id = ?", [id])?;
        Ok(affected > 0)
    }

    // ========================================================================
    // Prompt Operations
    // ========================================================================

    pub async fn get_prompts(&self) -> Result<Vec<Prompt>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT id, title, content, tags, created_at, updated_at FROM prompts ORDER BY title",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Prompt {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                tags: row
                    .get::<_, Option<String>>(3)?
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default(),
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
            .context("Failed to fetch prompts")
    }

    pub async fn create_prompt(&self, req: CreatePromptRequest) -> Result<Prompt> {
        let now = chrono::Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;

        conn.execute(
            "INSERT INTO prompts (id, title, content, tags, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)",
            params![
                req.id,
                req.title,
                req.content,
                serde_json::to_string(&req.tags)?,
                now,
                now
            ],
        )?;

        Ok(Prompt {
            id: req.id,
            title: req.title,
            content: req.content,
            tags: req.tags,
            created_at: now,
            updated_at: now,
        })
    }

    pub async fn update_prompt(&self, id: &str, req: UpdatePromptRequest) -> Result<bool> {
        let now = chrono::Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;

        let mut updates = vec!["updated_at = ?".to_string()];
        let mut values: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now)];

        if let Some(title) = req.title {
            updates.push("title = ?".to_string());
            values.push(Box::new(title));
        }
        if let Some(content) = req.content {
            updates.push("content = ?".to_string());
            values.push(Box::new(content));
        }
        if let Some(tags) = req.tags {
            updates.push("tags = ?".to_string());
            values.push(Box::new(serde_json::to_string(&tags)?));
        }

        values.push(Box::new(id.to_string()));

        let sql = format!("UPDATE prompts SET {} WHERE id = ?", updates.join(", "));

        let params: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v.as_ref()).collect();
        let affected = conn.execute(&sql, params.as_slice())?;
        Ok(affected > 0)
    }

    pub async fn delete_prompt(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().await;
        let affected = conn.execute("DELETE FROM prompts WHERE id = ?", [id])?;
        Ok(affected > 0)
    }

    // ========================================================================
    // Stats Operations
    // ========================================================================

    pub async fn get_stats(&self) -> Result<Stats> {
        let conn = self.conn.lock().await;
        let workspace_table = legacy_workspace_table();

        let total_chats: i64 =
            conn.query_row("SELECT COUNT(*) FROM chats", [], |row| row.get(0))?;
        let total_messages: i64 =
            conn.query_row("SELECT COUNT(*) FROM messages", [], |row| row.get(0))?;
        let total_workspaces: i64 = conn.query_row(
            &format!("SELECT COUNT(*) FROM {workspace_table}"),
            [],
            |row| row.get(0),
        )?;
        let total_folders: i64 =
            conn.query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))?;
        let total_prompts: i64 =
            conn.query_row("SELECT COUNT(*) FROM prompts", [], |row| row.get(0))?;

        Ok(Stats {
            total_chats,
            total_messages,
            total_workspaces,
            total_folders,
            total_prompts,
        })
    }

    // ========================================================================
    // Vector Search Operations
    // ========================================================================

    pub async fn store_code_symbol(&self, req: StoreCodeSymbolRequest) -> Result<()> {
        let now = chrono::Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;
        let workspace_path = legacy_workspace_path_column();

        let embedding_blob = req
            .embedding
            .as_ref()
            .map(|e| bincode::serialize(e).unwrap_or_default());
        let insert_sql = format!(
            "INSERT OR REPLACE INTO code_symbols
             (id, {workspace_path}, file_path, name, line, kind, signature, docstring, embedding, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );

        conn.execute(
            &insert_sql,
            params![
                req.id,
                req.workspace_path,
                req.file_path,
                req.name,
                req.line,
                req.kind,
                req.signature,
                req.docstring,
                embedding_blob,
                now
            ],
        )?;

        Ok(())
    }

    pub async fn search_code_symbols(&self, req: VectorSearchRequest) -> Result<Vec<CodeSymbol>> {
        let conn = self.open_read_connection()?;
        let workspace_path = legacy_workspace_path_column();

        let mut sql = format!(
            "SELECT id, {workspace_path}, file_path, name, line, kind, signature, docstring, embedding, created_at
                       FROM code_symbols"
        );

        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref workspace_path_filter) = req.workspace_path {
            sql.push_str(&format!(" WHERE {workspace_path} = ?"));
            params.push(Box::new(workspace_path_filter.clone()));
        }

        let mut stmt = conn.prepare(&sql)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            let embedding_blob: Option<Vec<u8>> = row.get(8)?;
            let embedding: Option<Vec<f32>> =
                embedding_blob.and_then(|b| bincode::deserialize(&b).ok());

            Ok(CodeSymbol {
                id: row.get(0)?,
                workspace_path: row.get(1)?,
                file_path: row.get(2)?,
                name: row.get(3)?,
                line: row.get(4)?,
                kind: row.get(5)?,
                signature: row.get(6)?,
                docstring: row.get(7)?,
                embedding,
                created_at: row.get(9)?,
            })
        })?;

        let mut results: Vec<(f32, CodeSymbol)> = Vec::new();
        for row in rows {
            let symbol = row?;
            if let Some(ref emb) = symbol.embedding {
                let score = cosine_similarity(&req.embedding, emb);
                results.push((score, symbol));
            }
        }

        // Sort by similarity score descending
        results.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(req.limit);

        Ok(results.into_iter().map(|(_, s)| s).collect())
    }

    pub async fn store_semantic_fragment(&self, req: StoreSemanticFragmentRequest) -> Result<()> {
        let now = chrono::Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;
        let workspace_path = legacy_workspace_path_column();

        let embedding_blob = bincode::serialize(&req.embedding)?;
        let insert_sql = format!(
            "INSERT OR REPLACE INTO semantic_fragments
             (id, content, embedding, source, source_id, tags, importance, {workspace_path}, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );

        conn.execute(
            &insert_sql,
            params![
                req.id,
                req.content,
                embedding_blob,
                req.source,
                req.source_id,
                serde_json::to_string(&req.tags)?,
                req.importance,
                req.workspace_path,
                now,
                now
            ],
        )?;

        Ok(())
    }

    pub async fn search_semantic_fragments(
        &self,
        req: VectorSearchRequest,
    ) -> Result<Vec<SemanticFragment>> {
        let conn = self.open_read_connection()?;
        let workspace_path = legacy_workspace_path_column();

        let mut sql = format!(
            "SELECT id, content, embedding, source, source_id, tags, importance, {workspace_path}, created_at, updated_at
                       FROM semantic_fragments"
        );

        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref workspace_path_filter) = req.workspace_path {
            sql.push_str(&format!(" WHERE {workspace_path} = ?"));
            params.push(Box::new(workspace_path_filter.clone()));
        }

        let mut stmt = conn.prepare(&sql)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            let embedding_blob: Vec<u8> = row.get(2)?;
            let embedding: Vec<f32> = bincode::deserialize(&embedding_blob).unwrap_or_default();

            Ok(SemanticFragment {
                id: row.get(0)?,
                content: row.get(1)?,
                embedding,
                source: row.get(3)?,
                source_id: row.get(4)?,
                tags: row
                    .get::<_, Option<String>>(5)?
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default(),
                importance: row.get(6)?,
                workspace_path: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        let mut results: Vec<(f32, SemanticFragment)> = Vec::new();
        for row in rows {
            let fragment = row?;
            let score = cosine_similarity(&req.embedding, &fragment.embedding);
            results.push((score, fragment));
        }

        // Sort by similarity score descending
        results.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(req.limit);

        Ok(results.into_iter().map(|(_, f)| f).collect())
    }

    // ========================================================================
    // Raw Query Operations
    // ========================================================================

    pub async fn execute_query(&self, req: QueryRequest) -> Result<QueryResponse> {
        validate_raw_sql_policy(&req.sql)?;

        let conn = self.conn.lock().await;

        // Convert JSON params to SQLite params
        let params: Vec<Box<dyn rusqlite::ToSql>> = req
            .params
            .iter()
            .map(|v| match v {
                serde_json::Value::Null => {
                    Box::new(Option::<String>::None) as Box<dyn rusqlite::ToSql>
                }
                serde_json::Value::Bool(b) => Box::new(*b as i32) as Box<dyn rusqlite::ToSql>,
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        Box::new(i) as Box<dyn rusqlite::ToSql>
                    } else if let Some(f) = n.as_f64() {
                        Box::new(f) as Box<dyn rusqlite::ToSql>
                    } else {
                        Box::new(n.to_string()) as Box<dyn rusqlite::ToSql>
                    }
                }
                serde_json::Value::String(s) => Box::new(s.clone()) as Box<dyn rusqlite::ToSql>,
                _ => Box::new(v.to_string()) as Box<dyn rusqlite::ToSql>,
            })
            .collect();

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        // Check if it's a SELECT query
        let executable_sql = strip_raw_sql_migration_marker(&req.sql);
        let first_keyword = first_sql_keyword(executable_sql).unwrap_or_default();
        let returns_rows = matches!(first_keyword.as_str(), "SELECT" | "WITH" | "PRAGMA");

        if returns_rows {
            let mut stmt = conn.prepare(executable_sql)?;
            let column_count = stmt.column_count();
            let column_names: Vec<String> = (0..column_count)
                .map(|i| stmt.column_name(i).unwrap_or("").to_string())
                .collect();

            let rows = stmt.query_map(param_refs.as_slice(), |row| {
                let mut obj = serde_json::Map::new();
                for (i, name) in column_names.iter().enumerate() {
                    let value: rusqlite::types::Value = row.get(i)?;
                    let json_value = match value {
                        rusqlite::types::Value::Null => serde_json::Value::Null,
                        rusqlite::types::Value::Integer(i) => serde_json::json!(i),
                        rusqlite::types::Value::Real(f) => serde_json::json!(f),
                        rusqlite::types::Value::Text(s) => serde_json::json!(s),
                        rusqlite::types::Value::Blob(b) => serde_json::json!(
                            base64::Engine::encode(&base64::engine::general_purpose::STANDARD, b)
                        ),
                    };
                    obj.insert(name.clone(), json_value);
                }
                Ok(serde_json::Value::Object(obj))
            })?;

            let result: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
            Ok(QueryResponse {
                rows: result,
                affected_rows: 0,
            })
        } else if req.sql.trim_start().starts_with(RAW_SQL_MIGRATION_MARKER)
            && has_multiple_sql_statements(executable_sql)
        {
            conn.execute_batch(executable_sql)?;
            Ok(QueryResponse {
                rows: vec![],
                affected_rows: 0,
            })
        } else {
            let affected = conn.execute(executable_sql, param_refs.as_slice())?;
            Ok(QueryResponse {
                rows: vec![],
                affected_rows: affected,
            })
        }
    }
}

fn validate_raw_sql_policy(sql: &str) -> Result<()> {
    let trimmed = sql.trim();
    if trimmed.is_empty() {
        bail!("SQL statement must be non-empty");
    }

    let migration_mode = trimmed.starts_with(RAW_SQL_MIGRATION_MARKER);
    if !migration_mode && has_multiple_sql_statements(trimmed) {
        bail!("Raw SQL endpoint accepts exactly one statement");
    }
    let executable_sql = strip_raw_sql_migration_marker(trimmed).trim_start();
    let first_keyword = first_sql_keyword(executable_sql)
        .ok_or_else(|| anyhow::anyhow!("SQL statement must start with a keyword"))?;
    let normalized = executable_sql.to_uppercase();

    if matches!(first_keyword.as_str(), "ATTACH" | "DETACH") {
        bail!("ATTACH and DETACH are not allowed through the raw SQL endpoint");
    }

    if first_keyword == "PRAGMA" {
        validate_raw_pragma_policy(&normalized, migration_mode)?;
        return Ok(());
    }

    if matches!(first_keyword.as_str(), "CREATE" | "ALTER" | "DROP") {
        if migration_mode {
            return Ok(());
        }
        bail!("Schema mutation requires internal migration mode");
    }

    if matches!(
        first_keyword.as_str(),
        "SELECT" | "WITH" | "INSERT" | "UPDATE" | "DELETE" | "REPLACE"
    ) {
        return Ok(());
    }

    bail!("SQL statement type '{}' is not allowed", first_keyword)
}

fn strip_raw_sql_migration_marker(sql: &str) -> &str {
    sql.trim_start()
        .strip_prefix(RAW_SQL_MIGRATION_MARKER)
        .unwrap_or(sql)
        .trim_start()
}

fn first_sql_keyword(sql: &str) -> Option<String> {
    sql.trim_start()
        .split(|ch: char| !ch.is_ascii_alphabetic())
        .find(|part| !part.is_empty())
        .map(|part| part.to_ascii_uppercase())
}

fn validate_raw_pragma_policy(normalized_sql: &str, migration_mode: bool) -> Result<()> {
    if normalized_sql.contains("WRITABLE_SCHEMA") {
        bail!("PRAGMA writable_schema is not allowed");
    }
    if migration_mode {
        return Ok(());
    }
    if normalized_sql.contains('=') {
        bail!("Mutating PRAGMA statements require internal migration mode");
    }

    let allowed_read_pragmas = [
        "PRAGMA TABLE_INFO",
        "PRAGMA INDEX_LIST",
        "PRAGMA INDEX_INFO",
        "PRAGMA FOREIGN_KEY_LIST",
        "PRAGMA DATABASE_LIST",
        "PRAGMA USER_VERSION",
        "PRAGMA SCHEMA_VERSION",
    ];

    if allowed_read_pragmas
        .iter()
        .any(|prefix| normalized_sql.starts_with(prefix))
    {
        return Ok(());
    }

    bail!("PRAGMA statement is not allowed through the raw SQL endpoint")
}

fn has_multiple_sql_statements(sql: &str) -> bool {
    let mut chars = sql.char_indices().peekable();
    let mut in_single_quote = false;
    let mut in_double_quote = false;
    let mut in_line_comment = false;
    let mut in_block_comment = false;

    while let Some((index, ch)) = chars.next() {
        if in_line_comment {
            if ch == '\n' {
                in_line_comment = false;
            }
            continue;
        }
        if in_block_comment {
            if ch == '*' && chars.peek().is_some_and(|(_, next)| *next == '/') {
                let _ = chars.next();
                in_block_comment = false;
            }
            continue;
        }
        if in_single_quote {
            if ch == '\'' {
                if chars.peek().is_some_and(|(_, next)| *next == '\'') {
                    let _ = chars.next();
                } else {
                    in_single_quote = false;
                }
            }
            continue;
        }
        if in_double_quote {
            if ch == '"' {
                in_double_quote = false;
            }
            continue;
        }

        if ch == '-' && chars.peek().is_some_and(|(_, next)| *next == '-') {
            let _ = chars.next();
            in_line_comment = true;
            continue;
        }
        if ch == '/' && chars.peek().is_some_and(|(_, next)| *next == '*') {
            let _ = chars.next();
            in_block_comment = true;
            continue;
        }
        if ch == '\'' {
            in_single_quote = true;
            continue;
        }
        if ch == '"' {
            in_double_quote = true;
            continue;
        }
        if ch == ';' {
            return has_sql_content_after(&sql[index + ch.len_utf8()..]);
        }
    }

    false
}

fn has_sql_content_after(mut sql: &str) -> bool {
    loop {
        sql = sql.trim_start();
        if sql.is_empty() {
            return false;
        }
        if let Some(rest) = sql.strip_prefix("--") {
            if let Some(newline) = rest.find('\n') {
                sql = &rest[newline + 1..];
                continue;
            }
            return false;
        }
        if let Some(rest) = sql.strip_prefix("/*") {
            if let Some(end) = rest.find("*/") {
                sql = &rest[end + 2..];
                continue;
            }
            return false;
        }
        return true;
    }
}

/// Calculate cosine similarity between two vectors
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let dot_product: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        0.0
    } else {
        dot_product / (norm_a * norm_b)
    }
}

#[cfg(test)]
mod tests {
    use super::{validate_raw_sql_policy, RAW_SQL_MIGRATION_MARKER};

    #[test]
    fn raw_sql_policy_allows_single_dml_and_reads() {
        assert!(validate_raw_sql_policy("SELECT * FROM chats LIMIT 1").is_ok());
        assert!(validate_raw_sql_policy("WITH recent AS (SELECT 1) SELECT * FROM recent").is_ok());
        assert!(validate_raw_sql_policy("UPDATE chats SET title = ? WHERE id = ?").is_ok());
        assert!(validate_raw_sql_policy("PRAGMA table_info(chats)").is_ok());
    }

    #[test]
    fn raw_sql_policy_rejects_multi_statement_and_attach() {
        assert!(validate_raw_sql_policy("SELECT 1; SELECT 2").is_err());
        assert!(validate_raw_sql_policy("SELECT ';'; SELECT 2").is_err());
        assert!(validate_raw_sql_policy("ATTACH DATABASE 'x' AS external").is_err());
        assert!(validate_raw_sql_policy("DETACH DATABASE external").is_err());
    }

    #[test]
    fn raw_sql_policy_requires_migration_marker_for_schema_mutation() {
        assert!(validate_raw_sql_policy("CREATE INDEX idx_chats_title ON chats(title)").is_err());
        assert!(validate_raw_sql_policy("ALTER TABLE workspaces ADD COLUMN logo TEXT").is_err());
        assert!(validate_raw_sql_policy("DROP INDEX IF EXISTS idx_chats_title").is_err());

        assert!(validate_raw_sql_policy(&format!(
            "{} CREATE INDEX IF NOT EXISTS idx_chats_title ON chats(title)",
            RAW_SQL_MIGRATION_MARKER
        ))
        .is_ok());
        assert!(validate_raw_sql_policy(&format!(
            "{} ALTER TABLE workspaces ADD COLUMN logo TEXT",
            RAW_SQL_MIGRATION_MARKER
        ))
        .is_ok());
    }

    #[test]
    fn raw_sql_policy_allows_multi_statement_only_with_migration_marker() {
        assert!(validate_raw_sql_policy("CREATE TABLE test_a(id INTEGER); CREATE INDEX test_idx ON test_a(id)").is_err());
        assert!(validate_raw_sql_policy(&format!(
            "{} CREATE TABLE test_a(id INTEGER); CREATE INDEX test_idx ON test_a(id)",
            RAW_SQL_MIGRATION_MARKER
        ))
        .is_ok());
    }

    #[test]
    fn raw_sql_policy_rejects_mutating_or_dangerous_pragmas() {
        assert!(validate_raw_sql_policy("PRAGMA user_version = 2").is_err());
        assert!(validate_raw_sql_policy("PRAGMA writable_schema = ON").is_err());
        assert!(validate_raw_sql_policy(&format!(
            "{} PRAGMA user_version = 2",
            RAW_SQL_MIGRATION_MARKER
        ))
        .is_ok());
        assert!(validate_raw_sql_policy(&format!(
            "{} PRAGMA writable_schema = ON",
            RAW_SQL_MIGRATION_MARKER
        ))
        .is_err());
    }
}
