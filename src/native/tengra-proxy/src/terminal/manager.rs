/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::terminal::session::TerminalSession;
use dashmap::DashMap;
use std::sync::Arc;

pub struct TerminalManager {
    sessions: DashMap<String, Arc<TerminalSession>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: DashMap::new(),
        }
    }

    pub fn create_session(
        &self,
        cwd: Option<String>,
        shell: Option<String>,
        args: Option<Vec<String>>,
    ) -> anyhow::Result<String> {
        let session = TerminalSession::new(cwd, shell, args)?;
        let id = session.id.clone();
        self.sessions.insert(id.clone(), Arc::new(session));
        Ok(id)
    }

    pub fn get_session(&self, id: &str) -> Option<Arc<TerminalSession>> {
        self.sessions.get(id).map(|s| s.clone())
    }

    pub fn remove_session(&self, id: &str) {
        self.sessions.remove(id);
    }

    pub fn list_sessions(&self) -> Vec<String> {
        self.sessions.iter().map(|s| s.key().clone()).collect()
    }
}
