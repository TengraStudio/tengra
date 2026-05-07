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

import {
    createWorkspaceShareCode,
    filterWorkspaceSnippets,
    loadWorkspaceSnippets,
    parseWorkspaceShareCode,
    saveWorkspaceSnippets,
    WorkspaceSnippet,
} from '@/features/workspace/utils/snippet-manager';
import { useTranslation } from '@/i18n';
import { EditorTab } from '@/types';

export interface UseEditorSnippetsParams {
    activeTab: EditorTab | null;
    activeLanguage: string;
    workspaceKey: string;
    updateTabContent: (value: string) => void;
    setStatusMessage: (message: string) => void;
}

export interface UseEditorSnippetsResult {
    snippets: WorkspaceSnippet[];
    selectedSnippetId: string;
    setSelectedSnippetId: (id: string) => void;
    saveCurrentAsSnippet: () => void;
    insertSelectedSnippet: () => void;
    exportSnippets: () => Promise<void>;
    importSnippets: () => Promise<void>;
    shareSelectedSnippet: () => Promise<void>;
    importShareCode: () => Promise<void>;
}

/**
 * Manages snippet collection state and persistence.
 */
function useSnippetCollection(activeLanguage: string, workspaceKey: string): {
    allSnippets: WorkspaceSnippet[];
    snippets: WorkspaceSnippet[];
    persistSnippets: (next: WorkspaceSnippet[]) => void;
} {
    const [allSnippets, setAllSnippets] = React.useState<WorkspaceSnippet[]>(() => loadWorkspaceSnippets());

    const snippets = React.useMemo(
        () => filterWorkspaceSnippets(allSnippets, activeLanguage, workspaceKey),
        [activeLanguage, allSnippets, workspaceKey]
    );

    const persistSnippets = React.useCallback((next: WorkspaceSnippet[]) => {
        setAllSnippets(next);
        saveWorkspaceSnippets(next);
    }, []);

    return { allSnippets, snippets, persistSnippets };
}

/**
 * Handles clipboard-based snippet import, export, and sharing.
 */
function useSnippetTransfer(
    snippets: WorkspaceSnippet[],
    allSnippets: WorkspaceSnippet[],
    selectedSnippetId: string,
    persistSnippets: (next: WorkspaceSnippet[]) => void,
    setStatusMessage: (message: string) => void,
): Pick<UseEditorSnippetsResult, 'exportSnippets' | 'importSnippets' | 'shareSelectedSnippet' | 'importShareCode'> {
    const { t } = useTranslation();

    const exportSnippets = React.useCallback(async () => {
        await window.electron.clipboard.writeText(JSON.stringify(snippets, null, 2));
        setStatusMessage(t('frontend.workspaceDashboard.editor.snippetExported'));
    }, [snippets, setStatusMessage, t]);

    const importSnippets = React.useCallback(async () => {
        const clipboard = await window.electron.clipboard.readText();
        if (!clipboard.success || !clipboard.text) {
            setStatusMessage(t('frontend.workspaceDashboard.editor.snippetImportFailed'));
            return;
        }
        try {
            const imported = JSON.parse(clipboard.text) as WorkspaceSnippet[];
            if (!Array.isArray(imported)) {
                setStatusMessage(t('frontend.workspaceDashboard.editor.snippetImportFailed'));
                return;
            }
            const normalized = imported
                .filter(s => typeof s.name === 'string' && typeof s.content === 'string')
                .map(s => ({
                    id: `${Date.now()}-${s.name}`,
                    name: s.name,
                    language: s.language || 'all',
                    workspaceKey: s.workspaceKey || 'global',
                    content: s.content,
                    createdAt: Date.now(),
                }));
            persistSnippets([...normalized, ...allSnippets]);
            setStatusMessage(t('frontend.workspaceDashboard.editor.snippetImported'));
        } catch {
            setStatusMessage(t('frontend.workspaceDashboard.editor.snippetImportFailed'));
        }
    }, [allSnippets, persistSnippets, setStatusMessage, t]);

    const shareSelectedSnippet = React.useCallback(async () => {
        const snippet = snippets.find(entry => entry.id === selectedSnippetId);
        if (!snippet) {
            return;
        }
        await window.electron.clipboard.writeText(createWorkspaceShareCode(snippet));
        setStatusMessage(t('frontend.workspaceDashboard.editor.snippetShareCodeCopied'));
    }, [selectedSnippetId, snippets, setStatusMessage, t]);

    const importShareCode = React.useCallback(async () => {
        const clipboard = await window.electron.clipboard.readText();
        if (!clipboard.success || !clipboard.text) {
            setStatusMessage(t('frontend.workspaceDashboard.editor.snippetImportFailed'));
            return;
        }
        const parsed = parseWorkspaceShareCode(clipboard.text);
        if (!parsed) {
            setStatusMessage(t('frontend.workspaceDashboard.editor.snippetImportFailed'));
            return;
        }
        persistSnippets([parsed, ...allSnippets]);
        setStatusMessage(t('frontend.workspaceDashboard.editor.snippetImported'));
    }, [allSnippets, persistSnippets, setStatusMessage, t]);

    return { exportSnippets, importSnippets, shareSelectedSnippet, importShareCode };
}

/**
 * Hook for managing editor code snippets including CRUD and clipboard transfer.
 */
export function useEditorSnippets({
    activeTab,
    activeLanguage,
    workspaceKey,
    updateTabContent,
    setStatusMessage,
}: UseEditorSnippetsParams): UseEditorSnippetsResult {
    const { t } = useTranslation();
    const [selectedSnippetId, setSelectedSnippetId] = React.useState('');
    const { allSnippets, snippets, persistSnippets } = useSnippetCollection(activeLanguage, workspaceKey);
    const transfer = useSnippetTransfer(snippets, allSnippets, selectedSnippetId, persistSnippets, setStatusMessage);

    const saveCurrentAsSnippet = React.useCallback(() => {
        if (!activeTab) {
            return;
        }
        const snippet: WorkspaceSnippet = {
            id: `${Date.now()}`,
            name: activeTab.name,
            language: activeLanguage,
            workspaceKey,
            content: activeTab.content,
            createdAt: Date.now(),
        };
        persistSnippets([snippet, ...allSnippets]);
        setStatusMessage(t('frontend.workspaceDashboard.editor.snippetSaved'));
    }, [activeLanguage, activeTab, allSnippets, persistSnippets, workspaceKey, setStatusMessage, t]);

    const insertSelectedSnippet = React.useCallback(() => {
        if (!activeTab) {
            return;
        }
        const snippet = snippets.find(entry => entry.id === selectedSnippetId);
        if (!snippet) {
            return;
        }
        updateTabContent(`${activeTab.content}\n${snippet.content}`);
        setStatusMessage(t('frontend.workspaceDashboard.editor.snippetInserted'));
    }, [activeTab, selectedSnippetId, snippets, setStatusMessage, t, updateTabContent]);

    return {
        snippets,
        selectedSnippetId,
        setSelectedSnippetId,
        saveCurrentAsSnippet,
        insertSelectedSnippet,
        ...transfer,
    };
}

