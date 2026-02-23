import { createComponentHealthStore } from '@renderer/store/component-health.store';

const terminalToolbarHealthStore = createComponentHealthStore('terminal-toolbar', 250);

export const subscribeTerminalToolbarHealth = terminalToolbarHealthStore.subscribe;
export const getTerminalToolbarHealthSnapshot = terminalToolbarHealthStore.getSnapshot;
export const useTerminalToolbarHealth = terminalToolbarHealthStore.useSnapshot;
export const setTerminalToolbarUiState = terminalToolbarHealthStore.setUiState;
export const recordTerminalToolbarSuccess = terminalToolbarHealthStore.recordSuccess;
export const recordTerminalToolbarFailure = terminalToolbarHealthStore.recordFailure;
export const recordTerminalToolbarRetry = terminalToolbarHealthStore.recordRetry;
export const recordTerminalToolbarFallback = terminalToolbarHealthStore.recordFallback;
export const __resetTerminalToolbarHealthForTests = terminalToolbarHealthStore.resetForTests;
