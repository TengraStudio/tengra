import React from 'react';

import {
    createShareCode,
    filterSnippets,
    loadProjectSnippets,
    parseShareCode,
    ProjectSnippet,
    saveProjectSnippets,
} from '@/features/projects/utils/snippet-manager';
import { useTranslation } from '@/i18n';
import { EditorTab } from '@/types';

export interface UseEditorSnippetsParams {
    activeTab: EditorTab | null;
    activeLanguage: string;
    projectKey: string;
    updateTabContent: (value: string) => void;
    setStatusMessage: (message: string) => void;
}

export interface UseEditorSnippetsResult {
    snippets: ProjectSnippet[];
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
function useSnippetCollection(activeLanguage: string, projectKey: string): {
    allSnippets: ProjectSnippet[];
    snippets: ProjectSnippet[];
    persistSnippets: (next: ProjectSnippet[]) => void;
} {
    const [allSnippets, setAllSnippets] = React.useState<ProjectSnippet[]>([]);

    const snippets = React.useMemo(
        () => filterSnippets(allSnippets, activeLanguage, projectKey),
        [activeLanguage, allSnippets, projectKey]
    );

    React.useEffect(() => {
        setAllSnippets(loadProjectSnippets());
    }, []);

    const persistSnippets = React.useCallback((next: ProjectSnippet[]) => {
        setAllSnippets(next);
        saveProjectSnippets(next);
    }, []);

    return { allSnippets, snippets, persistSnippets };
}

/**
 * Handles clipboard-based snippet import, export, and sharing.
 */
function useSnippetTransfer(
    snippets: ProjectSnippet[],
    allSnippets: ProjectSnippet[],
    selectedSnippetId: string,
    persistSnippets: (next: ProjectSnippet[]) => void,
    setStatusMessage: (message: string) => void,
): Pick<UseEditorSnippetsResult, 'exportSnippets' | 'importSnippets' | 'shareSelectedSnippet' | 'importShareCode'> {
    const { t } = useTranslation();

    const exportSnippets = React.useCallback(async () => {
        await window.electron.clipboard.writeText(JSON.stringify(snippets, null, 2));
        setStatusMessage(t('projectDashboard.editor.snippetExported'));
    }, [snippets, setStatusMessage, t]);

    const importSnippets = React.useCallback(async () => {
        const clipboard = await window.electron.clipboard.readText();
        if (!clipboard.success || !clipboard.text) {
            setStatusMessage(t('projectDashboard.editor.snippetImportFailed'));
            return;
        }
        try {
            const imported = JSON.parse(clipboard.text) as ProjectSnippet[];
            if (!Array.isArray(imported)) {
                setStatusMessage(t('projectDashboard.editor.snippetImportFailed'));
                return;
            }
            const normalized = imported
                .filter(s => typeof s.name === 'string' && typeof s.content === 'string')
                .map(s => ({
                    id: `${Date.now()}-${s.name}`,
                    name: s.name,
                    language: s.language || 'all',
                    projectKey: s.projectKey || 'global',
                    content: s.content,
                    createdAt: Date.now(),
                }));
            persistSnippets([...normalized, ...allSnippets]);
            setStatusMessage(t('projectDashboard.editor.snippetImported'));
        } catch {
            setStatusMessage(t('projectDashboard.editor.snippetImportFailed'));
        }
    }, [allSnippets, persistSnippets, setStatusMessage, t]);

    const shareSelectedSnippet = React.useCallback(async () => {
        const snippet = snippets.find(entry => entry.id === selectedSnippetId);
        if (!snippet) {
            return;
        }
        await window.electron.clipboard.writeText(createShareCode(snippet));
        setStatusMessage(t('projectDashboard.editor.snippetShareCodeCopied'));
    }, [selectedSnippetId, snippets, setStatusMessage, t]);

    const importShareCode = React.useCallback(async () => {
        const clipboard = await window.electron.clipboard.readText();
        if (!clipboard.success || !clipboard.text) {
            setStatusMessage(t('projectDashboard.editor.snippetImportFailed'));
            return;
        }
        const parsed = parseShareCode(clipboard.text);
        if (!parsed) {
            setStatusMessage(t('projectDashboard.editor.snippetImportFailed'));
            return;
        }
        persistSnippets([parsed, ...allSnippets]);
        setStatusMessage(t('projectDashboard.editor.snippetImported'));
    }, [allSnippets, persistSnippets, setStatusMessage, t]);

    return { exportSnippets, importSnippets, shareSelectedSnippet, importShareCode };
}

/**
 * Hook for managing editor code snippets including CRUD and clipboard transfer.
 */
export function useEditorSnippets({
    activeTab,
    activeLanguage,
    projectKey,
    updateTabContent,
    setStatusMessage,
}: UseEditorSnippetsParams): UseEditorSnippetsResult {
    const { t } = useTranslation();
    const [selectedSnippetId, setSelectedSnippetId] = React.useState('');
    const { allSnippets, snippets, persistSnippets } = useSnippetCollection(activeLanguage, projectKey);
    const transfer = useSnippetTransfer(snippets, allSnippets, selectedSnippetId, persistSnippets, setStatusMessage);

    const saveCurrentAsSnippet = React.useCallback(() => {
        if (!activeTab) {
            return;
        }
        const snippet: ProjectSnippet = {
            id: `${Date.now()}`,
            name: activeTab.name,
            language: activeLanguage,
            projectKey,
            content: activeTab.content,
            createdAt: Date.now(),
        };
        persistSnippets([snippet, ...allSnippets]);
        setStatusMessage(t('projectDashboard.editor.snippetSaved'));
    }, [activeLanguage, activeTab, allSnippets, persistSnippets, projectKey, setStatusMessage, t]);

    const insertSelectedSnippet = React.useCallback(() => {
        if (!activeTab) {
            return;
        }
        const snippet = snippets.find(entry => entry.id === selectedSnippetId);
        if (!snippet) {
            return;
        }
        updateTabContent(`${activeTab.content}\n${snippet.content}`);
        setStatusMessage(t('projectDashboard.editor.snippetInserted'));
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
