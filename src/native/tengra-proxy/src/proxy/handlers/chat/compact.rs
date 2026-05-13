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

use crate::proxy::model_catalog::{find_model, resolve_provider};
use crate::proxy::types::{ChatCompletionRequest, ChatMessage};

const MIN_RECENT_MESSAGES: usize = 2;
const SUMMARY_MESSAGE_RESERVE_TOKENS: usize = 512;

pub fn compact_chat_request(
    provider: &str,
    mut payload: ChatCompletionRequest,
) -> ChatCompletionRequest {
    if payload.messages.len() <= 2 {
        return payload;
    }

    let prompt_budget = compute_prompt_budget(provider, &payload);
    let base_tokens = estimate_non_message_tokens(&payload);
    let message_budget = prompt_budget.saturating_sub(base_tokens).max(128);
    let before_tokens = estimate_chat_request_tokens(&payload);
    let before_messages = payload.messages.len();

    if before_tokens <= prompt_budget {
        return payload;
    }

    let mut compacted_messages = compact_messages_for_budget(&payload.messages, message_budget);
    hard_fit_messages(&mut compacted_messages, message_budget);
    payload.messages = compacted_messages;

    let after_tokens = estimate_chat_request_tokens(&payload);
    if after_tokens < before_tokens {
        tracing::info!(
            target: "proxy.compact",
            provider = provider,
            model = payload.model.as_str(),
            before_tokens,
            after_tokens,
            prompt_budget,
            before_messages,
            after_messages = payload.messages.len(),
            "Compacted chat payload"
        );
    }

    payload
}

pub fn compact_claude_messages_payload(mut payload: Value) -> Value {
    let Some(object) = payload.as_object_mut() else {
        return payload;
    };

    let Some(messages) = object.get("messages").and_then(Value::as_array).cloned() else {
        return payload;
    };
    if messages.len() <= 2 {
        return payload;
    }

    let model = object
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or("claude-sonnet-4-6")
        .to_string();
    let (context_length, max_completion_tokens) = resolve_model_limits("claude", model.as_str());
    let requested_output_tokens = object
        .get("max_tokens")
        .and_then(Value::as_u64)
        .map(|value| value as u32)
        .unwrap_or(max_completion_tokens);
    let prompt_budget = compute_prompt_budget_from_limits(context_length, requested_output_tokens);
    let system_tokens = object.get("system").map(estimate_value_tokens).unwrap_or(0);
    let message_budget = prompt_budget.saturating_sub(system_tokens).max(128);

    let before_tokens = estimate_value_tokens(&Value::Array(messages.clone())) + system_tokens;
    if before_tokens <= prompt_budget {
        return payload;
    }

    let mut compacted_messages = compact_raw_claude_messages(&messages, message_budget);
    hard_fit_raw_messages(&mut compacted_messages, message_budget);
    object.insert(
        "messages".to_string(),
        Value::Array(compacted_messages.clone()),
    );

    let after_tokens = estimate_value_tokens(&Value::Array(compacted_messages)) + system_tokens;
    if after_tokens < before_tokens {
        tracing::info!(
            target: "proxy.compact",
            provider = "claude-compat",
            model = model.as_str(),
            before_tokens,
            after_tokens,
            prompt_budget,
            before_messages = messages.len(),
            after_messages = object
                .get("messages")
                .and_then(|value| value.as_array())
                .map(|items| items.len())
                .unwrap_or(0),
            "Compacted Claude compatibility payload"
        );
    }

    payload
}

fn compact_messages_for_budget(
    messages: &[ChatMessage],
    message_budget: usize,
) -> Vec<ChatMessage> {
    let total_tokens = estimate_messages_tokens(messages);
    if total_tokens <= message_budget {
        return messages.to_vec();
    }

    let mut keep = vec![false; messages.len()];
    let mut system_tokens = 0usize;
    let mut non_system_indices = Vec::new();

    for (index, message) in messages.iter().enumerate() {
        if is_system_role(message.role.as_str()) {
            keep[index] = true;
            system_tokens += estimate_message_tokens(message);
        } else {
            non_system_indices.push(index);
        }
    }

    if non_system_indices.is_empty() {
        return messages.to_vec();
    }

    let summary_reserve = SUMMARY_MESSAGE_RESERVE_TOKENS.min(message_budget / 3);
    let target_recent_tokens = message_budget
        .saturating_sub(system_tokens)
        .saturating_sub(summary_reserve);
    let mut recent_tokens = 0usize;
    let mut keep_start = non_system_indices.len();

    for position in (0..non_system_indices.len()).rev() {
        let message_index = non_system_indices[position];
        let message_tokens = estimate_message_tokens(&messages[message_index]);
        let must_keep = non_system_indices.len().saturating_sub(position) <= MIN_RECENT_MESSAGES;

        if must_keep || recent_tokens + message_tokens <= target_recent_tokens {
            keep[message_index] = true;
            recent_tokens += message_tokens;
            keep_start = position;
        } else {
            break;
        }
    }

    let dropped: Vec<ChatMessage> = non_system_indices[..keep_start]
        .iter()
        .map(|index| messages[*index].clone())
        .collect();
    if dropped.is_empty() {
        return messages.to_vec();
    }

    let summary_message = build_compaction_summary_message(&dropped);
    let mut compacted = Vec::with_capacity(messages.len() + 1);
    let mut inserted_summary = false;

    for (index, message) in messages.iter().cloned().enumerate() {
        if is_system_role(message.role.as_str()) {
            compacted.push(message);
            continue;
        }

        if !keep[index] {
            continue;
        }

        if !inserted_summary {
            compacted.push(summary_message.clone());
            inserted_summary = true;
        }
        compacted.push(message);
    }

    if !inserted_summary {
        compacted.push(summary_message);
        if let Some(last_non_system) = messages
            .iter()
            .rev()
            .find(|message| !is_system_role(message.role.as_str()))
        {
            compacted.push(last_non_system.clone());
        }
    }

    compacted
}

fn compact_raw_claude_messages(messages: &[Value], message_budget: usize) -> Vec<Value> {
    let total_tokens = estimate_value_tokens(&Value::Array(messages.to_vec()));
    if total_tokens <= message_budget {
        return messages.to_vec();
    }

    let summary_reserve = SUMMARY_MESSAGE_RESERVE_TOKENS.min(message_budget / 3);
    let target_recent_tokens = message_budget.saturating_sub(summary_reserve);

    let mut keep_start = messages.len();
    let mut recent_tokens = 0usize;

    for position in (0..messages.len()).rev() {
        let message_tokens = estimate_value_tokens(&messages[position]);
        let must_keep = messages.len().saturating_sub(position) <= MIN_RECENT_MESSAGES;

        if must_keep || recent_tokens + message_tokens <= target_recent_tokens {
            recent_tokens += message_tokens;
            keep_start = position;
        } else {
            break;
        }
    }

    if keep_start == 0 || keep_start >= messages.len() {
        return messages.to_vec();
    }

    let dropped = &messages[..keep_start];
    let kept = &messages[keep_start..];

    let mut compacted = Vec::with_capacity(kept.len() + 1);
    compacted.push(build_compaction_summary_raw_message(dropped));
    compacted.extend_from_slice(kept);
    compacted
}

fn hard_fit_messages(messages: &mut Vec<ChatMessage>, message_budget: usize) {
    let mut guard = 0usize;
    while estimate_messages_tokens(messages) > message_budget && guard < 512 {
        guard += 1;
        if drop_oldest_non_system_message(messages) {
            continue;
        }
        if drop_oldest_system_message(messages) {
            continue;
        }
        if truncate_largest_chat_message(messages) {
            continue;
        }
        break;
    }
}

fn hard_fit_raw_messages(messages: &mut Vec<Value>, message_budget: usize) {
    let mut guard = 0usize;
    while estimate_value_tokens(&Value::Array(messages.clone())) > message_budget && guard < 512 {
        guard += 1;
        if drop_oldest_raw_message(messages) {
            continue;
        }
        if truncate_largest_raw_message(messages) {
            continue;
        }
        break;
    }
}

fn drop_oldest_non_system_message(messages: &mut Vec<ChatMessage>) -> bool {
    let last_non_system = messages
        .iter()
        .enumerate()
        .rev()
        .find(|(_, message)| !is_system_role(message.role.as_str()))
        .map(|(index, _)| index);

    let Some(last_non_system) = last_non_system else {
        return false;
    };

    if let Some(index) = messages
        .iter()
        .enumerate()
        .find(|(index, message)| {
            !is_system_role(message.role.as_str()) && *index != last_non_system
        })
        .map(|(index, _)| index)
    {
        messages.remove(index);
        return true;
    }

    false
}

fn drop_oldest_system_message(messages: &mut Vec<ChatMessage>) -> bool {
    let system_count = messages
        .iter()
        .filter(|message| is_system_role(message.role.as_str()))
        .count();
    if system_count <= 1 {
        return false;
    }

    if let Some(index) = messages
        .iter()
        .position(|message| is_system_role(message.role.as_str()))
    {
        messages.remove(index);
        return true;
    }

    false
}

fn truncate_largest_chat_message(messages: &mut [ChatMessage]) -> bool {
    let Some((index, largest_tokens)) = messages
        .iter()
        .enumerate()
        .map(|(index, message)| (index, estimate_message_tokens(message)))
        .max_by_key(|(_, tokens)| *tokens)
    else {
        return false;
    };

    if largest_tokens < 64 {
        return false;
    }

    let message = &mut messages[index];
    let preview_limit = if is_system_role(message.role.as_str()) {
        3000
    } else {
        2000
    };
    let preview = message_preview(message, preview_limit);
    if preview.is_empty() {
        return false;
    }

    message.content = Value::String(format!(
        "{}\n\n[truncated by tengra-proxy context compactor]",
        preview
    ));
    message.tool_calls = None;
    message.refusal = None;
    true
}

fn drop_oldest_raw_message(messages: &mut Vec<Value>) -> bool {
    if messages.len() <= 1 {
        return false;
    }
    messages.remove(0);
    true
}

fn truncate_largest_raw_message(messages: &mut [Value]) -> bool {
    let Some((index, largest_tokens)) = messages
        .iter()
        .enumerate()
        .map(|(index, message)| (index, estimate_value_tokens(message)))
        .max_by_key(|(_, tokens)| *tokens)
    else {
        return false;
    };

    if largest_tokens < 64 {
        return false;
    }

    let fallback_preview = truncate_text(messages[index].to_string().as_str(), 2000);
    let Some(object) = messages[index].as_object_mut() else {
        let preview = truncate_text(messages[index].to_string().as_str(), 2000);
        messages[index] = json!({
            "role": "user",
            "content": [{ "type": "text", "text": preview }]
        });
        return true;
    };

    let content_preview = object
        .get("content")
        .map(content_preview_from_value)
        .filter(|text| !text.is_empty())
        .unwrap_or(fallback_preview);
    object.insert(
        "content".to_string(),
        json!([{
            "type": "text",
            "text": format!(
                "{}\n\n[truncated by tengra-proxy context compactor]",
                truncate_text(content_preview.as_str(), 2000)
            )
        }]),
    );
    true
}

fn build_compaction_summary_message(dropped: &[ChatMessage]) -> ChatMessage {
    let mut lines = Vec::new();
    for message in dropped.iter().take(18) {
        let preview = message_preview(message, 180);
        if preview.is_empty() {
            continue;
        }
        lines.push(format!("- {}: {}", message.role, preview));
    }

    if lines.is_empty() {
        lines.push("- Earlier turns were removed to fit the model context window.".to_string());
    }

    let summary = format!(
        "Context compaction summary (generated by tengra-proxy):\n{}\nKeep this summary as compressed history and prioritize the latest user instructions when conflicts appear.",
        lines.join("\n")
    );

    ChatMessage {
        role: "system".to_string(),
        content: Value::String(summary),
        name: Some("context_compaction_summary".to_string()),
        tool_calls: None,
        tool_call_id: None,
        refusal: None,
    }
}

fn build_compaction_summary_raw_message(dropped: &[Value]) -> Value {
    let mut lines = Vec::new();
    for message in dropped.iter().take(18) {
        let role = message
            .get("role")
            .and_then(Value::as_str)
            .unwrap_or("user")
            .to_string();
        let preview = message
            .get("content")
            .map(content_preview_from_value)
            .unwrap_or_default();
        let preview = truncate_text(preview.as_str(), 180);
        if preview.is_empty() {
            continue;
        }
        lines.push(format!("- {}: {}", role, preview));
    }

    if lines.is_empty() {
        lines.push("- Earlier turns were removed to fit the model context window.".to_string());
    }

    json!({
        "role": "user",
        "content": [{
            "type": "text",
            "text": format!(
                "Context compaction summary (generated by tengra-proxy):\n{}\nUse this as compressed history and follow the latest user request when conflicts appear.",
                lines.join("\n")
            )
        }]
    })
}

fn compute_prompt_budget(provider: &str, payload: &ChatCompletionRequest) -> usize {
    let (context_length, max_completion_tokens) =
        resolve_model_limits(provider, payload.model.as_str());
    let requested_output_tokens = payload
        .max_completion_tokens
        .or(payload.max_tokens)
        .unwrap_or(max_completion_tokens);
    compute_prompt_budget_from_limits(context_length, requested_output_tokens)
}

fn compute_prompt_budget_from_limits(context_length: u32, requested_output_tokens: u32) -> usize {
    let clamped_output = requested_output_tokens
        .max(256)
        .min(context_length.saturating_sub(256));
    let safety_margin = ((context_length as f64) * 0.05) as u32;
    let safety_margin = safety_margin.clamp(512, 32_768);
    context_length
        .saturating_sub(clamped_output)
        .saturating_sub(safety_margin)
        .max(1024) as usize
}

fn resolve_model_limits(provider: &str, model: &str) -> (u32, u32) {
    let normalized_model = normalize_model_id(provider, model);
    if let Some(info) = find_model(provider, normalized_model.as_str()) {
        return (info.context_length, info.max_completion_tokens);
    }
    if let Some(info) = find_model(provider, model) {
        return (info.context_length, info.max_completion_tokens);
    }

    if let Some(inferred_provider) = resolve_provider(model) {
        if let Some(info) = find_model(inferred_provider, normalized_model.as_str()) {
            return (info.context_length, info.max_completion_tokens);
        }
        if let Some(info) = find_model(inferred_provider, model) {
            return (info.context_length, info.max_completion_tokens);
        }
    }

    default_limits(provider)
}

fn default_limits(provider: &str) -> (u32, u32) {
    match provider {
        "claude" => (200_000, 8_192),
        "codex" => (400_000, 65_536),
        "copilot" => (128_000, 16_384),
        "antigravity" | "gemini" => (1_048_576, 8_192),
        "openai" => (128_000, 16_384),
        "openrouter" => (128_000, 8_192),
        "xai" => (256_000, 8_192),
        "deepseek" => (64_000, 8_192),
        _ => (128_000, 8_192),
    }
}

fn normalize_model_id(provider: &str, model: &str) -> String {
    let trimmed = model.trim();
    if trimmed.is_empty() {
        return trimmed.to_string();
    }

    match provider {
        "codex" => match trimmed {
            "codex-latest" | "codex-preview" => "gpt-5-codex".to_string(),
            "codex-stable" => "gpt-5-codex-mini".to_string(),
            _ => trimmed.to_string(),
        },
        "copilot" => trimmed
            .trim_start_matches("copilot-")
            .trim_start_matches("github-")
            .to_string(),
        "openrouter" => trimmed.trim_start_matches("openrouter/").to_string(),
        "antigravity" => trimmed.trim_start_matches("antigravity/").to_string(),

        _ => trimmed.to_string(),
    }
}

fn estimate_chat_request_tokens(payload: &ChatCompletionRequest) -> usize {
    estimate_non_message_tokens(payload) + estimate_messages_tokens(&payload.messages)
}

fn estimate_non_message_tokens(payload: &ChatCompletionRequest) -> usize {
    let mut tokens = estimate_text_tokens(payload.model.as_str()) + 12;
    tokens += payload
        .reasoning_effort
        .as_deref()
        .map(estimate_text_tokens)
        .unwrap_or(0);
    tokens += payload
        .thinking_level
        .as_deref()
        .map(estimate_text_tokens)
        .unwrap_or(0);
    tokens += payload
        .tools
        .as_ref()
        .map(|tools| estimate_value_tokens(&Value::Array(tools.clone())))
        .unwrap_or(0);
    tokens += payload
        .tool_choice
        .as_ref()
        .map(estimate_value_tokens)
        .unwrap_or(0);
    tokens += payload
        .response_format
        .as_ref()
        .map(estimate_value_tokens)
        .unwrap_or(0);
    tokens += payload
        .metadata
        .as_ref()
        .map(estimate_value_tokens)
        .unwrap_or(0);
    tokens
}

fn estimate_messages_tokens(messages: &[ChatMessage]) -> usize {
    messages.iter().map(estimate_message_tokens).sum()
}

fn estimate_message_tokens(message: &ChatMessage) -> usize {
    let mut tokens = 8 + estimate_text_tokens(message.role.as_str());
    tokens += estimate_value_tokens(&message.content);
    tokens += message
        .name
        .as_deref()
        .map(estimate_text_tokens)
        .unwrap_or(0);
    tokens += message
        .tool_call_id
        .as_deref()
        .map(estimate_text_tokens)
        .unwrap_or(0);
    tokens += message
        .refusal
        .as_deref()
        .map(estimate_text_tokens)
        .unwrap_or(0);
    tokens += message
        .tool_calls
        .as_ref()
        .map(|tool_calls| estimate_value_tokens(&Value::Array(tool_calls.clone())))
        .unwrap_or(0);
    tokens
}

fn estimate_value_tokens(value: &Value) -> usize {
    match value {
        Value::Null => 1,
        Value::Bool(_) => 1,
        Value::Number(_) => 1,
        Value::String(text) => estimate_text_tokens(text.as_str()),
        Value::Array(items) => 2 + items.iter().map(estimate_value_tokens).sum::<usize>(),
        Value::Object(map) => {
            let key_tokens = map
                .keys()
                .map(|key| estimate_text_tokens(key.as_str()))
                .sum::<usize>();
            let value_tokens = map.values().map(estimate_value_tokens).sum::<usize>();
            2 + key_tokens + value_tokens
        }
    }
}

fn estimate_text_tokens(text: &str) -> usize {
    let chars = text.chars().count();
    let newlines = text.chars().filter(|ch| *ch == '\n').count();
    (chars / 4).max(1) + newlines + 1
}

fn is_system_role(role: &str) -> bool {
    role.eq_ignore_ascii_case("system")
}

fn message_preview(message: &ChatMessage, max_chars: usize) -> String {
    truncate_text(
        content_preview_from_value(&message.content).as_str(),
        max_chars,
    )
}

fn content_preview_from_value(content: &Value) -> String {
    match content {
        Value::String(text) => text.clone(),
        Value::Array(items) => items
            .iter()
            .map(content_preview_from_value)
            .filter(|text| !text.is_empty())
            .collect::<Vec<_>>()
            .join(" "),
        Value::Object(map) => {
            if let Some(text) = map.get("text").and_then(Value::as_str) {
                return text.to_string();
            }
            if let Some(text) = map.get("input_text").and_then(Value::as_str) {
                return text.to_string();
            }
            if let Some(text) = map
                .get("image_url")
                .and_then(|value| value.get("url"))
                .and_then(Value::as_str)
            {
                return format!("image: {}", text);
            }
            serde_json::to_string(content).unwrap_or_default()
        }
        _ => content.to_string(),
    }
}

fn truncate_text(text: &str, max_chars: usize) -> String {
    if max_chars == 0 {
        return String::new();
    }
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let mut truncated = String::with_capacity(max_chars + 8);
    for ch in text.chars().take(max_chars.saturating_sub(3)) {
        truncated.push(ch);
    }
    truncated.push_str("...");
    truncated
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{compact_chat_request, compact_claude_messages_payload};
    use crate::proxy::types::{ChatCompletionRequest, ChatMessage};

    #[test]
    fn compacts_large_chat_payload_and_keeps_recent_message() {
        let mut messages = vec![ChatMessage {
            role: "system".to_string(),
            content: json!("You are a helpful assistant."),
            name: None,
            tool_calls: None,
            tool_call_id: None,
            refusal: None,
        }];

        for index in 0..30 {
            messages.push(ChatMessage {
                role: if index % 2 == 0 { "user" } else { "assistant" }.to_string(),
                content: json!(format!("message {} {}", index, "x".repeat(10000))),
                name: None,
                tool_calls: None,
                tool_call_id: None,
                refusal: None,
            });
        }

        let original_last = messages
            .last()
            .and_then(|message| message.content.as_str())
            .unwrap_or_default()
            .to_string();

        let payload = ChatCompletionRequest {
            model: "deepseek-chat".to_string(),
            messages,
            stream: false,
            temperature: None,
            max_tokens: Some(4096),
            max_completion_tokens: None,
            n: None,
            top_p: None,
            stop: None,
            reasoning_effort: None,
            thinking_level: None,
            thinking_budget: None,
            provider: Some("deepseek".to_string()),
            tools: None,
            tool_choice: None,
            response_format: None,
            metadata: None,
            parallel_tool_calls: None,
            user: None,
        };

        let compacted = compact_chat_request("deepseek", payload);
        assert!(compacted.messages.len() < 31);
        let has_summary = compacted.messages.iter().any(|message| {
            message
                .name
                .as_deref()
                .map(|name| name == "context_compaction_summary")
                .unwrap_or(false)
        });
        assert!(has_summary);
        let compacted_last = compacted
            .messages
            .last()
            .and_then(|message| message.content.as_str())
            .unwrap_or_default()
            .to_string();
        assert_eq!(compacted_last, original_last);
    }

    #[test]
    fn compacts_raw_claude_payload() {
        let payload = json!({
            "model": "claude-3-7-sonnet-20250219",
            "max_tokens": 100000,
            "messages": (0..24).map(|index| json!({
                "role": if index % 2 == 0 { "user" } else { "assistant" },
                "content": [{ "type": "text", "text": format!("turn {} {}", index, "x".repeat(20000)) }]
            })).collect::<Vec<_>>()
        });

        let compacted = compact_claude_messages_payload(payload);
        let messages = compacted
            .get("messages")
            .and_then(|value| value.as_array())
            .cloned()
            .unwrap_or_default();
        assert!(messages.len() < 24);
        assert!(messages
            .first()
            .and_then(|value| value.get("content"))
            .is_some());
    }
}
