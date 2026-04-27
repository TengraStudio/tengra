use serde::{Deserialize, Serialize};
/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use tree_sitter::{Language, Node, Parser};

#[derive(Debug, Serialize, Deserialize)]
pub struct Symbol {
    pub name: String,
    pub kind: String,
    pub start_line: usize,
    pub start_col: usize,
    pub end_line: usize,
    pub end_col: usize,
}

pub struct AstAnalyzer {
    parser: Parser,
}

impl AstAnalyzer {
    pub fn new() -> Self {
        Self {
            parser: Parser::new(),
        }
    }

    fn get_language(&self, lang_id: &str) -> Result<Language, String> {
        match lang_id {
            "rust" => Ok(tree_sitter_rust::LANGUAGE.into()),
            "typescript" => Ok(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()),
            "tsx" => Ok(tree_sitter_typescript::LANGUAGE_TSX.into()),
            _ => Err(format!("Unsupported tree-sitter language: {}", lang_id)),
        }
    }

    pub fn get_symbols(&mut self, source: &str, lang_id: &str) -> Result<Vec<Symbol>, String> {
        let lang = self.get_language(lang_id)?;
        self.parser.set_language(&lang).map_err(|e| e.to_string())?;

        let tree = self.parser.parse(source, None).ok_or("Parse failed")?;
        let root_node = tree.root_node();

        let mut symbols = Vec::new();
        self.extract_symbols(root_node, source, &mut symbols, lang_id);

        Ok(symbols)
    }

    fn extract_symbols(&self, node: Node, source: &str, symbols: &mut Vec<Symbol>, lang_id: &str) {
        let kind = node.kind();

        let is_symbol = match lang_id {
            "rust" => matches!(
                kind,
                "function_item"
                    | "struct_item"
                    | "enum_item"
                    | "trait_item"
                    | "impl_item"
                    | "mod_item"
            ),
            "typescript" | "tsx" => matches!(
                kind,
                "class_declaration"
                    | "function_declaration"
                    | "method_definition"
                    | "interface_declaration"
                    | "type_alias_declaration"
                    | "enum_declaration"
            ),
            _ => false,
        };

        if is_symbol {
            // Find the name child
            let name_node = match lang_id {
                "rust" => node.child_by_field_name("name"),
                "typescript" | "tsx" => node.child_by_field_name("name"),
                _ => None,
            };

            if let Some(name_node) = name_node {
                let name = &source[name_node.start_byte()..name_node.end_byte()];
                symbols.push(Symbol {
                    name: name.to_string(),
                    kind: kind.to_string(),
                    start_line: node.start_position().row,
                    start_col: node.start_position().column,
                    end_line: node.end_position().row,
                    end_col: node.end_position().column,
                });
            }
        }

        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            self.extract_symbols(child, source, symbols, lang_id);
        }
    }
}
