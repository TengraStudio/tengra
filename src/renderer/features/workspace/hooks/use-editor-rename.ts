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

interface UseEditorRenameParams {
    workspacePath: string | undefined;
}

/**
 * Manages rename guard state: from/to symbols, exclude pattern, and impact preview.
 */
export function useEditorRename({ workspacePath }: UseEditorRenameParams) {
    const { t } = useTranslation();
    const [renameFrom, setRenameFrom] = React.useState('');
    const [renameTo, setRenameTo] = React.useState('');
    const [excludePattern, setExcludePattern] = React.useState('dist|build|generated');
    const [renameImpact, setRenameImpact] = React.useState('');

    const previewRename = React.useCallback(async () => {
        if (!workspacePath || !renameFrom || !renameTo) {
            return;
        }
        const preview = await window.electron.code.previewRenameSymbol(workspacePath, renameFrom, renameTo, 200);
        const excluded = preview.updatedFiles.filter(file => new RegExp(excludePattern, 'i').test(file));
        if (excluded.length > 0) {
            setRenameImpact(t('workspaceDashboard.editor.renameBlocked', { count: excluded.length }));
            return;
        }
        setRenameImpact(t('workspaceDashboard.editor.renameImpact', { files: preview.totalFiles, occurrences: preview.totalOccurrences }));
    }, [excludePattern, workspacePath, renameFrom, renameTo, t]);

    return {
        renameFrom,
        setRenameFrom,
        renameTo,
        setRenameTo,
        excludePattern,
        setExcludePattern,
        renameImpact,
        previewRename,
    };
}
