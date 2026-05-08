/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

use tempfile::tempdir;
use tengra_db_service::db::Database;
use tengra_db_service::types::*;

#[tokio::test]
async fn test_database_lifecycle_and_crud() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("test.db");

    let db = Database::new(&db_path).expect("Failed to create database");
    db.initialize()
        .await
        .expect("Failed to initialize database");

    // Test Chat CRUD
    let create_req = CreateChatRequest {
        title: "Test Chat".to_string(),
        model: "gpt-4".to_string(),
        backend: "openai".to_string(),
        folder_id: None,
        workspace_id: None,
        metadata: None,
    };

    let chat = db
        .create_chat(create_req)
        .await
        .expect("Failed to create chat");
    assert_eq!(chat.title, "Test Chat");

    let fetched = db.get_chat(&chat.id).await.expect("Failed to get chat");
    assert!(fetched.is_some());
    assert_eq!(fetched.unwrap().id, chat.id);

    let all_chats = db.get_all_chats().await.expect("Failed to get all chats");
    assert!(!all_chats.is_empty());

    let update_req = UpdateChatRequest {
        title: Some("Updated Chat".to_string()),
        ..Default::default()
    };
    db.update_chat(&chat.id, update_req)
        .await
        .expect("Failed to update chat");

    let updated = db
        .get_chat(&chat.id)
        .await
        .expect("Failed to get chat")
        .unwrap();
    assert_eq!(updated.title, "Updated Chat");

    // Test Query Policy
    let query_req = QueryRequest {
        sql: "SELECT * FROM chats".to_string(),
        params: vec![],
    };
    let query_res = db
        .execute_query(query_req)
        .await
        .expect("Failed to execute query");
    assert!(!query_res.rows.is_empty());

    // Test Blocked Query
    let blocked_req = QueryRequest {
        sql: "DROP TABLE chats".to_string(),
        params: vec![],
    };
    let blocked_res = db.execute_query(blocked_req).await;
    assert!(
        blocked_res.is_err(),
        "DROP TABLE should be blocked without migration marker"
    );

    // Test Delete
    db.delete_chat(&chat.id)
        .await
        .expect("Failed to delete chat");
    let after_delete = db.get_chat(&chat.id).await.expect("Failed to get chat");
    assert!(after_delete.is_none());
}
