/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use crate::analysis::ast::AstAnalyzer;
use serde::Serialize;

pub struct ConflictResolver {
    analyzer: AstAnalyzer,
}

#[derive(Debug, Serialize)]
pub struct ConflictAnalysis {
    pub has_conflicts: bool,
    pub blocks: Vec<ConflictBlock>,
}

#[derive(Debug, Serialize)]
pub struct ConflictBlock {
    pub start_line: usize,
    pub end_line: usize,
    pub affected_symbols: Vec<String>,
}

impl ConflictResolver {
    pub fn new() -> Self {
        Self {
            analyzer: AstAnalyzer::new(),
        }
    }

    pub fn analyze(&mut self, source: &str, lang: &str) -> Result<ConflictAnalysis, String> {
        let symbols = self.analyzer.get_symbols(source, lang).unwrap_or_default();

        let mut blocks = Vec::new();
        let lines: Vec<&str> = source.lines().collect();
        let mut in_conflict = false;
        let mut start_idx = 0;

        for (i, line) in lines.iter().enumerate() {
            if line.starts_with("<<<<<<<") {
                in_conflict = true;
                start_idx = i;
            } else if line.starts_with(">>>>>>>") && in_conflict {
                in_conflict = false;

                // Find symbols whose range overlaps with [start_idx, i]
                let mut affected = Vec::new();
                for sym in &symbols {
                    if sym.start_line <= i && sym.end_line >= start_idx {
                        affected.push(sym.name.clone());
                    }
                }

                blocks.push(ConflictBlock {
                    start_line: start_idx + 1,
                    end_line: i + 1,
                    affected_symbols: affected,
                });
            }
        }

        Ok(ConflictAnalysis {
            has_conflicts: !blocks.is_empty(),
            blocks,
        })
    }
}
