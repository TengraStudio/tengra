import React from 'react';

import { useTranslation } from '@/i18n';

const MACRO_STEP_LIMIT = 20;

interface MacroState {
    recording: boolean;
    steps: string[];
}

type MacroAction =
    | { type: 'SET_RECORDING'; recording: boolean }
    | { type: 'APPEND_STEP'; content: string }
    | { type: 'SET_STEPS'; steps: string[] };

function macroReducer(state: MacroState, action: MacroAction): MacroState {
    switch (action.type) {
        case 'SET_RECORDING':
            return { ...state, recording: action.recording };
        case 'APPEND_STEP':
            return { ...state, steps: [...state.steps, action.content].slice(-MACRO_STEP_LIMIT) };
        case 'SET_STEPS':
            return { ...state, steps: action.steps };
    }
}

const MACRO_INITIAL_STATE: MacroState = { recording: false, steps: [] };

export interface UseEditorMacrosParams {
    updateTabContent: (value: string) => void;
    setStatusMessage: (message: string) => void;
}

export interface UseEditorMacrosResult {
    recording: boolean;
    setRecording: (recording: boolean) => void;
    steps: string[];
    appendStep: (content: string) => void;
    replayMacro: () => void;
    exportMacro: () => Promise<void>;
    importMacro: () => Promise<void>;
}

/**
 * Hook for managing editor macro recording, replay, and clipboard transfer.
 */
export function useEditorMacros({
    updateTabContent,
    setStatusMessage,
}: UseEditorMacrosParams): UseEditorMacrosResult {
    const { t } = useTranslation();
    const [state, dispatch] = React.useReducer(macroReducer, MACRO_INITIAL_STATE);

    const setRecording = React.useCallback((recording: boolean) => {
        dispatch({ type: 'SET_RECORDING', recording });
    }, []);

    const appendStep = React.useCallback((content: string) => {
        dispatch({ type: 'APPEND_STEP', content });
    }, []);

    const replayMacro = React.useCallback(() => {
        if (state.steps.length === 0) {
            return;
        }
        const lastStep = state.steps[state.steps.length - 1];
        if (!lastStep) {
            return;
        }
        updateTabContent(lastStep);
        setStatusMessage(t('projectDashboard.editor.macroReplayed'));
    }, [state.steps, setStatusMessage, t, updateTabContent]);

    const exportMacro = React.useCallback(async () => {
        await window.electron.clipboard.writeText(JSON.stringify(state.steps));
        setStatusMessage(t('projectDashboard.editor.macroExported'));
    }, [state.steps, setStatusMessage, t]);

    const importMacro = React.useCallback(async () => {
        const clip = await window.electron.clipboard.readText();
        if (!clip.success || !clip.text) {
            return;
        }
        try {
            const parsed = JSON.parse(clip.text) as string[];
            if (Array.isArray(parsed)) {
                const filtered = parsed.filter(step => typeof step === 'string').slice(-MACRO_STEP_LIMIT);
                dispatch({ type: 'SET_STEPS', steps: filtered });
                setStatusMessage(t('projectDashboard.editor.macroImported'));
            }
        } catch {
            setStatusMessage(t('projectDashboard.editor.macroImportFailed'));
        }
    }, [setStatusMessage, t]);

    return {
        recording: state.recording,
        setRecording,
        steps: state.steps,
        appendStep,
        replayMacro,
        exportMacro,
        importMacro,
    };
}
