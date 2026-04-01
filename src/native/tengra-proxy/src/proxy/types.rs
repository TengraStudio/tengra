use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize, Serialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub stream: bool,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub max_completion_tokens: Option<u32>,
    pub top_p: Option<f32>,
    pub stop: Option<Vec<String>>,
    pub reasoning_effort: Option<String>,
    pub provider: Option<String>,
    pub tools: Option<Vec<Value>>,
    pub tool_choice: Option<Value>,
    pub response_format: Option<Value>,
    pub metadata: Option<Value>,
    pub parallel_tool_calls: Option<bool>,
    pub user: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: Value,
    pub name: Option<String>,
    pub tool_calls: Option<Vec<Value>>,
    pub tool_call_id: Option<String>,
    pub refusal: Option<String>,
}
