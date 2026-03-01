import { type MutableRefObject, useEffect } from 'react';

import type { TerminalTab } from '@/types';

import type { ShellInfo,TerminalBackendInfo } from './useTerminalBackendsAndRemote';

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
    fetchAvailableShells: () => Promise<ShellInfo[]>;
    fetchAvailableBackends: () => Promise<TerminalBackendInfo[]>;
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
    fetchAvailableShells,
    fetchAvailableBackends,
    fetchRemoteConnections,
    resolveDefaultBackendId,
    createTerminal,
}: UseTerminalBootstrapEffectsParams): void {
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        let cancelled = false;
        const loadShellsAndMaybeCreate = async () => {
            const shells =
                availableShells.length > 0 ? availableShells : await fetchAvailableShells();
            const backends =
                availableBackends.length > 0 ? availableBackends : await fetchAvailableBackends();
            if (cancelled || isCreatingRef.current || hasAutoCreatedRef.current) {
                return;
            }
            if (tabsLength === 0) {
                isCreatingRef.current = true;
                hasAutoCreatedRef.current = true;
                if (!cancelled && tabsRef.current.length === 0) {
                    const shellId =
                        shells[0]?.id ??
                        availableShells[0]?.id ??
                        tabsRef.current[0]?.type ??
                        'powershell';
                    createTerminal(shellId, resolveDefaultBackendId(backends));
                }
                isCreatingRef.current = false;
            }
        };

        void loadShellsAndMaybeCreate();
        return () => {
            cancelled = true;
        };
    }, [
        isOpen,
        tabsLength,
        availableBackends,
        availableShells,
        fetchAvailableBackends,
        fetchAvailableShells,
        createTerminal,
        resolveDefaultBackendId,
        tabsRef,
        isCreatingRef,
        hasAutoCreatedRef,
    ]);

    useEffect(() => {
        if (isOpen && isNewTerminalMenuOpen) {
            if (availableShells.length === 0 && !isLoadingShells) {
                void fetchAvailableShells();
            }
            if (availableBackends.length === 0 && !isLoadingBackends) {
                void fetchAvailableBackends();
            }
            if (!isLoadingRemoteConnections) {
                void fetchRemoteConnections();
            }
        }
    }, [
        isOpen,
        isNewTerminalMenuOpen,
        availableShells.length,
        availableBackends.length,
        isLoadingShells,
        isLoadingBackends,
        isLoadingRemoteConnections,
        fetchAvailableShells,
        fetchAvailableBackends,
        fetchRemoteConnections,
    ]);
}
