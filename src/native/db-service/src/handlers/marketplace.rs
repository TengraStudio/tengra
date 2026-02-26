//! Marketplace model handlers

use axum::{
    extract::{Query, State},
    Json,
};
use std::sync::Arc;

use crate::database::Database;
use crate::types::{
    ApiResponse, GetMarketplaceModelsRequest, MarketplaceModel, MarketplaceModelsResponse,
    SearchMarketplaceModelsRequest, UpsertMarketplaceModelsRequest, UpsertResponse,
};

/// POST /api/v1/marketplace/models - Upsert marketplace models
pub async fn upsert_models(
    State(db): State<Arc<Database>>,
    Json(req): Json<UpsertMarketplaceModelsRequest>,
) -> Json<ApiResponse<UpsertResponse>> {
    // Convert input models to database models
    let models: Vec<MarketplaceModel> = req
        .models
        .into_iter()
        .map(|m| {
            let id = format!("{}:{}", m.provider, m.name);
            let now = chrono::Utc::now().timestamp_millis();
            MarketplaceModel {
                id,
                name: m.name,
                provider: m.provider,
                pulls: m.pulls,
                tag_count: m.tag_count,
                last_updated: m.last_updated,
                categories: m.categories,
                short_description: m.short_description,
                downloads: m.downloads,
                likes: m.likes,
                author: m.author,
                created_at: now,
                updated_at: now,
            }
        })
        .collect();

    match db.upsert_marketplace_models(models).await {
        Ok(count) => Json(ApiResponse::success(UpsertResponse { count })),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// GET /api/v1/marketplace/models - Get marketplace models
pub async fn get_models(
    State(db): State<Arc<Database>>,
    Query(req): Query<GetMarketplaceModelsRequest>,
) -> Json<ApiResponse<MarketplaceModelsResponse>> {
    let provider = req.provider.as_deref();

    // Get count first
    let total = match db.get_marketplace_model_count(provider).await {
        Ok(t) => t,
        Err(e) => return Json(ApiResponse::error(e.to_string())),
    };

    // Get models
    match db
        .get_marketplace_models(provider, req.limit, req.offset)
        .await
    {
        Ok(models) => Json(ApiResponse::success(MarketplaceModelsResponse { models, total })),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// POST /api/v1/marketplace/models/search - Search marketplace models
pub async fn search_models(
    State(db): State<Arc<Database>>,
    Json(req): Json<SearchMarketplaceModelsRequest>,
) -> Json<ApiResponse<MarketplaceModelsResponse>> {
    let provider = req.provider.as_deref();

    match db
        .search_marketplace_models(&req.query, provider, req.limit)
        .await
    {
        Ok(models) => {
            let total = models.len() as i64;
            Json(ApiResponse::success(MarketplaceModelsResponse { models, total }))
        }
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}

/// DELETE /api/v1/marketplace/models - Clear marketplace models
pub async fn clear_models(
    State(db): State<Arc<Database>>,
    Query(req): Query<GetMarketplaceModelsRequest>,
) -> Json<ApiResponse<UpsertResponse>> {
    let provider = req.provider.as_deref();

    match db.clear_marketplace_models(provider).await {
        Ok(count) => Json(ApiResponse::success(UpsertResponse { count })),
        Err(e) => Json(ApiResponse::error(e.to_string())),
    }
}
