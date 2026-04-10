use crate::proxy::server::AppState;
use crate::proxy::types::{ChatCompletionRequest, ChatMessage};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Response,
    Json,
};
use serde_json::Value;
use std::sync::Arc;

pub async fn handle_completions(
    _state: State<Arc<AppState>>,
    _headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<Response, (StatusCode, String)> {
    if let Some(prompt) = payload.get("prompt").and_then(|v| v.as_str()) {
        let _chat_payload = ChatCompletionRequest {
            model: payload
                .get("model")
                .and_then(|v| v.as_str())
                .unwrap_or("gpt-4o")
                .to_string(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: Value::String(prompt.to_string()),
                name: None,
                tool_calls: None,
                tool_call_id: None,
                refusal: None,
            }],
            stream: payload
                .get("stream")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            provider: payload
                .get("provider")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            temperature: payload
                .get("temperature")
                .and_then(|v| v.as_f64())
                .map(|v| v as f32),
            max_tokens: payload
                .get("max_tokens")
                .and_then(|v| v.as_u64())
                .map(|v| v as u32),
            max_completion_tokens: payload
                .get("max_completion_tokens")
                .and_then(|v| v.as_u64())
                .map(|v| v as u32),
            top_p: payload
                .get("top_p")
                .and_then(|v| v.as_f64())
                .map(|v| v as f32),
            stop: payload.get("stop").and_then(|v| v.as_array()).map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            }),
            reasoning_effort: payload
                .get("reasoning_effort")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            thinking_level: payload
                .get("thinking_level")
                .or_else(|| payload.get("thinkingLevel"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            thinking_budget: payload
                .get("thinking_budget")
                .or_else(|| payload.get("thinkingBudget"))
                .and_then(|v| v.as_i64()),
            tools: payload.get("tools").and_then(Value::as_array).cloned(),
            tool_choice: payload.get("tool_choice").cloned(),
            response_format: payload.get("response_format").cloned(),
            metadata: payload.get("metadata").cloned(),
            parallel_tool_calls: payload.get("parallel_tool_calls").and_then(Value::as_bool),
            user: payload
                .get("user")
                .and_then(Value::as_str)
                .map(str::to_string),
        };
    }

    Err((
        StatusCode::NOT_IMPLEMENTED,
        "Legacy /v1/completions not yet fully implemented. Please use /v1/chat/completions"
            .to_string(),
    ))
}
