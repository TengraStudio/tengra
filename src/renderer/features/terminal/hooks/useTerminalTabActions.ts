import { type MutableRefObject, useCallback, useMemo } from 'react';
import { z } from 'zod';

import { invokeTypedIpc } from '@/lib/ipc-client';
import { TerminalTab } from '@/types';

import type { RemoteConnectionTarget } from '../constants/terminal-panel-constants';
import { clearTerminalSessionFlags } from '../utils/session-registry';
import type { TerminalIpcContract } from '../utils/terminal-ipc';
import { buildDockerBootstrapCommand, buildSshBootstrapCommand } from '../utils/terminal-panel-helpers';

interface AvailableShell {
    id: string;
    name: string;
}

interface AvailableBackend {
    id: string;
    name: string;
    available: boolean;
}

interface UseTerminalTabActionsParams {
    tabs: TerminalTab[];
    tabsRef: MutableRefObject<TerminalTab[]>;
    activeTabIdRef: MutableRefObject<string | null>;
    workspacePath?: string;
    availableShells: AvailableShell[];
    availableBackends: AvailableBackend[];
    setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void;
    setActiveTabId: (id: string | null) => void;
    setIsNewTerminalMenuOpen: (open: boolean) => void;
    fetchAvailableShells: () => Promise<AvailableShell[]>;
    fetchAvailableBackends: () => Promise<AvailableBackend[]>;
    resolveDefaultBackendId: (backends: AvailableBackend[], preferredId?: string | null) => string | undefined;
    clearSemanticIssues: (tabId: string) => void;
    completeRecording: () => void;
    recordingCaptureRef: MutableRefObject<{ tabId: string } | null>;
    onToggle: () => void;
    workspaceIssuesTab: TerminalTab | null;
}

export function useTerminalTabActions({
    tabs,
    tabsRef,
    activeTabIdRef,
    workspacePath,
    availableShells,
    availableBackends,
    setTabs,
    setActiveTabId,
    setIsNewTerminalMenuOpen,
    fetchAvailableShells,
    fetchAvailableBackends,
    resolveDefaultBackendId,
    clearSemanticIssues,
    completeRecording,
    recordingCaptureRef,
    onToggle,
    workspaceIssuesTab,
}: UseTerminalTabActionsParams) {
    const shellNameById = useMemo(() => new Map(availableShells.map(s => [s.id, s.name])), [availableShells]);
    const backendNameById = useMemo(() => new Map(availableBackends.map(b => [b.id, b.name])), [availableBackends]);

    const createTerminal = useCallback(
        (
            type: string,
            backendId?: string,
            options?: {
                name?: string;
                metadata?: Record<string, unknown>;
                bootstrapCommand?: string;
            }
        ) => {
            const id = Math.random().toString(36).substring(2, 9);
            const effectiveBackendId =
                backendId ?? resolveDefaultBackendId(availableBackends) ?? 'node-pty';
            const shellName = shellNameById.get(type) ?? type;
            const backendName = backendNameById.get(effectiveBackendId);
            const similarCount =
                tabs.filter(
                    tab => tab.type === type && (tab.backendId ?? 'node-pty') === effectiveBackendId
                ).length + 1;
            const generatedName =
                effectiveBackendId === 'node-pty'
                    ? `${shellName} ${similarCount}`
                    : `${shellName} (${backendName ?? effectiveBackendId}) ${similarCount}`;
            const name = options?.name?.trim() || generatedName;

            setTabs(prev => [
                ...prev,
                {
                    id,
                    name,
                    type,
                    backendId: effectiveBackendId,
                    cwd: workspacePath ?? '',
                    isRunning: true,
                    status: 'idle',
                    history: [],
                    command: '',
                    metadata: options?.metadata,
                    bootstrapCommand: options?.bootstrapCommand,
                },
            ]);
            setActiveTabId(id);
            setIsNewTerminalMenuOpen(false);
            return id;
        },
        [
            availableBackends,
            backendNameById,
            workspacePath,
            setTabs,
            setActiveTabId,
            shellNameById,
            tabs,
            resolveDefaultBackendId,
            setIsNewTerminalMenuOpen,
        ]
    );

    const createDefaultTerminal = useCallback(async () => {
        let shells = availableShells;
        if (shells.length === 0) {
            shells = await fetchAvailableShells();
        }

        let backends = availableBackends;
        if (backends.length === 0) {
            backends = await fetchAvailableBackends();
        }

        const backendId = resolveDefaultBackendId(backends);
        const shellId = shells[0]?.id ?? tabs[0]?.type ?? 'powershell';
        createTerminal(shellId, backendId);
    }, [
        availableBackends,
        availableShells,
        createTerminal,
        fetchAvailableBackends,
        fetchAvailableShells,
        resolveDefaultBackendId,
        tabs,
    ]);

    const resolvePreferredShellId = useCallback(() => {
        const currentTabs = tabsRef.current;
        const active = currentTabs.find(tab => tab.id === activeTabIdRef.current);
        return active?.type ?? availableShells[0]?.id;
    }, [availableShells, tabsRef, activeTabIdRef]);

    const createRemoteTerminal = useCallback(
        (target: RemoteConnectionTarget) => {
            const shellId =
                resolvePreferredShellId() ??
                availableShells[0]?.id ??
                tabsRef.current[0]?.type ??
                'powershell';
            const backendId =
                availableBackends.find(backend => backend.id === 'node-pty' && backend.available)
                    ?.id ??
                resolveDefaultBackendId(availableBackends) ??
                'node-pty';

            if (target.kind === 'ssh') {
                const { profile } = target;
                const bootstrapCommand = buildSshBootstrapCommand(profile);
                createTerminal(shellId, backendId, {
                    name: `SSH ${profile.username}@${profile.host}`,
                    metadata: {
                        remote: {
                            kind: 'ssh',
                            id: profile.id,
                            host: profile.host,
                            port: profile.port,
                            username: profile.username,
                        },
                    },
                    bootstrapCommand,
                });
                return;
            }

            const { container } = target;
            const bootstrapCommand = buildDockerBootstrapCommand(container);
            createTerminal(shellId, backendId, {
                name: `Docker ${container.name}`,
                metadata: {
                    remote: {
                        kind: 'docker',
                        id: container.id,
                        status: container.status,
                    },
                },
                bootstrapCommand,
            });
        },
        [
            availableBackends,
            availableShells,
            createTerminal,
            resolveDefaultBackendId,
            resolvePreferredShellId,
            tabsRef,
        ]
    );

    const closeTab = useCallback(
        (id: string) => {
            const currentTabs = tabsRef.current;
            const currentActiveTabId = activeTabIdRef.current;
            const isExistingTab = currentTabs.some(tab => tab.id === id);

            if (!isExistingTab) {
                return;
            }

            const remainingTabs = currentTabs.filter(tab => tab.id !== id);
            const shouldMoveActiveTab =
                currentActiveTabId === id ||
                !currentActiveTabId ||
                !currentTabs.some(tab => tab.id === currentActiveTabId);
            const nextActiveTabId =
                remainingTabs.length === 0
                    ? null
                    : shouldMoveActiveTab
                        ? (remainingTabs[remainingTabs.length - 1]?.id ?? null)
                        : currentActiveTabId;

            clearTerminalSessionFlags(id);
            clearSemanticIssues(id);
            if (recordingCaptureRef.current?.tabId === id) {
                completeRecording();
            }
            void invokeTypedIpc<TerminalIpcContract, 'terminal:kill'>(
                'terminal:kill',
                [id],
                { responseSchema: z.boolean() }
            );

            setTabs(prev => prev.filter(tab => tab.id !== id));
            setActiveTabId(nextActiveTabId);
            activeTabIdRef.current = nextActiveTabId;

            if (remainingTabs.length === 0 && !workspaceIssuesTab) {
                setIsNewTerminalMenuOpen(false);
                onToggle();
            }
        },
        [clearSemanticIssues, completeRecording, onToggle, workspaceIssuesTab, setTabs, setActiveTabId, tabsRef, activeTabIdRef, recordingCaptureRef, setIsNewTerminalMenuOpen]
    );

    const reorderTabs = useCallback(
        (sourceId: string, targetId: string) => {
            if (sourceId === targetId) {
                return;
            }

            setTabs(prev => {
                const sourceIndex = prev.findIndex(tab => tab.id === sourceId);
                const targetIndex = prev.findIndex(tab => tab.id === targetId);

                if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
                    return prev;
                }

                const next = [...prev];
                const [moved] = next.splice(sourceIndex, 1);
                next.splice(targetIndex, 0, moved);
                return next;
            });
        },
        [setTabs]
    );

    return {
        createTerminal,
        createDefaultTerminal,
        resolvePreferredShellId,
        createRemoteTerminal,
        closeTab,
        reorderTabs,
    };
}
