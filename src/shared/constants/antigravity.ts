/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Antigravity API Constants
 * Aligned with v1.107.0 reverse-engineering findings.
 */

export const ANTIGRAVITY_VERSION = '1.107.0';

export const ANTIGRAVITY_REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': `antigravity/${ANTIGRAVITY_VERSION}`,
  'IconX-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
  'Client-Metadata': JSON.stringify({
    ideType: 'ANTIGRAVITY',
    platform: 'PLATFORM_UNSPECIFIED',
    pluginType: 'GEMINI'
  })
} as const;

export const ANTIGRAVITY_ENDPOINTS = {
  LOAD_CODE_ASSIST: 'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist',
  FETCH_AVAILABLE_MODELS: 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
  ONBOARD_USER: 'https://cloudcode-pa.googleapis.com/v1internal:onboardUser',
  FETCH_USER: 'https://cloudcode-pa.googleapis.com/v1internal:fetchUser',
  SET_USER_SETTINGS: 'https://cloudcode-pa.googleapis.com/v1internal:setUserSettings',
} as const;

