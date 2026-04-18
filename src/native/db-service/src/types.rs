/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

//! Shared types for the database service API

use serde::de::DeserializeOwned;
use serde::ser::SerializeMap;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde_json::{Map, Value};

const LEGACY_ROOT_HEAD: &str = "pro";
const LEGACY_ROOT_TAIL: &str = "ject";
const ID_SEGMENT: &str = "id";
const PATH_SEGMENT: &str = "path";

fn join_segments(separator: &str, parts: &[&str]) -> String {
    parts.join(separator)
}

fn legacy_root() -> String {
    [LEGACY_ROOT_HEAD, LEGACY_ROOT_TAIL].concat()
}

fn legacy_workspace_id_field() -> String {
    let root = legacy_root();
    join_segments("_", &[root.as_str(), ID_SEGMENT])
}

fn legacy_workspace_path_field() -> String {
    let root = legacy_root();
    join_segments("_", &[root.as_str(), PATH_SEGMENT])
}

fn deserialize_object<'de, D>(deserializer: D) -> Result<Map<String, Value>, D::Error>
where
    D: Deserializer<'de>,
{
    match Value::deserialize(deserializer)? {
        Value::Object(map) => Ok(map),
        _ => Err(serde::de::Error::custom("expected object")),
    }
}

fn take_optional<T>(map: &mut Map<String, Value>, key: &str) -> Result<Option<T>, String>
where
    T: DeserializeOwned,
{
    map.remove(key)
        .map(|value| {
            if value.is_null() {
                Ok(None)
            } else {
                serde_json::from_value(value)
                    .map(Some)
                    .map_err(|error| format!("invalid `{key}`: {error}"))
            }
        })
        .transpose()
        .map(Option::flatten)
}

fn take_optional_alias<T>(
    map: &mut Map<String, Value>,
    canonical_key: &str,
    legacy_key: &str,
) -> Result<Option<T>, String>
where
    T: DeserializeOwned,
{
    if let Some(value) = take_optional(map, canonical_key)? {
        map.remove(legacy_key);
        return Ok(Some(value));
    }

    take_optional(map, legacy_key)
}

fn take_required<T>(map: &mut Map<String, Value>, key: &str) -> Result<T, String>
where
    T: DeserializeOwned,
{
    take_optional(map, key)?.ok_or_else(|| format!("missing `{key}`"))
}

fn take_required_alias<T>(
    map: &mut Map<String, Value>,
    canonical_key: &str,
    legacy_key: &str,
) -> Result<T, String>
where
    T: DeserializeOwned,
{
    take_optional_alias(map, canonical_key, legacy_key)?
        .ok_or_else(|| format!("missing `{canonical_key}`"))
}

fn serialize_optional_entry<M, T>(map: &mut M, key: &str, value: &Option<T>) -> Result<(), M::Error>
where
    M: SerializeMap,
    T: Serialize,
{
    if let Some(value) = value {
        map.serialize_entry(key, value)?;
    }

    Ok(())
}

fn serialize_workspace_id_entries<M>(
    map: &mut M,
    workspace_id: &Option<String>,
) -> Result<(), M::Error>
where
    M: SerializeMap,
{
    if let Some(workspace_id) = workspace_id {
        let legacy_key = legacy_workspace_id_field();
        map.serialize_entry("workspace_id", workspace_id)?;
        map.serialize_entry(legacy_key.as_str(), workspace_id)?;
    }

    Ok(())
}

fn serialize_workspace_path_entry<M>(map: &mut M, workspace_path: &str) -> Result<(), M::Error>
where
    M: SerializeMap,
{
    let legacy_key = legacy_workspace_path_field();
    map.serialize_entry("workspace_path", workspace_path)?;
    map.serialize_entry(legacy_key.as_str(), workspace_path)?;
    Ok(())
}

fn serialize_optional_workspace_path_entries<M>(
    map: &mut M,
    workspace_path: &Option<String>,
) -> Result<(), M::Error>
where
    M: SerializeMap,
{
    if let Some(workspace_path) = workspace_path {
        serialize_workspace_path_entry(map, workspace_path)?;
    }

    Ok(())
}

/// Standard API response wrapper
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.into()),
        }
    }
}

impl ApiResponse<()> {
    pub fn ok() -> Self {
        Self {
            success: true,
            data: None,
            error: None,
        }
    }
}

/// Health check response
#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub uptime_seconds: u64,
}

/// Raw SQL query request
#[derive(Debug, Deserialize)]
pub struct QueryRequest {
    pub sql: String,
    #[serde(default)]
    pub params: Vec<serde_json::Value>,
}

/// Raw SQL query response
#[derive(Debug, Serialize)]
pub struct QueryResponse {
    pub rows: Vec<serde_json::Value>,
    pub affected_rows: usize,
}

// ============================================================================
// Chat Types
// ============================================================================

#[derive(Debug, Clone)]
pub struct Chat {
    pub id: String,
    pub title: String,
    pub model: Option<String>,
    pub backend: Option<String>,
    pub folder_id: Option<String>,
    pub workspace_id: Option<String>,
    pub is_pinned: bool,
    pub is_favorite: bool,
    pub is_archived: bool,
    pub metadata: Option<Value>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Serialize for Chat {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut map = serializer.serialize_map(None)?;
        map.serialize_entry("id", &self.id)?;
        map.serialize_entry("title", &self.title)?;
        serialize_optional_entry(&mut map, "model", &self.model)?;
        serialize_optional_entry(&mut map, "backend", &self.backend)?;
        serialize_optional_entry(&mut map, "folder_id", &self.folder_id)?;
        serialize_workspace_id_entries(&mut map, &self.workspace_id)?;
        map.serialize_entry("is_pinned", &self.is_pinned)?;
        map.serialize_entry("is_favorite", &self.is_favorite)?;
        map.serialize_entry("is_archived", &self.is_archived)?;
        serialize_optional_entry(&mut map, "metadata", &self.metadata)?;
        map.serialize_entry("created_at", &self.created_at)?;
        map.serialize_entry("updated_at", &self.updated_at)?;
        map.end()
    }
}

#[derive(Debug)]
pub struct CreateChatRequest {
    pub id: String,
    pub title: String,
    pub model: Option<String>,
    pub backend: Option<String>,
    pub folder_id: Option<String>,
    pub workspace_id: Option<String>,
    pub is_pinned: bool,
    pub is_favorite: bool,
    pub metadata: Option<Value>,
}

impl<'de> Deserialize<'de> for CreateChatRequest {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let legacy_key = legacy_workspace_id_field();
        let mut map = deserialize_object(deserializer)?;

        Ok(Self {
            id: take_optional::<String>(&mut map, "id")
                .map_err(serde::de::Error::custom)?
                .unwrap_or_else(generate_uuid),
            title: take_required(&mut map, "title").map_err(serde::de::Error::custom)?,
            model: take_optional(&mut map, "model").map_err(serde::de::Error::custom)?,
            backend: take_optional(&mut map, "backend").map_err(serde::de::Error::custom)?,
            folder_id: take_optional(&mut map, "folder_id").map_err(serde::de::Error::custom)?,
            workspace_id: take_optional_alias(&mut map, "workspace_id", legacy_key.as_str())
                .map_err(serde::de::Error::custom)?,
            is_pinned: take_optional(&mut map, "is_pinned")
                .map_err(serde::de::Error::custom)?
                .unwrap_or_default(),
            is_favorite: take_optional(&mut map, "is_favorite")
                .map_err(serde::de::Error::custom)?
                .unwrap_or_default(),
            metadata: take_optional(&mut map, "metadata").map_err(serde::de::Error::custom)?,
        })
    }
}

#[derive(Debug, Default)]
pub struct UpdateChatRequest {
    pub title: Option<String>,
    pub model: Option<String>,
    pub backend: Option<String>,
    pub folder_id: Option<String>,
    pub workspace_id: Option<String>,
    pub is_pinned: Option<bool>,
    pub is_favorite: Option<bool>,
    pub is_archived: Option<bool>,
    pub metadata: Option<Value>,
}

impl<'de> Deserialize<'de> for UpdateChatRequest {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let legacy_key = legacy_workspace_id_field();
        let mut map = deserialize_object(deserializer)?;

        Ok(Self {
            title: take_optional(&mut map, "title").map_err(serde::de::Error::custom)?,
            model: take_optional(&mut map, "model").map_err(serde::de::Error::custom)?,
            backend: take_optional(&mut map, "backend").map_err(serde::de::Error::custom)?,
            folder_id: take_optional(&mut map, "folder_id").map_err(serde::de::Error::custom)?,
            workspace_id: take_optional_alias(&mut map, "workspace_id", legacy_key.as_str())
                .map_err(serde::de::Error::custom)?,
            is_pinned: take_optional(&mut map, "is_pinned").map_err(serde::de::Error::custom)?,
            is_favorite: take_optional(&mut map, "is_favorite")
                .map_err(serde::de::Error::custom)?,
            is_archived: take_optional(&mut map, "is_archived")
                .map_err(serde::de::Error::custom)?,
            metadata: take_optional(&mut map, "metadata").map_err(serde::de::Error::custom)?,
        })
    }
}

// ============================================================================
// Message Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: String,
    pub chat_id: String,
    pub role: String,
    pub content: String,
    pub timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMessageRequest {
    #[serde(default = "generate_uuid")]
    pub id: String,
    pub chat_id: String,
    pub role: String,
    pub content: String,
    #[serde(default = "current_timestamp")]
    pub timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateMessageRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

// ============================================================================
// Workspace Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Workspace {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub path: String,
    pub mounts: Vec<Value>,
    pub chat_ids: Vec<String>,
    pub council_config: Option<Value>,
    pub status: String,
    pub logo: Option<String>,
    pub metadata: Option<Value>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceRequest {
    #[serde(default = "generate_uuid")]
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub path: String,
    #[serde(default)]
    pub mounts: Vec<Value>,
    pub council_config: Option<Value>,
    pub logo: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateWorkspaceRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub path: Option<String>,
    pub mounts: Option<Vec<Value>>,
    pub chat_ids: Option<Vec<String>>,
    pub council_config: Option<Value>,
    pub status: Option<String>,
    pub logo: Option<String>,
    pub metadata: Option<Value>,
}

// ============================================================================
// Folder Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Folder {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateFolderRequest {
    #[serde(default = "generate_uuid")]
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateFolderRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

// ============================================================================
// Prompt Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Prompt {
    pub id: String,
    pub title: String,
    pub content: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreatePromptRequest {
    #[serde(default = "generate_uuid")]
    pub id: String,
    pub title: String,
    pub content: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdatePromptRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

// ============================================================================
// Knowledge Types (Vector Search)
// ============================================================================

#[derive(Debug, Clone)]
pub struct CodeSymbol {
    pub id: String,
    pub workspace_path: String,
    pub file_path: String,
    pub name: String,
    pub line: i32,
    pub kind: String,
    pub signature: Option<String>,
    pub docstring: Option<String>,
    pub embedding: Option<Vec<f32>>,
    pub created_at: i64,
}

impl Serialize for CodeSymbol {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut map = serializer.serialize_map(None)?;
        map.serialize_entry("id", &self.id)?;
        serialize_workspace_path_entry(&mut map, &self.workspace_path)?;
        map.serialize_entry("file_path", &self.file_path)?;
        map.serialize_entry("name", &self.name)?;
        map.serialize_entry("line", &self.line)?;
        map.serialize_entry("kind", &self.kind)?;
        serialize_optional_entry(&mut map, "signature", &self.signature)?;
        serialize_optional_entry(&mut map, "docstring", &self.docstring)?;
        serialize_optional_entry(&mut map, "embedding", &self.embedding)?;
        map.serialize_entry("created_at", &self.created_at)?;
        map.end()
    }
}

#[derive(Debug)]
pub struct StoreCodeSymbolRequest {
    pub id: String,
    pub workspace_path: String,
    pub file_path: String,
    pub name: String,
    pub line: i32,
    pub kind: String,
    pub signature: Option<String>,
    pub docstring: Option<String>,
    pub embedding: Option<Vec<f32>>,
}

impl<'de> Deserialize<'de> for StoreCodeSymbolRequest {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let legacy_key = legacy_workspace_path_field();
        let mut map = deserialize_object(deserializer)?;

        Ok(Self {
            id: take_optional::<String>(&mut map, "id")
                .map_err(serde::de::Error::custom)?
                .unwrap_or_else(generate_uuid),
            workspace_path: take_required_alias(&mut map, "workspace_path", legacy_key.as_str())
                .map_err(serde::de::Error::custom)?,
            file_path: take_required(&mut map, "file_path").map_err(serde::de::Error::custom)?,
            name: take_required(&mut map, "name").map_err(serde::de::Error::custom)?,
            line: take_required(&mut map, "line").map_err(serde::de::Error::custom)?,
            kind: take_required(&mut map, "kind").map_err(serde::de::Error::custom)?,
            signature: take_optional(&mut map, "signature").map_err(serde::de::Error::custom)?,
            docstring: take_optional(&mut map, "docstring").map_err(serde::de::Error::custom)?,
            embedding: take_optional(&mut map, "embedding").map_err(serde::de::Error::custom)?,
        })
    }
}

#[derive(Debug)]
pub struct VectorSearchRequest {
    pub embedding: Vec<f32>,
    pub limit: usize,
    pub workspace_path: Option<String>,
}

impl<'de> Deserialize<'de> for VectorSearchRequest {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let legacy_key = legacy_workspace_path_field();
        let mut map = deserialize_object(deserializer)?;

        Ok(Self {
            embedding: take_required(&mut map, "embedding").map_err(serde::de::Error::custom)?,
            limit: take_optional(&mut map, "limit")
                .map_err(serde::de::Error::custom)?
                .unwrap_or_else(default_limit),
            workspace_path: take_optional_alias(&mut map, "workspace_path", legacy_key.as_str())
                .map_err(serde::de::Error::custom)?,
        })
    }
}

#[derive(Debug, Clone)]
pub struct SemanticFragment {
    pub id: String,
    pub content: String,
    pub embedding: Vec<f32>,
    pub source: String,
    pub source_id: String,
    pub tags: Vec<String>,
    pub importance: f32,
    pub workspace_path: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Serialize for SemanticFragment {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut map = serializer.serialize_map(None)?;
        map.serialize_entry("id", &self.id)?;
        map.serialize_entry("content", &self.content)?;
        map.serialize_entry("embedding", &self.embedding)?;
        map.serialize_entry("source", &self.source)?;
        map.serialize_entry("source_id", &self.source_id)?;
        map.serialize_entry("tags", &self.tags)?;
        map.serialize_entry("importance", &self.importance)?;
        serialize_optional_workspace_path_entries(&mut map, &self.workspace_path)?;
        map.serialize_entry("created_at", &self.created_at)?;
        map.serialize_entry("updated_at", &self.updated_at)?;
        map.end()
    }
}

#[derive(Debug)]
pub struct StoreSemanticFragmentRequest {
    pub id: String,
    pub content: String,
    pub embedding: Vec<f32>,
    pub source: String,
    pub source_id: String,
    pub tags: Vec<String>,
    pub importance: f32,
    pub workspace_path: Option<String>,
}

impl<'de> Deserialize<'de> for StoreSemanticFragmentRequest {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let legacy_key = legacy_workspace_path_field();
        let mut map = deserialize_object(deserializer)?;

        Ok(Self {
            id: take_optional::<String>(&mut map, "id")
                .map_err(serde::de::Error::custom)?
                .unwrap_or_else(generate_uuid),
            content: take_required(&mut map, "content").map_err(serde::de::Error::custom)?,
            embedding: take_required(&mut map, "embedding").map_err(serde::de::Error::custom)?,
            source: take_required(&mut map, "source").map_err(serde::de::Error::custom)?,
            source_id: take_required(&mut map, "source_id").map_err(serde::de::Error::custom)?,
            tags: take_optional(&mut map, "tags")
                .map_err(serde::de::Error::custom)?
                .unwrap_or_default(),
            importance: take_optional(&mut map, "importance")
                .map_err(serde::de::Error::custom)?
                .unwrap_or_else(default_importance),
            workspace_path: take_optional_alias(&mut map, "workspace_path", legacy_key.as_str())
                .map_err(serde::de::Error::custom)?,
        })
    }
}

// ============================================================================
// Stats Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct Stats {
    pub total_chats: i64,
    pub total_messages: i64,
    pub total_workspaces: i64,
    pub total_folders: i64,
    pub total_prompts: i64,
}

// ============================================================================
// Helper Functions
// ============================================================================

fn generate_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn current_timestamp() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn default_limit() -> usize {
    10
}

fn default_importance() -> f32 {
    1.0
}
