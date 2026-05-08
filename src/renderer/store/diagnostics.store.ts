/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useSyncExternalStore } from 'react';
import type * as protocol from 'vscode-languageserver-protocol';

type Listener = () => void;

export interface FileDiagnostics {
    uri: string;
    diagnostics: protocol.Diagnostic[];
    errorCount: number;
    warningCount: number;
}

const diagnosticsState = new Map<string, Map<string, FileDiagnostics>>();
const analyzingState = new Map<string, boolean>();
const listeners = new Set<Listener>();

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

export function updateFileDiagnostics(
    workspaceId: string,
    uri: string,
    diagnostics: protocol.Diagnostic[]
): void {
    let workspaceMap = diagnosticsState.get(workspaceId);
    if (!workspaceMap) {
        workspaceMap = new Map();
        diagnosticsState.set(workspaceId, workspaceMap);
    }

    const errorCount = diagnostics.filter(d => d.severity === 1).length;
    const warningCount = diagnostics.filter(d => d.severity === 2).length;

    workspaceMap.set(uri, {
        uri,
        diagnostics,
        errorCount,
        warningCount,
    });
    emit();
}

export function clearWorkspaceDiagnostics(workspaceId: string): void {
    diagnosticsState.delete(workspaceId);
    analyzingState.delete(workspaceId);
    emit();
}

export function setAnalyzing(workspaceId: string, isAnalyzing: boolean): void {
    if (analyzingState.get(workspaceId) === isAnalyzing) return;
    analyzingState.set(workspaceId, isAnalyzing);
    emit();
}

export function subscribeDiagnosticsStore(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getDiagnosticsSnapshot(): Map<string, Map<string, FileDiagnostics>> {
    return diagnosticsState;
}

export function useFileDiagnostics(workspaceId: string | undefined, uri: string | undefined): FileDiagnostics | null {
    const subscribe = useCallback((listener: () => void) => subscribeDiagnosticsStore(listener), []);
    const getSnapshot = useCallback(() => getDiagnosticsSnapshot(), []);
    const state = useSyncExternalStore(subscribe, getSnapshot);

    if (!workspaceId || !uri) {
        return null;
    }

    return state.get(workspaceId)?.get(uri) ?? null;
}

export function useWorkspaceDiagnostics(workspaceId: string | undefined): Map<string, FileDiagnostics> | null {
    const subscribe = useCallback((listener: () => void) => subscribeDiagnosticsStore(listener), []);
    const getSnapshot = useCallback(() => getDiagnosticsSnapshot(), []);
    const state = useSyncExternalStore(subscribe, getSnapshot);

    if (!workspaceId) {
        return null;
    }

    return state.get(workspaceId) ?? null;
}

export function useAnalyzing(workspaceId: string | undefined): boolean {
    const subscribe = useCallback((listener: () => void) => subscribeDiagnosticsStore(listener), []);
    const getSnapshot = useCallback(() => {
        if (!workspaceId) return false;
        return analyzingState.get(workspaceId) ?? false;
    }, [workspaceId]);
    return useSyncExternalStore(subscribe, getSnapshot);
}

export function useWorkspaceDiagnosticCounts(workspaceId: string | undefined): { errors: number; warnings: number } {
    const diagnostics = useWorkspaceDiagnostics(workspaceId);
    if (!diagnostics) return { errors: 0, warnings: 0 };

    let errors = 0;
    let warnings = 0;
    for (const fileDiag of diagnostics.values()) {
        errors += fileDiag.errorCount;
        warnings += fileDiag.warningCount;
    }
    return { errors, warnings };
}
