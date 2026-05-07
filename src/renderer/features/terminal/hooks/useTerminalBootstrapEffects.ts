/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { type MutableRefObject, useEffect, useRef } from 'react';

import type { TerminalTab } from '@/types';

import type { ShellInfo,TerminalBackendInfo } from './useTerminalBackendsAndRemote';

type TerminalDiscoverySnapshot = {
    terminalAvailable: boolean;
    shells: ShellInfo[];
    backends: TerminalBackendInfo[];
    refreshedAt: number;
};

type UseTerminalBootstrapEffectsParams = {
    isOpen: boolean;
    tabsLength: number;
    tabsRef: MutableRefObject<TerminalTab[]>;
    availableShells: ShellInfo[];
    availableBackends: TerminalBackendInfo[];
    isLoadingShells: boolean;
    isLoadingBackends: boolean;
    isLoadingRemoteConnections: boolean;
    isNewTerminalMenuOpen: boolean;
    isCreatingRef: MutableRefObject<boolean>;
    hasAutoCreatedRef: MutableRefObject<boolean>;
    fetchDiscoverySnapshot: (refresh?: boolean) => Promise<TerminalDiscoverySnapshot>;
    fetchRemoteConnections: () => Promise<void>;
    resolveDefaultBackendId: (backends: TerminalBackendInfo[], preferredId?: string | null) => string | undefined;
    createTerminal: (type: string, backendId?: string) => string;
};

export function useTerminalBootstrapEffects({
    isOpen,
    tabsLength,
    tabsRef,
    availableShells,
    availableBackends,
    isLoadingShells,
    isLoadingBackends,
    isLoadingRemoteConnections,
    isNewTerminalMenuOpen,
    isCreatingRef,
    hasAutoCreatedRef,
    fetchDiscoverySnapshot,
    fetchRemoteConnections,
    resolveDefaultBackendId,
    createTerminal,
}: UseTerminalBootstrapEffectsParams): void {
    const hasLoadedMenuConnectionsRef = useRef(false);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (isCreatingRef.current || hasAutoCreatedRef.current || tabsLength > 0) {
            return;
        }

        isCreatingRef.current = true;
        hasAutoCreatedRef.current = true;
        if (tabsRef.current.length === 0) {
            const shellId =
                availableShells[0]?.id ??
                tabsRef.current[0]?.type ??
                'powershell';
            createTerminal(shellId, resolveDefaultBackendId(availableBackends) ?? 'node-pty');
        }
        isCreatingRef.current = false;
    }, [
        isOpen,
        tabsLength,
        availableBackends,
        availableShells,
        createTerminal,
        resolveDefaultBackendId,
        tabsRef,
        isCreatingRef,
        hasAutoCreatedRef,
    ]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (
            availableShells.length === 0 &&
            availableBackends.length === 0 &&
            !isLoadingShells &&
            !isLoadingBackends
        ) {
            void fetchDiscoverySnapshot();
        }
    }, [
        availableBackends.length,
        availableShells.length,
        fetchDiscoverySnapshot,
        isLoadingBackends,
        isLoadingShells,
        isOpen,
    ]);

    useEffect(() => {
        if (!isOpen || !isNewTerminalMenuOpen) {
            hasLoadedMenuConnectionsRef.current = false;
            return;
        }

        if (hasLoadedMenuConnectionsRef.current) {
            return;
        }

        hasLoadedMenuConnectionsRef.current = true;

        if (
            (availableShells.length === 0 || availableBackends.length === 0) &&
            !isLoadingShells &&
            !isLoadingBackends
        ) {
            void fetchDiscoverySnapshot();
        }
        if (!isLoadingRemoteConnections) {
            void fetchRemoteConnections();
        }
    }, [
        isOpen,
        isNewTerminalMenuOpen,
        availableShells.length,
        availableBackends.length,
        isLoadingShells,
        isLoadingBackends,
        isLoadingRemoteConnections,
        fetchDiscoverySnapshot,
        fetchRemoteConnections,
    ]);

}

