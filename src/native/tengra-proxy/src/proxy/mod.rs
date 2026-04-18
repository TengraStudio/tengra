/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
pub mod antigravity;
pub mod handlers;
pub mod model_catalog;
pub mod model_service;
pub mod server;
pub mod skills;
pub mod types;

pub use server::AppState;
