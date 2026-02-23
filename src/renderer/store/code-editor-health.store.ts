import { createComponentHealthStore } from '@renderer/store/component-health.store';

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
