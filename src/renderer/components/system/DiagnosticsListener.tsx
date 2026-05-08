/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useEffect } from 'react';
import type * as protocol from 'vscode-languageserver-protocol';

import { updateFileDiagnostics } from '@/store/diagnostics.store';
import { appLogger } from '@/utils/renderer-logger';

/**
 * Global component that listens for LSP diagnostics from the main process
 * and updates the central diagnostics store.
 */
export function DiagnosticsListener(): null {
    useEffect(() => {
        appLogger.info('DiagnosticsListener', 'Initializing global LSP diagnostic listener');

        const unsubscribe = window.electron.ipcRenderer.on('lsp:diagnostics-updated', (_event, data: {
            workspaceId: string;
            uri: string;
            diagnostics: protocol.Diagnostic[];
        }) => {
            updateFileDiagnostics(data.workspaceId, data.uri, data.diagnostics);
        });

        return () => {
            unsubscribe();
            appLogger.info('DiagnosticsListener', 'Disposing global LSP diagnostic listener');
        };
    }, []);

    return null;
}
