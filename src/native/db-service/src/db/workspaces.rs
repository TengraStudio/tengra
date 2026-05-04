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
use crate::db::migrations::legacy_workspace_table;
use crate::types::*;

impl Database {
    pub async fn get_workspaces(&self) -> Result<Vec<Workspace>> {
        self.execute(|conn| {
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

            let mut workspaces = Vec::new();
            for ws in rows {
                workspaces.push(ws?);
            }
            Ok(workspaces)
        })
        .await
        .context("Failed to fetch workspaces")
    }

    pub async fn get_workspace(&self, id: &str) -> Result<Option<Workspace>> {
        let id = id.to_string();
        self.execute(move |conn| {
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
        })
        .await
    }

    pub async fn upsert_workspace(&self, ws: Workspace) -> Result<Workspace> {
        let ws_clone = ws.clone();
        self.execute_mut(move |conn| {
            let workspace_table = legacy_workspace_table();
            let upsert_sql = format!(
                "INSERT INTO {workspace_table} (id, title, description, path, mounts, chat_ids, 
                                              council_config, status, logo, metadata, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    description = excluded.description,
                    path = excluded.path,
                    mounts = excluded.mounts,
                    chat_ids = excluded.chat_ids,
                    council_config = excluded.council_config,
                    status = excluded.status,
                    logo = excluded.logo,
                    metadata = excluded.metadata,
                    updated_at = excluded.updated_at"
            );

            conn.execute(
                &upsert_sql,
                params![
                    ws_clone.id,
                    ws_clone.title,
                    ws_clone.description,
                    ws_clone.path,
                    serde_json::to_string(&ws_clone.mounts)?,
                    serde_json::to_string(&ws_clone.chat_ids)?,
                    serde_json::to_string(&ws_clone.council_config)?,
                    ws_clone.status,
                    ws_clone.logo,
                    serde_json::to_string(&ws_clone.metadata)?,
                    ws_clone.created_at,
                    ws_clone.updated_at
                ],
            )?;
            Ok(())
        })
        .await?;

        Ok(ws)
    }

    pub async fn create_workspace(&self, req: CreateWorkspaceRequest) -> Result<Workspace> {
        let now = chrono::Utc::now().timestamp_millis();
        let workspace = Workspace {
            id: req.id,
            title: req.title,
            description: req.description,
            path: req.path,
            mounts: req.mounts,
            chat_ids: Vec::new(),
            council_config: req.council_config,
            status: "active".to_string(),
            logo: req.logo,
            metadata: req.metadata,
            created_at: now,
            updated_at: now,
        };

        self.upsert_workspace(workspace).await
    }

    pub async fn update_workspace(&self, id: &str, req: UpdateWorkspaceRequest) -> Result<bool> {
        let existing = self.get_workspace(id).await?;
        let Some(mut workspace) = existing else {
            return Ok(false);
        };

        if let Some(title) = req.title {
            workspace.title = title;
        }
        if let Some(description) = req.description {
            workspace.description = Some(description);
        }
        if let Some(path) = req.path {
            workspace.path = path;
        }
        if let Some(mounts) = req.mounts {
            workspace.mounts = mounts;
        }
        if let Some(chat_ids) = req.chat_ids {
            workspace.chat_ids = chat_ids;
        }
        if let Some(council_config) = req.council_config {
            workspace.council_config = Some(council_config);
        }
        if let Some(status) = req.status {
            workspace.status = status;
        }
        if let Some(logo) = req.logo {
            workspace.logo = Some(logo);
        }
        if let Some(metadata) = req.metadata {
            workspace.metadata = Some(metadata);
        }
        workspace.updated_at = chrono::Utc::now().timestamp_millis();

        self.upsert_workspace(workspace).await?;
        Ok(true)
    }

    pub async fn delete_workspace(&self, id: &str) -> Result<bool> {
        let id = id.to_string();
        self.execute_mut(move |conn| {
            let workspace_table = legacy_workspace_table();
            let affected = conn.execute(&format!("DELETE FROM {workspace_table} WHERE id = ?"), [id])?;
            Ok(affected > 0)
        })
        .await
    }
}
