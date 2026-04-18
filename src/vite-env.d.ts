/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_WEBSOCKET_URL?: string
    readonly VITE_API_URL?: string
    readonly VITE_DEBUG?: string
    // Add more env variables as needed
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
