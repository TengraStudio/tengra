import { createComponentHealthStore } from '@renderer/store/component-health.store';

const languageSelectionHealthStore = createComponentHealthStore('language-selection-prompt', 300);

export const subscribeLanguageSelectionHealth = languageSelectionHealthStore.subscribe;
export const getLanguageSelectionHealthSnapshot = languageSelectionHealthStore.getSnapshot;
export const useLanguageSelectionHealth = languageSelectionHealthStore.useSnapshot;
export const setLanguageSelectionUiState = languageSelectionHealthStore.setUiState;
export const recordLanguageSelectionSuccess = languageSelectionHealthStore.recordSuccess;
export const recordLanguageSelectionFailure = languageSelectionHealthStore.recordFailure;
export const recordLanguageSelectionRetry = languageSelectionHealthStore.recordRetry;
export const recordLanguageSelectionFallback = languageSelectionHealthStore.recordFallback;
export const __resetLanguageSelectionHealthForTests = languageSelectionHealthStore.resetForTests;
