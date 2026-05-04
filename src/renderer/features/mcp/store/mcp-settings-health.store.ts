/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createComponentHealthStore } from '@/ui/store/component-health.store';

const mcpSettingsHealthStore = createComponentHealthStore('mcp-settings-tab', 450);

export const subscribeMcpSettingsHealth = mcpSettingsHealthStore.subscribe;
export const getMcpSettingsHealthSnapshot = mcpSettingsHealthStore.getSnapshot;
export const useMcpSettingsHealth = mcpSettingsHealthStore.useSnapshot;
export const setMcpSettingsUiState = mcpSettingsHealthStore.setUiState;
export const recordMcpSettingsSuccess = mcpSettingsHealthStore.recordSuccess;
export const recordMcpSettingsFailure = mcpSettingsHealthStore.recordFailure;
export const recordMcpSettingsRetry = mcpSettingsHealthStore.recordRetry;
export const recordMcpSettingsFallback = mcpSettingsHealthStore.recordFallback;
export const __resetMcpSettingsHealthForTests = mcpSettingsHealthStore.resetForTests;
