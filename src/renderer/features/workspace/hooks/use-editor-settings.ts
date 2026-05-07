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

interface EditorViewState {
    lineNumber: number;
    column: number;
    scrollTop: number;
}

interface UseEditorSettingsParams {
    workspaceKey: string;
    contentLength: number;
}

/**
 * Manages editor feature toggles: inlay hints, code lens, performance mode, and view state persistence.
 */
export function useEditorSettings({ workspaceKey, contentLength }: UseEditorSettingsParams) {
    const [enableInlayHints, setEnableInlayHints] = React.useState(true);
    const [enableCodeLens, setEnableCodeLens] = React.useState(true);
    const [performanceOverride, setPerformanceOverride] = React.useState(false);
    const [, setViewStateMap] = React.useState<Record<string, EditorViewState>>({});

    const performanceMode = !performanceOverride && contentLength > 20000;
    const viewStateStorageKey = `workspace.editor.viewstate:${workspaceKey}`;

    React.useEffect(() => {
        try {
            const raw = localStorage.getItem(viewStateStorageKey);
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw) as Record<string, EditorViewState>;
            setViewStateMap(parsed);
        } catch {
            setViewStateMap({});
        }
    }, [viewStateStorageKey]);

    return {
        enableInlayHints,
        setEnableInlayHints,
        enableCodeLens,
        setEnableCodeLens,
        performanceOverride,
        setPerformanceOverride,
        performanceMode,
    };
}

