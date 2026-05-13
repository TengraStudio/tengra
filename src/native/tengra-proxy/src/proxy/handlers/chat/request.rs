/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use serde_json::{json, Value};

use crate::proxy::handlers::chat::request_claude::translate_claude;
use crate::proxy::handlers::chat::request_codex::translate_codex;
use crate::proxy::handlers::chat::request_gemini::translate_antigravity;
use crate::proxy::handlers::chat::request_openai::{
    is_openai_image_model, translate_openai_compatible, translate_openai_image_generation,
    translate_standard_openai,
};
use crate::proxy::handlers::chat::request_support::content_to_text;
use crate::proxy::types::ChatCompletionRequest;

pub fn translate_request(provider: &str, payload: &ChatCompletionRequest) -> Value {
    match provider {
        "claude" => translate_claude(payload),
        "antigravity" => translate_antigravity(payload),
        "copilot" => translate_copilot(payload),
        "codex" => translate_codex(payload),
        "openai" if is_openai_image_model(&payload.model) => {
            translate_openai_image_generation(payload)
        }
        "nvidia" | "groq" | "deepseek" | "xai" | "mistral" | "opencode" | "openrouter" => {
            translate_standard_openai(payload, provider)
        }
        "cursor" => translate_cursor(payload),
        _ => translate_openai_compatible(payload),
    }
}

fn translate_copilot(payload: &ChatCompletionRequest) -> Value {
    let mut raw_model = payload.model.replace("copilot-", "").replace("github-", "");
    if raw_model.starts_with("accounts/") || raw_model.starts_with("routers/") {
        raw_model = "gpt-4.1".to_string();
    }

    let mut body = translate_openai_compatible(payload);
    if let Some(map) = body.as_object_mut() {
        map.insert("model".to_string(), Value::String(raw_model));
    }
    body
}

pub fn translate_cursor(payload: &ChatCompletionRequest) -> Value {
    let mut messages = Vec::new();
    for msg in &payload.messages {
        let role = match msg.role.as_str() {
            "assistant" => 2,
            _ => 1,
        };
        messages.push(json!({
            "text": content_to_text(&msg.content),
            "role": role,
        }));
    }

    json!({
        "messages": messages,
        "modelName": payload.model.clone(),
        "clientVersion": super::headers::detected_cursor_client_version(),
    })
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Value};

    use super::translate_request;
    use crate::proxy::handlers::chat::request_gemini::{
        gemini_budget_for_effort, gemini_level_for_model, is_gemini_3_model,
        resolve_gemini_thinking_budget, resolve_gemini_thinking_level,
    };
    use crate::proxy::types::{ChatCompletionRequest, ChatMessage};

    fn sample_request(model: &str, reasoning_effort: Option<&str>) -> ChatCompletionRequest {
        ChatCompletionRequest {
            model: model.to_string(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: json!([{ "type": "text", "text": "hello" }]),
                name: None,
                tool_calls: None,
                tool_call_id: None,
                refusal: None,
            }],
            stream: false,
            temperature: None,
            max_tokens: Some(128),
            max_completion_tokens: None,
            n: None,
            top_p: None,
            stop: None,
            reasoning_effort: reasoning_effort.map(str::to_string),
            thinking_level: None,
            thinking_budget: None,
            provider: Some("antigravity".to_string()),
            tools: None,
            tool_choice: None,
            response_format: None,
            metadata: None,
            parallel_tool_calls: None,
            user: None,
        }
    }

    #[test]
    fn detects_gemini_3_models() {
        assert!(is_gemini_3_model("gemini-3-flash-preview"));
        assert!(is_gemini_3_model("GEMINI_3_PRO_PREVIEW"));
        assert!(!is_gemini_3_model("gemini-2.5-pro"));
    }

    #[test]
    fn maps_reasoning_effort_to_gemini_budget() {
        assert_eq!(gemini_budget_for_effort("minimal"), 512);
        assert_eq!(gemini_budget_for_effort("medium"), 8192);
        assert_eq!(gemini_budget_for_effort("auto"), -1);
    }

    #[test]
    fn maps_gemini_3_reasoning_to_levels() {
        assert_eq!(
            gemini_level_for_model("gemini-3-flash-preview", "medium"),
            "medium"
        );
        assert_eq!(
            gemini_level_for_model("gemini-3-pro-preview", "minimal"),
            "low"
        );
        assert_eq!(
            gemini_level_for_model("gemini-3-pro-preview", "high"),
            "high"
        );
    }

    #[test]
    fn resolves_gemini_3_level_from_reasoning_effort() {
        let payload = sample_request("gemini-3-flash-preview", Some("high"));
        assert_eq!(
            resolve_gemini_thinking_level(&payload).as_deref(),
            Some("high")
        );
    }

    #[test]
    fn respects_explicit_gemini_thinking_level() {
        let mut payload = sample_request("gemini-3-flash-preview", Some("low"));
        payload.thinking_level = Some("medium".to_string());
        assert_eq!(
            resolve_gemini_thinking_level(&payload).as_deref(),
            Some("medium")
        );
    }

    #[test]
    fn resolves_legacy_gemini_budget_from_reasoning_effort() {
        let payload = sample_request("gemini-2.5-pro", Some("medium"));
        assert_eq!(resolve_gemini_thinking_budget(&payload), Some(8192));
    }

    #[test]
    fn respects_explicit_gemini_budget() {
        let mut payload = sample_request("gemini-2.5-pro", Some("low"));
        payload.thinking_budget = Some(2048);
        assert_eq!(resolve_gemini_thinking_budget(&payload), Some(2048));
    }

    #[test]
    fn omits_thinking_when_reasoning_disabled() {
        let payload = sample_request("gemini-3-flash-preview", Some("none"));
        assert_eq!(resolve_gemini_thinking_level(&payload), None);
        let payload = sample_request("gemini-2.5-pro", Some("none"));
        assert_eq!(resolve_gemini_thinking_budget(&payload), None);
    }

    #[test]
    fn translates_antigravity_to_gemini_request_envelope() {
        let mut payload = sample_request("gemini-3-flash-preview", Some("high"));
        payload.provider = Some("antigravity".to_string());
        payload.metadata = Some(json!({ "project_id": "demo-project" }));

        let translated = translate_request("antigravity", &payload);

        assert_eq!(
            translated.get("model").and_then(Value::as_str),
            Some("gemini-3-flash")
        );
        assert_eq!(
            translated.get("project").and_then(Value::as_str),
            Some("demo-project")
        );

        let request = translated.get("request").expect("request envelope");
        let thinking_level = request
            .get("generationConfig")
            .and_then(|cfg| cfg.get("thinkingConfig"))
            .and_then(|cfg| cfg.get("thinkingLevel"))
            .and_then(Value::as_str);
        assert_eq!(thinking_level, Some("high"));
        assert_eq!(
            request.get("toolConfig"),
            None,
            "toolConfig should be omitted when no tools are provided"
        );
    }
}
