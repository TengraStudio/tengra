//! Database module - SQLite-based storage with vector search support

use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::types::*;

/// Database wrapper providing thread-safe access to SQLite
pub struct Database {
    conn: Arc<Mutex<Connection>>,
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
        })
    }

    /// Initialize the database schema
    pub async fn initialize(&self) -> Result<()> {
        let conn = self.conn.lock().await;
        self.run_migrations(&conn)?;
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
                .query_row(
                    "SELECT id FROM _migrations WHERE id = ?",
                    [id],
                    |row| row.get(0),
                )
                .optional()?;

            if applied.is_none() {
                tracing::info!("Running migration {}: {}", id, name);
                conn.execute_batch(sql)?;
                conn.execute(
                    "INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)",
                    params![id, name, chrono::Utc::now().timestamp_millis()],
                )?;
            }
        }

        Ok(())
    }

    /// Get all migration definitions
    fn get_migrations(&self) -> Vec<(i32, &str, &str)> {
        vec![
            (1, "initial_schema", r#"
                -- Chats table
                CREATE TABLE IF NOT EXISTS chats (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    is_Generating INTEGER DEFAULT 0,
                    model TEXT,
                    backend TEXT,
                    folder_id TEXT,
                    project_id TEXT,
                    is_pinned INTEGER DEFAULT 0,
                    is_favorite INTEGER DEFAULT 0,
                    is_archived INTEGER DEFAULT 0,
                    metadata TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);
                CREATE INDEX IF NOT EXISTS idx_chats_folder_id ON chats(folder_id);
                CREATE INDEX IF NOT EXISTS idx_chats_project_id ON chats(project_id);

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

                -- Projects table
                CREATE TABLE IF NOT EXISTS projects (
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
                CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
                CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

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
            "#),
            (2, "knowledge_tables", r#"
                -- Code symbols table (for code intelligence)
                CREATE TABLE IF NOT EXISTS code_symbols (
                    id TEXT PRIMARY KEY,
                    project_path TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    name TEXT NOT NULL,
                    line INTEGER NOT NULL,
                    kind TEXT NOT NULL,
                    signature TEXT,
                    docstring TEXT,
                    embedding BLOB,
                    created_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_code_symbols_project_path ON code_symbols(project_path);
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
                    project_id TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_semantic_fragments_source ON semantic_fragments(source);
                CREATE INDEX IF NOT EXISTS idx_semantic_fragments_project_id ON semantic_fragments(project_id);

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
            "#),
            (3, "system_tables", r#"
                -- Council sessions table
                CREATE TABLE IF NOT EXISTS council_sessions (
                    id TEXT PRIMARY KEY,
                    goal TEXT NOT NULL,
                    status TEXT NOT NULL,
                    logs TEXT DEFAULT '[]',
                    agents TEXT DEFAULT '[]',
                    plan TEXT,
                    solution TEXT,
                    model TEXT,
                    provider TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                -- Token usage tracking
                CREATE TABLE IF NOT EXISTS token_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id TEXT,
                    chat_id TEXT,
                    project_id TEXT,
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

                -- Job scheduler state
                CREATE TABLE IF NOT EXISTS job_states (
                    id TEXT PRIMARY KEY,
                    last_run INTEGER,
                    state TEXT
                );

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
            "#),
            (4, "additional_tables", r#"
                -- File diffs table
                CREATE TABLE IF NOT EXISTS file_diffs (
                    id TEXT PRIMARY KEY,
                    project_id TEXT,
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

                -- Scheduler state table (alias for job_states compatibility)
                CREATE TABLE IF NOT EXISTS scheduler_state (
                    id TEXT PRIMARY KEY,
                    last_run INTEGER
                );

                -- Messages vector column (for storing message embeddings)
                ALTER TABLE messages ADD COLUMN vector BLOB;
            "#),
            (5, "rename_project_id_to_project_path", r#"
                -- Rename project_id to project_path in semantic_fragments
                ALTER TABLE semantic_fragments RENAME COLUMN project_id TO project_path;
                DROP INDEX IF EXISTS idx_semantic_fragments_project_id;
                CREATE INDEX IF NOT EXISTS idx_semantic_fragments_project_path ON semantic_fragments(project_path);
            "#),
            (6, "rename_project_id_to_project_path_file_diffs", r#"
                -- Rename project_id to project_path in file_diffs
                ALTER TABLE file_diffs RENAME COLUMN project_id TO project_path;
            "#),
            (7, "rename_project_id_to_project_path_token_usage", r#"
                -- Rename project_id to project_path in token_usage
                ALTER TABLE token_usage RENAME COLUMN project_id TO project_path;
            "#),
        ]
    }

    // ========================================================================
    // Chat Operations
    // ========================================================================

    pub async fn get_all_chats(&self) -> Result<Vec<Chat>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT id, title, model, backend, folder_id, project_id, is_pinned, is_favorite,
                    is_archived, metadata, created_at, updated_at
             FROM chats ORDER BY updated_at DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Chat {
                id: row.get(0)?,
                title: row.get(1)?,
                model: row.get(2)?,
                backend: row.get(3)?,
                folder_id: row.get(4)?,
                project_id: row.get(5)?,
                is_pinned: row.get::<_, i32>(6)? != 0,
                is_favorite: row.get::<_, i32>(7)? != 0,
                is_archived: row.get::<_, i32>(8)? != 0,
                metadata: row.get::<_, Option<String>>(9)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>().context("Failed to fetch chats")
    }

    pub async fn get_chat(&self, id: &str) -> Result<Option<Chat>> {
        let conn = self.conn.lock().await;
        let result = conn.query_row(
            "SELECT id, title, model, backend, folder_id, project_id, is_pinned, is_favorite,
                    is_archived, metadata, created_at, updated_at
             FROM chats WHERE id = ?",
            [id],
            |row| {
                Ok(Chat {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    model: row.get(2)?,
                    backend: row.get(3)?,
                    folder_id: row.get(4)?,
                    project_id: row.get(5)?,
                    is_pinned: row.get::<_, i32>(6)? != 0,
                    is_favorite: row.get::<_, i32>(7)? != 0,
                    is_archived: row.get::<_, i32>(8)? != 0,
                    metadata: row.get::<_, Option<String>>(9)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            },
        ).optional()?;
        Ok(result)
    }

    pub async fn create_chat(&self, req: CreateChatRequest) -> Result<Chat> {
        let now = chrono::Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;

        conn.execute(
            "INSERT INTO chats (id, title, model, backend, folder_id, project_id, is_pinned,
                               is_favorite, is_archived, metadata, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)",
            params![
                req.id,
                req.title,
                req.model,
                req.backend,
                req.folder_id,
                req.project_id,
                req.is_pinned as i32,
                req.is_favorite as i32,
                req.metadata.as_ref().map(|m| serde_json::to_string(m).unwrap_or_default()),
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
            project_id: req.project_id,
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
        if let Some(project_id) = req.project_id {
            updates.push("project_id = ?".to_string());
            values.push(Box::new(project_id));
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

        let sql = format!(
            "UPDATE chats SET {} WHERE id = ?",
            updates.join(", ")
        );

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
             FROM messages WHERE chat_id = ? ORDER BY timestamp ASC"
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
                metadata: row.get::<_, Option<String>>(7)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>().context("Failed to fetch messages")
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

        let sql = format!(
            "UPDATE messages SET {} WHERE id = ?",
            updates.join(", ")
        );

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
    // Project Operations
    // ========================================================================

    pub async fn get_projects(&self) -> Result<Vec<Project>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT id, title, description, path, mounts, chat_ids, council_config,
                    status, metadata, created_at, updated_at
             FROM projects ORDER BY updated_at DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                path: row.get(3)?,
                mounts: row.get::<_, Option<String>>(4)?
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default(),
                chat_ids: row.get::<_, Option<String>>(5)?
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default(),
                council_config: row.get::<_, Option<String>>(6)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
                status: row.get(7)?,
                metadata: row.get::<_, Option<String>>(8)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>().context("Failed to fetch projects")
    }

    pub async fn get_project(&self, id: &str) -> Result<Option<Project>> {
        let conn = self.conn.lock().await;
        let result = conn.query_row(
            "SELECT id, title, description, path, mounts, chat_ids, council_config,
                    status, metadata, created_at, updated_at
             FROM projects WHERE id = ?",
            [id],
            |row| {
                Ok(Project {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    path: row.get(3)?,
                    mounts: row.get::<_, Option<String>>(4)?
                        .and_then(|s| serde_json::from_str(&s).ok())
                        .unwrap_or_default(),
                    chat_ids: row.get::<_, Option<String>>(5)?
                        .and_then(|s| serde_json::from_str(&s).ok())
                        .unwrap_or_default(),
                    council_config: row.get::<_, Option<String>>(6)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    status: row.get(7)?,
                    metadata: row.get::<_, Option<String>>(8)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        ).optional()?;
        Ok(result)
    }

    pub async fn create_project(&self, req: CreateProjectRequest) -> Result<Project> {
        let now = chrono::Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;

        conn.execute(
            "INSERT INTO projects (id, title, description, path, mounts, chat_ids, council_config,
                                  status, metadata, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, '[]', ?, 'active', ?, ?, ?)",
            params![
                req.id,
                req.title,
                req.description,
                req.path,
                serde_json::to_string(&req.mounts)?,
                req.council_config.as_ref().map(|c| serde_json::to_string(c).unwrap_or_default()),
                req.metadata.as_ref().map(|m| serde_json::to_string(m).unwrap_or_default()),
                now,
                now
            ],
        )?;

        Ok(Project {
            id: req.id,
            title: req.title,
            description: req.description,
            path: req.path,
            mounts: req.mounts,
            chat_ids: vec![],
            council_config: req.council_config,
            status: "active".to_string(),
            metadata: req.metadata,
            created_at: now,
            updated_at: now,
        })
    }

    pub async fn update_project(&self, id: &str, req: UpdateProjectRequest) -> Result<bool> {
        let now = chrono::Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;

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
        if let Some(metadata) = req.metadata {
            updates.push("metadata = ?".to_string());
            values.push(Box::new(serde_json::to_string(&metadata)?));
        }

        values.push(Box::new(id.to_string()));

        let sql = format!(
            "UPDATE projects SET {} WHERE id = ?",
            updates.join(", ")
        );

        let params: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v.as_ref()).collect();
        let affected = conn.execute(&sql, params.as_slice())?;
        Ok(affected > 0)
    }

    pub async fn delete_project(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().await;
        let affected = conn.execute("DELETE FROM projects WHERE id = ?", [id])?;
        Ok(affected > 0)
    }

    // ========================================================================
    // Folder Operations
    // ========================================================================

    pub async fn get_folders(&self) -> Result<Vec<Folder>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT id, name, color, created_at, updated_at FROM folders ORDER BY name"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Folder {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>().context("Failed to fetch folders")
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

        let sql = format!(
            "UPDATE folders SET {} WHERE id = ?",
            updates.join(", ")
        );

        let params: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v.as_ref()).collect();
        let affected = conn.execute(&sql, params.as_slice())?;
        Ok(affected > 0)
    }

    pub async fn delete_folder(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().await;
        // Clear folder_id references in chats
        conn.execute("UPDATE chats SET folder_id = NULL WHERE folder_id = ?", [id])?;
        let affected = conn.execute("DELETE FROM folders WHERE id = ?", [id])?;
        Ok(affected > 0)
    }

    // ========================================================================
    // Prompt Operations
    // ========================================================================

    pub async fn get_prompts(&self) -> Result<Vec<Prompt>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT id, title, content, tags, created_at, updated_at FROM prompts ORDER BY title"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Prompt {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                tags: row.get::<_, Option<String>>(3)?
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default(),
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>().context("Failed to fetch prompts")
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

        let sql = format!(
            "UPDATE prompts SET {} WHERE id = ?",
            updates.join(", ")
        );

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

        let total_chats: i64 = conn.query_row(
            "SELECT COUNT(*) FROM chats", [], |row| row.get(0)
        )?;
        let total_messages: i64 = conn.query_row(
            "SELECT COUNT(*) FROM messages", [], |row| row.get(0)
        )?;
        let total_projects: i64 = conn.query_row(
            "SELECT COUNT(*) FROM projects", [], |row| row.get(0)
        )?;
        let total_folders: i64 = conn.query_row(
            "SELECT COUNT(*) FROM folders", [], |row| row.get(0)
        )?;
        let total_prompts: i64 = conn.query_row(
            "SELECT COUNT(*) FROM prompts", [], |row| row.get(0)
        )?;

        Ok(Stats {
            total_chats,
            total_messages,
            total_projects,
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

        let embedding_blob = req.embedding.as_ref().map(|e| bincode::serialize(e).unwrap_or_default());

        conn.execute(
            "INSERT OR REPLACE INTO code_symbols
             (id, project_path, file_path, name, line, kind, signature, docstring, embedding, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                req.id,
                req.project_path,
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
        let conn = self.conn.lock().await;

        let mut sql = "SELECT id, project_path, file_path, name, line, kind, signature, docstring, embedding, created_at
                       FROM code_symbols".to_string();

        if let Some(ref project_path) = req.project_path {
            sql.push_str(&format!(" WHERE project_path = '{}'", project_path));
        }

        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map([], |row| {
            let embedding_blob: Option<Vec<u8>> = row.get(8)?;
            let embedding: Option<Vec<f32>> = embedding_blob
                .and_then(|b| bincode::deserialize(&b).ok());

            Ok(CodeSymbol {
                id: row.get(0)?,
                project_path: row.get(1)?,
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

        let embedding_blob = bincode::serialize(&req.embedding)?;

        conn.execute(
            "INSERT OR REPLACE INTO semantic_fragments
             (id, content, embedding, source, source_id, tags, importance, project_path, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                req.id,
                req.content,
                embedding_blob,
                req.source,
                req.source_id,
                serde_json::to_string(&req.tags)?,
                req.importance,
                req.project_path,
                now,
                now
            ],
        )?;

        Ok(())
    }

    pub async fn search_semantic_fragments(&self, req: VectorSearchRequest) -> Result<Vec<SemanticFragment>> {
        let conn = self.conn.lock().await;

        let mut sql = "SELECT id, content, embedding, source, source_id, tags, importance, project_path, created_at, updated_at
                       FROM semantic_fragments".to_string();

        if let Some(ref project_path) = req.project_path {
            sql.push_str(&format!(" WHERE project_path = '{}'", project_path));
        }

        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map([], |row| {
            let embedding_blob: Vec<u8> = row.get(2)?;
            let embedding: Vec<f32> = bincode::deserialize(&embedding_blob).unwrap_or_default();

            Ok(SemanticFragment {
                id: row.get(0)?,
                content: row.get(1)?,
                embedding,
                source: row.get(3)?,
                source_id: row.get(4)?,
                tags: row.get::<_, Option<String>>(5)?
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default(),
                importance: row.get(6)?,
                project_path: row.get(7)?,
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
        let conn = self.conn.lock().await;

        // Convert JSON params to SQLite params
        let params: Vec<Box<dyn rusqlite::ToSql>> = req.params.iter().map(|v| {
            match v {
                serde_json::Value::Null => Box::new(Option::<String>::None) as Box<dyn rusqlite::ToSql>,
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
            }
        }).collect();

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        // Check if it's a SELECT query
        let is_select = req.sql.trim().to_uppercase().starts_with("SELECT");

        if is_select {
            let mut stmt = conn.prepare(&req.sql)?;
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
                        rusqlite::types::Value::Blob(b) => serde_json::json!(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, b)),
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
        } else {
            let affected = conn.execute(&req.sql, param_refs.as_slice())?;
            Ok(QueryResponse {
                rows: vec![],
                affected_rows: affected,
            })
        }
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
