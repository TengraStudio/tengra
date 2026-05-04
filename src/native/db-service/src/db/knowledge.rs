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
use rusqlite::params;
use crate::db::Database;
use crate::db::migrations::legacy_workspace_path_column;
use crate::types::*;
use rayon::prelude::*;

impl Database {
    pub async fn store_code_symbol(&self, req: StoreCodeSymbolRequest) -> Result<()> {
        let now = chrono::Utc::now().timestamp_millis();
        let embedding_blob = req
            .embedding
            .as_ref()
            .map(|e| bincode::serialize(e).unwrap_or_default());
        
        self.execute_mut(move |conn| {
            let workspace_path = legacy_workspace_path_column();
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
        })
        .await
    }

    pub async fn search_code_symbols(&self, req: VectorSearchRequest) -> Result<Vec<CodeSymbol>> {
        let workspace_path_filter = req.workspace_path.clone();
        let query_embedding = req.embedding.clone();
        let limit = req.limit;

        self.execute(move |conn| {
            let workspace_path = legacy_workspace_path_column();
            let mut sql = format!(
                "SELECT id, {workspace_path}, file_path, name, line, kind, signature, docstring, embedding, created_at
                 FROM code_symbols"
            );

            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
            if let Some(ref filter) = workspace_path_filter {
                sql.push_str(&format!(" WHERE {workspace_path} = ?"));
                params_vec.push(Box::new(filter.clone()));
            }

            let mut stmt = conn.prepare(&sql)?;
            let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
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

            let mut results: Vec<(f32, CodeSymbol)> = rows
                .collect::<Result<Vec<_>, _>>()?
                .into_par_iter()
                .filter_map(|symbol| {
                    if let Some(ref emb) = symbol.embedding {
                        let score = cosine_similarity(&query_embedding, emb);
                        Some((score, symbol))
                    } else {
                        None
                    }
                })
                .collect();

            results.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
            results.truncate(limit);

            Ok(results.into_iter().map(|(_, s)| s).collect())
        })
        .await
        .context("Failed to search code symbols")
    }

    pub async fn store_semantic_fragment(&self, req: StoreSemanticFragmentRequest) -> Result<()> {
        let now = chrono::Utc::now().timestamp_millis();
        let embedding_blob = bincode::serialize(&req.embedding)?;

        self.execute_mut(move |conn| {
            let workspace_path = legacy_workspace_path_column();
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
        })
        .await
    }

    pub async fn search_semantic_fragments(&self, req: VectorSearchRequest) -> Result<Vec<SemanticFragment>> {
        let workspace_path_filter = req.workspace_path.clone();
        let query_embedding = req.embedding.clone();
        let limit = req.limit;

        self.execute(move |conn| {
            let workspace_path = legacy_workspace_path_column();
            let mut sql = format!(
                "SELECT id, content, embedding, source, source_id, tags, importance, {workspace_path}, created_at, updated_at
                 FROM semantic_fragments"
            );

            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
            if let Some(ref filter) = workspace_path_filter {
                sql.push_str(&format!(" WHERE {workspace_path} = ?"));
                params_vec.push(Box::new(filter.clone()));
            }

            let mut stmt = conn.prepare(&sql)?;
            let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
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

            let mut results: Vec<(f32, SemanticFragment)> = rows
                .collect::<Result<Vec<_>, _>>()?
                .into_par_iter()
                .map(|fragment| {
                    let score = cosine_similarity(&query_embedding, &fragment.embedding);
                    (score, fragment)
                })
                .collect();

            results.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
            results.truncate(limit);

            Ok(results.into_iter().map(|(_, f)| f).collect())
        })
        .await
        .context("Failed to search semantic fragments")
    }

    pub async fn store_memory(&self, req: StoreMemoryRequest) -> Result<()> {
        let now = chrono::Utc::now().timestamp_millis();
        let embedding_blob = req
            .embedding
            .as_ref()
            .map(|e| bincode::serialize(e).unwrap_or_default());

        self.execute_mut(move |conn| {
            conn.execute(
                "INSERT OR REPLACE INTO advanced_memories 
                 (id, content, embedding, metadata, importance, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
                params![
                    req.id,
                    req.content,
                    embedding_blob,
                    serde_json::to_string(&req.metadata)?,
                    req.importance,
                    now,
                    now
                ],
            )?;
            Ok(())
        })
        .await
    }

    pub async fn search_memories(&self, req: VectorSearchRequest) -> Result<Vec<Memory>> {
        let query_embedding = req.embedding.clone();
        let limit = req.limit;

        self.execute(move |conn| {
            let mut stmt = conn.prepare(
                "SELECT id, content, embedding, metadata, importance, created_at, updated_at
                 FROM advanced_memories",
            )?;

            let rows = stmt.query_map([], |row| {
                let embedding_blob: Option<Vec<u8>> = row.get(2)?;
                let embedding: Option<Vec<f32>> =
                    embedding_blob.and_then(|b| bincode::deserialize(&b).ok());

                Ok(Memory {
                    id: row.get(0)?,
                    content: row.get(1)?,
                    embedding,
                    metadata: row
                        .get::<_, Option<String>>(3)?
                        .and_then(|s| serde_json::from_str(&s).ok())
                        .unwrap_or_default(),
                    importance: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })?;

            let mut results: Vec<(f32, Memory)> = rows
                .collect::<Result<Vec<_>, _>>()?
                .into_par_iter()
                .filter_map(|memory| {
                    if let Some(ref emb) = memory.embedding {
                        let score = cosine_similarity(&query_embedding, emb);
                        Some((score, memory))
                    } else {
                        None
                    }
                })
                .collect();

            results.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
            results.truncate(limit);

            Ok(results.into_iter().map(|(_, m)| m).collect())
        })
        .await
        .context("Failed to search memories")
    }
}

fn cosine_similarity(v1: &[f32], v2: &[f32]) -> f32 {
    let len = v1.len().min(v2.len());
    if len == 0 {
        return 0.0;
    }

    let mut dot_product = 0.0;
    let mut norm1 = 0.0;
    let mut norm2 = 0.0;

    for i in 0..len {
        let a = v1[i];
        let b = v2[i];
        dot_product += a * b;
        norm1 += a * a;
        norm2 += b * b;
    }

    if norm1 <= 0.0 || norm2 <= 0.0 {
        return 0.0;
    }

    dot_product / (norm1 * norm2).sqrt()
}
