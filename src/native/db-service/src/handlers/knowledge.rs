/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

//! Knowledge and vector search handlers

use axum::{extract::State, Json};
use std::sync::Arc;

use crate::database::Database;
use crate::types::*;

/// POST /api/v1/knowledge/symbols - Store a code symbol
pub async fn store_code_symbol(
    State(db): State<Arc<Database>>,
    Json(req): Json<StoreCodeSymbolRequest>,
) -> Json<ApiResponse<()>> {
    match db.store_code_symbol(req).await {
        Ok(()) => Json(ApiResponse::ok()),
        Err(e) => Json(ApiResponse::<()>::error(e.to_string())),
    }
}

/// POST /api/v1/knowledge/symbols/search - Search code symbols by vector
pub async fn search_code_symbols(
    State(db): State<Arc<Database>>,
    Json(req): Json<VectorSearchRequest>,
) -> Json<ApiResponse<Vec<CodeSymbol>>> {
    match db.search_code_symbols(req).await {
        Ok(symbols) => Json(ApiResponse::success(symbols)),
        Err(e) => Json(ApiResponse::<Vec<CodeSymbol>>::error(e.to_string())),
    }
}

/// POST /api/v1/knowledge/fragments - Store a semantic fragment
pub async fn store_semantic_fragment(
    State(db): State<Arc<Database>>,
    Json(req): Json<StoreSemanticFragmentRequest>,
) -> Json<ApiResponse<()>> {
    match db.store_semantic_fragment(req).await {
        Ok(()) => Json(ApiResponse::ok()),
        Err(e) => Json(ApiResponse::<()>::error(e.to_string())),
    }
}

/// POST /api/v1/knowledge/fragments/search - Search semantic fragments by vector
pub async fn search_semantic_fragments(
    State(db): State<Arc<Database>>,
    Json(req): Json<VectorSearchRequest>,
) -> Json<ApiResponse<Vec<SemanticFragment>>> {
    match db.search_semantic_fragments(req).await {
        Ok(fragments) => Json(ApiResponse::success(fragments)),
        Err(e) => Json(ApiResponse::<Vec<SemanticFragment>>::error(e.to_string())),
    }
}
