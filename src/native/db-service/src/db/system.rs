/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

use crate::db::migrations::legacy_workspace_table;
use crate::db::Database;
use crate::types::*;
use anyhow::{bail, Context, Result};
use rusqlite::params;

pub const RAW_SQL_MIGRATION_MARKER: &str = "/* tengra-internal-migration */";

impl Database {
    pub async fn get_folders(&self) -> Result<Vec<Folder>> {
        self.execute(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, color, created_at, updated_at FROM folders ORDER BY name",
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

            let mut folders = Vec::new();
            for folder in rows {
                folders.push(folder?);
            }
            Ok(folders)
        })
        .await
        .context("Failed to fetch folders")
    }

    pub async fn create_folder(&self, req: CreateFolderRequest) -> Result<Folder> {
        let now = chrono::Utc::now().timestamp_millis();
        let folder = Folder {
            id: req.id,
            name: req.name,
            color: req.color,
            created_at: now,
            updated_at: now,
        };

        let folder_clone = folder.clone();
        self.execute_mut(move |conn| {
            conn.execute(
                "INSERT INTO folders (id, name, color, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?)",
                params![
                    folder_clone.id,
                    folder_clone.name,
                    folder_clone.color,
                    folder_clone.created_at,
                    folder_clone.updated_at
                ],
            )?;
            Ok(())
        })
        .await?;

        Ok(folder)
    }

    pub async fn update_folder(&self, id: &str, req: UpdateFolderRequest) -> Result<bool> {
        let id = id.to_string();
        self.execute_mut(move |conn| {
            let mut sets = Vec::new();
            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if let Some(name) = req.name {
                sets.push("name = ?");
                params_vec.push(Box::new(name));
            }
            if let Some(color) = req.color {
                sets.push("color = ?");
                params_vec.push(Box::new(color));
            }

            if sets.is_empty() {
                return Ok(true);
            }

            sets.push("updated_at = ?");
            params_vec.push(Box::new(chrono::Utc::now().timestamp_millis()));

            let query = format!("UPDATE folders SET {} WHERE id = ?", sets.join(", "));
            params_vec.push(Box::new(id));

            let param_refs: Vec<&dyn rusqlite::ToSql> =
                params_vec.iter().map(|p| p.as_ref()).collect();
            let affected = conn.execute(&query, param_refs.as_slice())?;
            Ok(affected > 0)
        })
        .await
    }

    pub async fn delete_folder(&self, id: &str) -> Result<bool> {
        let id = id.to_string();
        self.execute_mut(move |conn| {
            // Clear folder_id references in chats
            conn.execute(
                "UPDATE chats SET folder_id = NULL WHERE folder_id = ?",
                [id.clone()],
            )?;
            let affected = conn.execute("DELETE FROM folders WHERE id = ?", [id])?;
            Ok(affected > 0)
        })
        .await
    }

    pub async fn get_prompts(&self) -> Result<Vec<Prompt>> {
        self.execute(|conn| {
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

            let mut prompts = Vec::new();
            for prompt in rows {
                prompts.push(prompt?);
            }
            Ok(prompts)
        })
        .await
        .context("Failed to fetch prompts")
    }

    pub async fn create_prompt(&self, req: CreatePromptRequest) -> Result<Prompt> {
        let now = chrono::Utc::now().timestamp_millis();
        let prompt = Prompt {
            id: req.id,
            title: req.title,
            content: req.content,
            tags: req.tags,
            created_at: now,
            updated_at: now,
        };

        let p_clone = prompt.clone();
        self.execute_mut(move |conn| {
            conn.execute(
                "INSERT INTO prompts (id, title, content, tags, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)",
                params![
                    p_clone.id,
                    p_clone.title,
                    p_clone.content,
                    serde_json::to_string(&p_clone.tags)?,
                    p_clone.created_at,
                    p_clone.updated_at
                ],
            )?;
            Ok(())
        })
        .await?;

        Ok(prompt)
    }

    pub async fn update_prompt(&self, id: &str, req: UpdatePromptRequest) -> Result<bool> {
        let id = id.to_string();
        self.execute_mut(move |conn| {
            let mut sets = Vec::new();
            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if let Some(title) = req.title {
                sets.push("title = ?");
                params_vec.push(Box::new(title));
            }
            if let Some(content) = req.content {
                sets.push("content = ?");
                params_vec.push(Box::new(content));
            }
            if let Some(tags) = req.tags {
                sets.push("tags = ?");
                params_vec.push(Box::new(serde_json::to_string(&tags)?));
            }

            if sets.is_empty() {
                return Ok(true);
            }

            sets.push("updated_at = ?");
            params_vec.push(Box::new(chrono::Utc::now().timestamp_millis()));

            let query = format!("UPDATE prompts SET {} WHERE id = ?", sets.join(", "));
            params_vec.push(Box::new(id));

            let param_refs: Vec<&dyn rusqlite::ToSql> =
                params_vec.iter().map(|p| p.as_ref()).collect();
            let affected = conn.execute(&query, param_refs.as_slice())?;
            Ok(affected > 0)
        })
        .await
    }

    pub async fn delete_prompt(&self, id: &str) -> Result<bool> {
        let id = id.to_string();
        self.execute_mut(move |conn| {
            let affected = conn.execute("DELETE FROM prompts WHERE id = ?", [id])?;
            Ok(affected > 0)
        })
        .await
    }

    pub async fn get_stats(&self) -> Result<Stats> {
        self.execute(|conn| {
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
        })
        .await
        .context("Failed to fetch stats")
    }

    pub async fn execute_query(&self, req: QueryRequest) -> Result<QueryResponse> {
        validate_raw_sql_policy(&req.sql)?;

        let sql = req.sql.clone();
        let json_params = req.params.clone();

        self.execute_mut(move |conn| {
            // Convert JSON params to SQLite params
            let params: Vec<Box<dyn rusqlite::ToSql>> = json_params
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

            let executable_sql = strip_raw_sql_migration_marker(&sql);
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
                            rusqlite::types::Value::Blob(b) => {
                                serde_json::json!(base64::Engine::encode(
                                    &base64::engine::general_purpose::STANDARD,
                                    b
                                ))
                            }
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
            } else if sql.trim_start().starts_with(RAW_SQL_MIGRATION_MARKER)
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
        })
        .await
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
