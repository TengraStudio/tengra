import {
    createWorkspaceShareCode,
    filterWorkspaceSnippets,
    loadWorkspaceSnippets,
    parseWorkspaceShareCode,
    saveWorkspaceSnippets,
    WorkspaceSnippet,
} from '@renderer/features/workspace/utils/snippet-manager';
import React from 'react';

import { useTranslation } from '@/i18n';

interface UseEditorSnippetsParams {
    activeLanguage: string;
    workspaceKey: string;
    activeTabContent: string | undefined;
    activeTabName: string | undefined;
    updateTabContent: (value: string) => void;
}

/**
 * Manages snippet state: loading, saving, inserting, importing/exporting, and sharing.
 */
export function useEditorSnippets({
    activeLanguage,
    workspaceKey,
    activeTabContent,
    activeTabName,
    updateTabContent,
}: UseEditorSnippetsParams) {
    const { t } = useTranslation();
    const [allSnippets, setAllSnippets] = React.useState<WorkspaceSnippet[]>([]);
    const [selectedSnippetId, setSelectedSnippetId] = React.useState('');
    const [snippetStatus, setSnippetStatus] = React.useState('');

    const snippets = React.useMemo(
        () => filterWorkspaceSnippets(allSnippets, activeLanguage, workspaceKey),
        [activeLanguage, allSnippets, workspaceKey]
    );

    React.useEffect(() => {
        setAllSnippets(loadWorkspaceSnippets());
    }, []);

    const persistSnippets = React.useCallback((next: WorkspaceSnippet[]) => {
        setAllSnippets(next);
        saveWorkspaceSnippets(next);
    }, []);

    const saveCurrentAsSnippet = React.useCallback(() => {
        if (activeTabContent === undefined || !activeTabName) {
            return;
        }
        const snippet: WorkspaceSnippet = {
            id: `${Date.now()}`,
            name: activeTabName,
            language: activeLanguage,
            workspaceKey,
            content: activeTabContent,
            createdAt: Date.now(),
        };
        persistSnippets([snippet, ...allSnippets]);
        setSnippetStatus(t('workspaceDashboard.editor.snippetSaved'));
    }, [activeLanguage, activeTabContent, activeTabName, allSnippets, persistSnippets, workspaceKey, t]);

    const insertSelectedSnippet = React.useCallback(() => {
        if (activeTabContent === undefined) {
            return;
        }
        const snippet = snippets.find(entry => entry.id === selectedSnippetId);
        if (!snippet) {
            return;
        }
        updateTabContent(`${activeTabContent}\n${snippet.content}`);
        setSnippetStatus(t('workspaceDashboard.editor.snippetInserted'));
    }, [activeTabContent, selectedSnippetId, snippets, t, updateTabContent]);

    const exportSnippets = React.useCallback(async () => {
        const exportPayload = JSON.stringify(snippets, null, 2);
        await window.electron.clipboard.writeText(exportPayload);
        setSnippetStatus(t('workspaceDashboard.editor.snippetExported'));
    }, [snippets, t]);

    const importSnippets = React.useCallback(async () => {
        const clipboard = await window.electron.clipboard.readText();
        if (!clipboard.success || !clipboard.text) {
            setSnippetStatus(t('workspaceDashboard.editor.snippetImportFailed'));
            return;
        }
        try {
            const imported = JSON.parse(clipboard.text) as WorkspaceSnippet[];
            if (!Array.isArray(imported)) {
                setSnippetStatus(t('workspaceDashboard.editor.snippetImportFailed'));
                return;
            }
            const normalized = imported
                .filter(snippet => typeof snippet.name === 'string' && typeof snippet.content === 'string')
                .map(snippet => ({
                    id: `${Date.now()}-${snippet.name}`,
                    name: snippet.name,
                    language: snippet.language || 'all',
                    workspaceKey: snippet.workspaceKey || 'global',
                    content: snippet.content,
                    createdAt: Date.now(),
                }));
            persistSnippets([...normalized, ...allSnippets]);
            setSnippetStatus(t('workspaceDashboard.editor.snippetImported'));
        } catch {
            setSnippetStatus(t('workspaceDashboard.editor.snippetImportFailed'));
        }
    }, [allSnippets, persistSnippets, t]);

    const shareSelectedSnippet = React.useCallback(async () => {
        const snippet = snippets.find(entry => entry.id === selectedSnippetId);
        if (!snippet) {
            return;
        }
        const shareCode = createWorkspaceShareCode(snippet);
        await window.electron.clipboard.writeText(shareCode);
        setSnippetStatus(t('workspaceDashboard.editor.snippetShareCodeCopied'));
    }, [selectedSnippetId, snippets, t]);

    const importShareCode = React.useCallback(async () => {
        const clipboard = await window.electron.clipboard.readText();
        if (!clipboard.success || !clipboard.text) {
            setSnippetStatus(t('workspaceDashboard.editor.snippetImportFailed'));
            return;
        }
        const parsed = parseWorkspaceShareCode(clipboard.text);
        if (!parsed) {
            setSnippetStatus(t('workspaceDashboard.editor.snippetImportFailed'));
            return;
        }
        persistSnippets([parsed, ...allSnippets]);
        setSnippetStatus(t('workspaceDashboard.editor.snippetImported'));
    }, [allSnippets, persistSnippets, t]);

    return {
        snippets,
        selectedSnippetId,
        setSelectedSnippetId,
        snippetStatus,
        setSnippetStatus,
        saveCurrentAsSnippet,
        insertSelectedSnippet,
        exportSnippets,
        importSnippets,
        shareSelectedSnippet,
        importShareCode,
    };
}
