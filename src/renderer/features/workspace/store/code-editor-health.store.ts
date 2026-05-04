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

const codeEditorHealthStore = createComponentHealthStore('renderer-code-editor', 900);

export const subscribeCodeEditorHealth = codeEditorHealthStore.subscribe;
export const getCodeEditorHealthSnapshot = codeEditorHealthStore.getSnapshot;
export const useCodeEditorHealth = codeEditorHealthStore.useSnapshot;
export const setCodeEditorUiState = codeEditorHealthStore.setUiState;
export const recordCodeEditorSuccess = codeEditorHealthStore.recordSuccess;
export const recordCodeEditorFailure = codeEditorHealthStore.recordFailure;
export const recordCodeEditorRetry = codeEditorHealthStore.recordRetry;
export const recordCodeEditorFallback = codeEditorHealthStore.recordFallback;
export const __resetCodeEditorHealthForTests = codeEditorHealthStore.resetForTests;
