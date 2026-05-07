/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createComponentHealthStore } from '@/store/component-health.store';

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

