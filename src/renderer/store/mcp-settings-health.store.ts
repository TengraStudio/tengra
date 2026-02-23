import { createComponentHealthStore } from '@renderer/store/component-health.store';

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
