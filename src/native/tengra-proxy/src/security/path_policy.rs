/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

use std::path::{Path, PathBuf};
use anyhow::{Result, bail};

pub struct PathPolicy {
    allowed_roots: Vec<PathBuf>,
}

impl PathPolicy {
    pub fn new(roots: Vec<PathBuf>) -> Self {
        Self {
            allowed_roots: roots.into_iter().map(|r| r.to_path_buf()).collect(),
        }
    }

    pub fn is_allowed<P: AsRef<Path>>(&self, path: P) -> bool {
        let path = path.as_ref();
        
        // Always allow relative paths if they don't escape via ..
        if path.is_relative() {
            if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
                // If it has ParentDir, we need to be careful. 
                // For simplicity, we might want to reject relative paths with .. 
                // or resolve them against a known base.
                return false; 
            }
            return true;
        }

        // For absolute paths, check against allowed roots
        for root in &self.allowed_roots {
            if path.starts_with(root) {
                return true;
            }
        }

        false
    }

    pub fn validate<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let path_ref = path.as_ref();
        if self.is_allowed(path_ref) {
            Ok(())
        } else {
            bail!("Access denied: path {:?} is outside of allowed workspace roots", path_ref)
        }
    }
}
