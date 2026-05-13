/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use std::convert::Infallible;
use std::pin::Pin;
use std::sync::Arc;

use async_stream::stream;
use axum::extract::State;
use axum::response::sse::Event;
use futures::{Stream, StreamExt};
use serde_json::json;

use crate::proxy::handlers::chat::stream_claude::{translate_claude_frame, ClaudeStreamState};
use crate::proxy::handlers::chat::stream_copilot::{translate_copilot_frame, CopilotStreamState};
pub use crate::proxy::handlers::chat::stream_cursor::translate_cursor_stream;
use crate::proxy::handlers::chat::stream_gemini::{translate_gemini_frame, GeminiStreamState};
use crate::proxy::handlers::chat::stream_support::{
    normalize_generic_openai_frame, take_next_frame,
};
use crate::proxy::server::AppState;

pub fn translate_stream(
    provider: String,
    upstream: impl Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Send + 'static,
    state: State<Arc<AppState>>,
    session_key: String,
) -> Pin<Box<dyn Stream<Item = Result<Event, Infallible>> + Send + 'static>> {
    Box::pin(stream! {
        let mut input = Box::pin(upstream);
        let mut buffer = String::new();
        let mut claude_state = ClaudeStreamState::default();
        let mut gemini_state = GeminiStreamState::default();
        let mut copilot_state = CopilotStreamState::default();

        while let Some(chunk) = input.next().await {
            match chunk {
                Ok(bytes) => {
                    buffer.push_str(String::from_utf8_lossy(&bytes).as_ref());
                    while let Some(frame) = take_next_frame(&mut buffer) {
                        for payload in translate_frame(
                            provider.as_str(),
                            frame.as_str(),
                            &mut claude_state,
                            &mut gemini_state,
                            &mut copilot_state,
                            &state,
                            &session_key,
                        ) {
                            yield Ok(Event::default().data(payload));
                        }
                    }
                }
                Err(error) => {
                    yield Ok(Event::default().data(json!({ "error": format!("Upstream stream error: {}", error) }).to_string()));
                }
            }
        }

        if !buffer.trim().is_empty() {
            for payload in translate_frame(
                provider.as_str(),
                buffer.trim(),
                &mut claude_state,
                &mut gemini_state,
                &mut copilot_state,
                &state,
                &session_key,
            ) {
                yield Ok(Event::default().data(payload));
            }
        }
    })
}

fn translate_frame(
    provider: &str,
    frame: &str,
    claude_state: &mut ClaudeStreamState,
    gemini_state: &mut GeminiStreamState,
    copilot_state: &mut CopilotStreamState,
    state: &State<Arc<AppState>>,
    session_key: &str,
) -> Vec<String> {
    match provider {
        "claude" => translate_claude_frame(frame, claude_state, state, session_key),
        "antigravity" => translate_gemini_frame(frame, gemini_state),
        "copilot" => translate_copilot_frame(frame, copilot_state, state, session_key),
        "nvidia" => normalize_generic_openai_frame(frame),
        "groq" | "mistral" => normalize_generic_openai_frame(frame),
        _ => normalize_generic_openai_frame(frame),
    }
}

#[cfg(test)]
mod tests {
    use crate::proxy::handlers::chat::stream_cursor::translate_cursor_payload;

    use std::sync::Arc;

    use axum::extract::State;
    use tokio::sync::Mutex;

    use super::{
        take_next_frame, translate_claude_frame, translate_copilot_frame, translate_gemini_frame,
        ClaudeStreamState, CopilotStreamState, GeminiStreamState,
    };

    fn sample_app_state() -> State<Arc<crate::proxy::server::AppState>> {
        State(Arc::new(crate::proxy::server::AppState {
            signature_cache: Mutex::new(std::collections::HashMap::new()),
            session_id_cache: Mutex::new(std::collections::HashMap::new()),
            copilot_usage_cache: Mutex::new(std::collections::HashMap::new()),
            terminal_manager: crate::terminal::TerminalManager::new(),
            lsp_manager: crate::analysis::lsp_manager::LspManager::new(),
        }))
    }

    #[test]
    fn splits_sse_frames() {
        let mut buffer = "data: one\n\ndata: two\n\n".to_string();
        assert_eq!(take_next_frame(&mut buffer), Some("data: one".to_string()));
        assert_eq!(take_next_frame(&mut buffer), Some("data: two".to_string()));
        assert!(buffer.is_empty());
    }

    #[test]
    fn translates_claude_text_delta_to_openai_chunk() {
        let mut state = ClaudeStreamState::default();
        let app_state = sample_app_state();
        let payloads = translate_claude_frame(
            "event: content_block_delta\ndata: {\"delta\":{\"type\":\"text_delta\",\"text\":\"hello\"}}\n\n",
            &mut state,
            &app_state,
            "test-session",
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"content\":\"hello\""));
    }

    #[test]
    fn translates_gemini_text_delta_to_openai_chunk() {
        let mut state = GeminiStreamState::default();
        let payloads = translate_gemini_frame(
            "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"hello\"}]},\"finishReason\":\"STOP\"}],\"modelVersion\":\"gemini-2.5-pro\"}\n\n",
            &mut state
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"content\":\"hello\""));
    }

    #[test]
    fn translates_wrapped_antigravity_stream_delta() {
        let mut state = GeminiStreamState::default();
        let payloads = translate_gemini_frame(
            "data: {\"response\":{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"hello\"}]},\"finishReason\":\"STOP\"}],\"modelVersion\":\"gemini-3-flash\"}}\n\n",
            &mut state
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"content\":\"hello\""));
        assert!(payloads[0].contains("\"model\":\"gemini-3-flash\""));
    }

    #[test]
    fn translates_gemini_thought_part_to_reasoning() {
        let mut state = GeminiStreamState::default();
        let payloads = translate_gemini_frame(
            "data: {\"candidates\":[{\"content\":{\"parts\":[{\"thought\":true,\"text\":\"thinking...\"},{\"text\":\"hello\"}]},\"finishReason\":\"STOP\"}],\"modelVersion\":\"gemini-2.5-pro\"}\n\n",
            &mut state
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"reasoning_content\":\"thinking...\""));
        assert!(payloads[0].contains("\"content\":\"hello\""));
    }

    #[test]
    fn translates_antigravity_string_thought_to_reasoning() {
        let mut state = GeminiStreamState::default();
        let payloads = translate_gemini_frame(
            "data: {\"response\":{\"candidates\":[{\"content\":{\"parts\":[{\"thinking\":\"reasoning text\"},{\"text\":\"answer\"}]},\"finishReason\":\"STOP\"}],\"modelVersion\":\"gemini-3-flash\"}}\n\n",
            &mut state
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"reasoning_content\":\"reasoning text\""));
        assert!(payloads[0].contains("\"content\":\"answer\""));
    }

    #[test]
    fn translates_copilot_reasoning_events() {
        let mut state = CopilotStreamState::default();
        let app_state = sample_app_state();
        let payloads = translate_copilot_frame(
            "data: {\"type\":\"assistant.reasoning_delta\",\"data\":{\"deltaContent\":\"thinking\"}}\n\n",
            &mut state,
            &app_state,
            "copilot:test",
        );
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"reasoning_content\":\"thinking\""));
    }

    #[test]
    fn translates_cursor_text_payload() {
        let payloads = translate_cursor_payload(serde_json::json!({ "text": "hello" }));
        assert_eq!(payloads.len(), 1);
        assert!(payloads[0].contains("\"content\":\"hello\""));
    }
}
