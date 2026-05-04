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
use rusqlite::{params, OptionalExtension};
use crate::db::Database;
use crate::db::migrations::legacy_workspace_id_column;
use crate::types::*;

impl Database {
    pub async fn get_all_chats(&self) -> Result<Vec<Chat>> {
        self.execute(|conn| {
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

            let mut chats = Vec::new();
            for chat in rows {
                chats.push(chat?);
            }
            Ok(chats)
        })
        .await
        .context("Failed to fetch chats")
    }

    pub async fn get_chat(&self, id: &str) -> Result<Option<Chat>> {
        let id = id.to_string();
        self.execute(move |conn| {
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
        })
        .await
    }

    pub async fn create_chat(&self, req: CreateChatRequest) -> Result<Chat> {
        let now = chrono::Utc::now().timestamp_millis();
        let chat = Chat {
            id: uuid::Uuid::new_v4().to_string(),
            title: req.title,
            model: req.model,
            backend: req.backend,
            folder_id: req.folder_id,
            workspace_id: req.workspace_id,
            is_pinned: false,
            is_favorite: false,
            is_archived: false,
            metadata: req.metadata,
            created_at: now,
            updated_at: now,
        };

        let chat_clone = chat.clone();
        self.execute_mut(move |conn| {
            let workspace_id = legacy_workspace_id_column();
            let insert_sql = format!(
                "INSERT INTO chats (id, title, model, backend, folder_id, {workspace_id}, 
                                  is_pinned, is_favorite, is_archived, metadata, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );

            conn.execute(
                &insert_sql,
                params![
                    chat_clone.id,
                    chat_clone.title,
                    chat_clone.model,
                    chat_clone.backend,
                    chat_clone.folder_id,
                    chat_clone.workspace_id,
                    chat_clone.is_pinned as i32,
                    chat_clone.is_favorite as i32,
                    chat_clone.is_archived as i32,
                    serde_json::to_string(&chat_clone.metadata)?,
                    chat_clone.created_at,
                    chat_clone.updated_at
                ],
            )?;
            Ok(())
        })
        .await?;

        Ok(chat)
    }

    pub async fn update_chat(&self, id: &str, req: UpdateChatRequest) -> Result<bool> {
        let id = id.to_string();
        self.execute_mut(move |conn| {
            let mut sets = Vec::new();
            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if let Some(title) = req.title {
                sets.push("title = ?");
                params_vec.push(Box::new(title));
            }
            if let Some(folder_id) = req.folder_id {
                sets.push("folder_id = ?");
                params_vec.push(Box::new(folder_id));
            }
            if let Some(pinned) = req.is_pinned {
                sets.push("is_pinned = ?");
                params_vec.push(Box::new(pinned as i32));
            }
            if let Some(favorite) = req.is_favorite {
                sets.push("is_favorite = ?");
                params_vec.push(Box::new(favorite as i32));
            }
            if let Some(archived) = req.is_archived {
                sets.push("is_archived = ?");
                params_vec.push(Box::new(archived as i32));
            }
            if let Some(metadata) = req.metadata {
                sets.push("metadata = ?");
                params_vec.push(Box::new(serde_json::to_string(&metadata)?));
            }

            if sets.is_empty() {
                return Ok(true);
            }

            sets.push("updated_at = ?");
            params_vec.push(Box::new(chrono::Utc::now().timestamp_millis()));

            let query = format!("UPDATE chats SET {} WHERE id = ?", sets.join(", "));
            params_vec.push(Box::new(id));

            let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
            let affected = conn.execute(&query, param_refs.as_slice())?;
            Ok(affected > 0)
        })
        .await
    }

    pub async fn delete_chat(&self, id: &str) -> Result<bool> {
        let id = id.to_string();
        self.execute_mut(move |conn| {
            // Delete messages first (foreign key cascade might not be on)
            conn.execute("DELETE FROM messages WHERE chat_id = ?", [id.clone()])?;
            let affected = conn.execute("DELETE FROM chats WHERE id = ?", [id])?;
            Ok(affected > 0)
        })
        .await
    }

    pub async fn get_messages(&self, chat_id: &str) -> Result<Vec<Message>> {
        let chat_id = chat_id.to_string();
        self.execute(move |conn| {
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

            let mut messages = Vec::new();
            for msg in rows {
                messages.push(msg?);
            }
            Ok(messages)
        })
        .await
        .context("Failed to fetch messages")
    }

    pub async fn add_message(&self, req: CreateMessageRequest) -> Result<Message> {
        let message = Message {
            id: req.id,
            chat_id: req.chat_id,
            role: req.role,
            content: req.content,
            timestamp: req.timestamp,
            provider: req.provider,
            model: req.model,
            metadata: req.metadata,
        };

        let msg_clone = message.clone();
        self.execute_mut(move |conn| {
            conn.execute(
                "INSERT INTO messages (id, chat_id, role, content, timestamp, provider, model, metadata)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    msg_clone.id,
                    msg_clone.chat_id,
                    msg_clone.role,
                    msg_clone.content,
                    msg_clone.timestamp,
                    msg_clone.provider,
                    msg_clone.model,
                    serde_json::to_string(&msg_clone.metadata)?,
                ],
            )?;
            Ok(())
        })
        .await?;

        Ok(message)
    }

    pub async fn update_message(&self, id: &str, req: UpdateMessageRequest) -> Result<bool> {
        let id = id.to_string();
        self.execute_mut(move |conn| {
            let mut sets = Vec::new();
            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            if let Some(content) = req.content {
                sets.push("content = ?");
                params_vec.push(Box::new(content));
            }
            if let Some(metadata) = req.metadata {
                sets.push("metadata = ?");
                params_vec.push(Box::new(serde_json::to_string(&metadata)?));
            }

            if sets.is_empty() {
                return Ok(true);
            }

            let query = format!("UPDATE messages SET {} WHERE id = ?", sets.join(", "));
            params_vec.push(Box::new(id));

            let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
            let affected = conn.execute(&query, param_refs.as_slice())?;
            Ok(affected > 0)
        })
        .await
    }

    pub async fn delete_message(&self, id: &str) -> Result<bool> {
        let id = id.to_string();
        self.execute_mut(move |conn| {
            let affected = conn.execute("DELETE FROM messages WHERE id = ?", [id])?;
            Ok(affected > 0)
        })
        .await
    }
}
