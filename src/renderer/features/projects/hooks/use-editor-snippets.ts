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

interface UseEditorSnippetsParams {
    activeLanguage: string;
    projectKey: string;
    activeTabContent: string | undefined;
    activeTabName: string | undefined;
    updateTabContent: (value: string) => void;
}

/**
 * Manages snippet state: loading, saving, inserting, importing/exporting, and sharing.
 */
export function useEditorSnippets({
    activeLanguage,
    projectKey,
    activeTabContent,
    activeTabName,
    updateTabContent,
}: UseEditorSnippetsParams) {
    const { t } = useTranslation();
    const [allSnippets, setAllSnippets] = React.useState<ProjectSnippet[]>([]);
    const [selectedSnippetId, setSelectedSnippetId] = React.useState('');
    const [snippetStatus, setSnippetStatus] = React.useState('');

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

    const saveCurrentAsSnippet = React.useCallback(() => {
        if (activeTabContent === undefined || !activeTabName) {
            return;
        }
        const snippet: ProjectSnippet = {
            id: `${Date.now()}`,
            name: activeTabName,
            language: activeLanguage,
            projectKey,
            content: activeTabContent,
            createdAt: Date.now(),
        };
        persistSnippets([snippet, ...allSnippets]);
        setSnippetStatus(t('projectDashboard.editor.snippetSaved'));
    }, [activeLanguage, activeTabContent, activeTabName, allSnippets, persistSnippets, projectKey, t]);

    const insertSelectedSnippet = React.useCallback(() => {
        if (activeTabContent === undefined) {
            return;
        }
        const snippet = snippets.find(entry => entry.id === selectedSnippetId);
        if (!snippet) {
            return;
        }
        updateTabContent(`${activeTabContent}\n${snippet.content}`);
        setSnippetStatus(t('projectDashboard.editor.snippetInserted'));
    }, [activeTabContent, selectedSnippetId, snippets, t, updateTabContent]);

    const exportSnippets = React.useCallback(async () => {
        const exportPayload = JSON.stringify(snippets, null, 2);
        await window.electron.clipboard.writeText(exportPayload);
        setSnippetStatus(t('projectDashboard.editor.snippetExported'));
    }, [snippets, t]);

    const importSnippets = React.useCallback(async () => {
        const clipboard = await window.electron.clipboard.readText();
        if (!clipboard.success || !clipboard.text) {
            setSnippetStatus(t('projectDashboard.editor.snippetImportFailed'));
            return;
        }
        try {
            const imported = JSON.parse(clipboard.text) as ProjectSnippet[];
            if (!Array.isArray(imported)) {
                setSnippetStatus(t('projectDashboard.editor.snippetImportFailed'));
                return;
            }
            const normalized = imported
                .filter(snippet => typeof snippet.name === 'string' && typeof snippet.content === 'string')
                .map(snippet => ({
                    id: `${Date.now()}-${snippet.name}`,
                    name: snippet.name,
                    language: snippet.language || 'all',
                    projectKey: snippet.projectKey || 'global',
                    content: snippet.content,
                    createdAt: Date.now(),
                }));
            persistSnippets([...normalized, ...allSnippets]);
            setSnippetStatus(t('projectDashboard.editor.snippetImported'));
        } catch {
            setSnippetStatus(t('projectDashboard.editor.snippetImportFailed'));
        }
    }, [allSnippets, persistSnippets, t]);

    const shareSelectedSnippet = React.useCallback(async () => {
        const snippet = snippets.find(entry => entry.id === selectedSnippetId);
        if (!snippet) {
            return;
        }
        const shareCode = createShareCode(snippet);
        await window.electron.clipboard.writeText(shareCode);
        setSnippetStatus(t('projectDashboard.editor.snippetShareCodeCopied'));
    }, [selectedSnippetId, snippets, t]);

    const importShareCode = React.useCallback(async () => {
        const clipboard = await window.electron.clipboard.readText();
        if (!clipboard.success || !clipboard.text) {
            setSnippetStatus(t('projectDashboard.editor.snippetImportFailed'));
            return;
        }
        const parsed = parseShareCode(clipboard.text);
        if (!parsed) {
            setSnippetStatus(t('projectDashboard.editor.snippetImportFailed'));
            return;
        }
        persistSnippets([parsed, ...allSnippets]);
        setSnippetStatus(t('projectDashboard.editor.snippetImported'));
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
