/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { useTranslation } from '@/i18n';

interface UseEditorMacroParams {
    updateTabContent: (value: string) => void;
    setSnippetStatus: (status: string) => void;
}

/**
 * Manages macro recording, replay, export, and import.
 */
export function useEditorMacro({ updateTabContent, setSnippetStatus }: UseEditorMacroParams) {
    const { t } = useTranslation();
    const [recordMacro, setRecordMacro] = React.useState(false);
    const [macroSteps, setMacroSteps] = React.useState<string[]>([]);

    const recordMacroStep = React.useCallback((nextValue: string, prevValue: string) => {
        if (nextValue !== prevValue) {
            setMacroSteps(previous => [...previous, nextValue].slice(-20));
        }
    }, []);

    const replayMacro = React.useCallback(() => {
        if (macroSteps.length === 0) {
            return;
        }
        const lastStep = macroSteps[macroSteps.length - 1];
        if (!lastStep) {
            return;
        }
        updateTabContent(lastStep);
        setSnippetStatus(t('frontend.workspaceDashboard.editor.macroReplayed'));
    }, [macroSteps, t, updateTabContent, setSnippetStatus]);

    const exportMacro = React.useCallback(async () => {
        await window.electron.clipboard.writeText(JSON.stringify(macroSteps));
        setSnippetStatus(t('frontend.workspaceDashboard.editor.macroExported'));
    }, [macroSteps, t, setSnippetStatus]);

    const importMacro = React.useCallback(async () => {
        const clip = await window.electron.clipboard.readText();
        if (!clip.success || !clip.text) {
            return;
        }
        try {
            const parsed = JSON.parse(clip.text) as string[];
            if (Array.isArray(parsed)) {
                setMacroSteps(parsed.filter(step => typeof step === 'string').slice(-20));
                setSnippetStatus(t('frontend.workspaceDashboard.editor.macroImported'));
            }
        } catch {
            setSnippetStatus(t('frontend.workspaceDashboard.editor.macroImportFailed'));
        }
    }, [t, setSnippetStatus]);

    return {
        recordMacro,
        setRecordMacro,
        macroSteps,
        recordMacroStep,
        replayMacro,
        exportMacro,
        importMacro,
    };
}

