/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { appLogger } from '@/utils/renderer-logger';

/**
 * Terminal backend information
 */
export interface TerminalBackendInfo {
    /** Backend identifier */
    id: string;
    /** Backend display name */
    name: string;
    /** Whether backend is available */
    available: boolean;
}

/**
 * Remote SSH profile
 */
export interface RemoteSshProfile {
    /** Profile identifier */
    id: string;
    /** Profile display name */
    name: string;
    /** SSH host */
    host: string;
    /** SSH port */
    port: number;
    /** SSH username */
    username: string;
    /** Optional SSH private key path */
    privateKey?: string;
    /** Optional jump host */
    jumpHost?: string;
}

/**
 * Remote Docker container
 */
export interface RemoteDockerContainer {
    /** Container ID */
    id: string;
    /** Container name */
    name: string;
    /** Container image */
    image: string;
    /** Container status */
    status: string;
    /** Container running state */
    running: boolean;
    /** Preferred shell for container exec */
    shell: string;
}

/**
 * Shell information
 */
export interface ShellInfo {
    /** Shell identifier */
    id: string;
    /** Shell display name */
    name: string;
    /** Shell executable path */
    path: string;
}

interface TerminalDiscoverySnapshot {
    terminalAvailable: boolean;
    shells: ShellInfo[];
    backends: TerminalBackendInfo[];
    refreshedAt: number;
}

function toDisplayString(value: RendererDataValue): string {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * Normalize SSH profiles from raw data
 * 
 * @param raw - Raw SSH profile data
 * @returns Normalized SSH profiles
 */
function normalizeSshProfiles(raw: RendererDataValue): RemoteSshProfile[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    const profiles: RemoteSshProfile[] = [];
    raw.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
            return;
        }
        const record = item as Record<string, RendererDataValue>;
        const host = toDisplayString(record.host);
        const username = toDisplayString(record.username);
        if (!host || !username) {
            return;
        }
        const port = Number(record.port) > 0 ? Number(record.port) : 22;
        const profileId = toDisplayString(record.id) || `${username}@${host}:${port}:${index}`;
        const fallbackName = `${username}@${host}`;
        profiles.push({
            id: profileId,
            name: toDisplayString(record.name) || fallbackName,
            host,
            port,
            username,
            privateKey: toDisplayString(record.privateKey) || undefined,
            jumpHost: toDisplayString(record.jumpHost) || undefined,
        });
    });
    return profiles;
}

/**
 * Parse Docker container record
 * 
 * @param record - Container record
 * @param index - Container index
 * @returns Normalized container or null
 */
function parseDockerContainerRecord(
    record: Record<string, RendererDataValue>
): RemoteDockerContainer | null {
    const id =
        toDisplayString(record.id) ||
        toDisplayString(record.ID) ||
        toDisplayString(record.Id) ||
        '';
    const name =
        toDisplayString(record.name) ||
        toDisplayString(record.Name) ||
        toDisplayString(record.Names);
    const image =
        toDisplayString(record.image) ||
        toDisplayString(record.Image);
    const status =
        toDisplayString(record.status) ||
        toDisplayString(record.Status) ||
        toDisplayString(record.State) ||
        '';
    const shell =
        toDisplayString(record.shell) ||
        toDisplayString(record.Shell) ||
        '/bin/sh';

    if (!id || !name) {
        return null;
    }

    return {
        id,
        name,
        image: image || '',
        status,
        running: status.toLowerCase().includes('up') || status.toLowerCase().includes('running'),
        shell,
    };
}

/**
 * Normalize Docker containers from raw data
 * 
 * @param raw - Raw container data
 * @returns Normalized Docker containers
 */
function normalizeDockerContainers(raw: RendererDataValue): RemoteDockerContainer[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    const containers: RemoteDockerContainer[] = [];
    raw.forEach(item => {
        if (!item || typeof item !== 'object') {
            return;
        }
        const container = parseDockerContainerRecord(item as Record<string, RendererDataValue>);
        if (container) {
            containers.push(container);
        }
    });
    return containers;
}

/**
 * Props for useTerminalBackendsAndRemote hook
 */
interface UseTerminalBackendsAndRemoteProps {
    /** Storage key for preferred backend */
    preferredBackendStorageKey: string;
}

/**
 * Hook for managing terminal backends and remote connections
 * 
 * @param props - Hook configuration
 * @returns Backends and remote connections state
 */
export function useTerminalBackendsAndRemote({
    preferredBackendStorageKey,
}: UseTerminalBackendsAndRemoteProps) {
    const [isLoadingShells, setIsLoadingShells] = useState(false);
    const [isLoadingBackends, setIsLoadingBackends] = useState(false);
    const [availableShells, setAvailableShells] = useState<ShellInfo[]>([]);
    const [availableBackends, setAvailableBackends] = useState<TerminalBackendInfo[]>([]);
    const [isLoadingRemoteConnections, setIsLoadingRemoteConnections] = useState(false);
    const [remoteSshProfiles, setRemoteSshProfiles] = useState<RemoteSshProfile[]>([]);
    const [remoteDockerContainers, setRemoteDockerContainers] = useState<RemoteDockerContainer[]>(
        []
    );
    const [preferredBackendId, setPreferredBackendId] = useState<string | null>(null);
    const discoveryRequestRef = useRef<Promise<TerminalDiscoverySnapshot> | null>(null);

    /**
     * Load preferred backend from settings and localStorage
     * 
     * @returns Preferred backend ID or null
     */
    const loadPreferredBackendPreference = useCallback(async () => {
        try {
            const settings = await window.electron.getSettings();
            const configuredBackend = settings?.general?.defaultTerminalBackend?.trim();
            if (configuredBackend) {
                setPreferredBackendId(configuredBackend);
                try {
                    window.localStorage.setItem(
                        preferredBackendStorageKey,
                        configuredBackend
                    );
                } catch {
                    // Ignore localStorage failures in restricted environments.
                }
                return configuredBackend;
            }
        } catch {
            // Ignore settings read failures and fallback to localStorage.
        }

        try {
            const stored = window.localStorage.getItem(preferredBackendStorageKey);
            if (stored?.trim()) {
                const fallbackBackend = stored.trim();
                setPreferredBackendId(fallbackBackend);
                return fallbackBackend;
            }
        } catch {
            // Ignore localStorage failures in restricted environments.
        }

        return null;
    }, [preferredBackendStorageKey]);

    const fetchDiscoverySnapshot = useCallback(async (refresh = false) => {
        if (!refresh && discoveryRequestRef.current) {
            return discoveryRequestRef.current;
        }

        setIsLoadingShells(true);
        setIsLoadingBackends(true);

        const request = window.electron.terminal.getDiscoverySnapshot(refresh ? { refresh: true } : undefined)
            .then(snapshot => {
                setAvailableShells(snapshot.shells);
                setAvailableBackends(snapshot.backends);
                return snapshot;
            })
            .catch(error => {
                appLogger.error('TerminalPanel', 'Failed to load terminal discovery snapshot', error as Error);
                setAvailableShells([]);
                setAvailableBackends([]);
                return {
                    terminalAvailable: false,
                    shells: [],
                    backends: [],
                    refreshedAt: Date.now(),
                };
            })
            .finally(() => {
                setIsLoadingShells(false);
                setIsLoadingBackends(false);
                if (discoveryRequestRef.current === request) {
                    discoveryRequestRef.current = null;
                }
            });

        discoveryRequestRef.current = request;
        return request;
    }, []);

    /**
     * Fetch available shells
     * 
     * @returns Available shells
     */
    const fetchAvailableShells = useCallback(async () => {
        try {
            const snapshot = await fetchDiscoverySnapshot();
            return snapshot.shells;
        } catch {
            return [];
        }
    }, [fetchDiscoverySnapshot]);

    /**
     * Fetch available backends
     * 
     * @returns Available backends
     */
    const fetchAvailableBackends = useCallback(async () => {
        try {
            const snapshot = await fetchDiscoverySnapshot();
            return snapshot.backends;
        } catch {
            return [];
        }
    }, [fetchDiscoverySnapshot]);

    /**
     * Fetch remote connections (SSH profiles and Docker containers)
     */
    const fetchRemoteConnections = useCallback(async () => {
        try {
            setIsLoadingRemoteConnections(true);

            const [profilesRaw, dockerResult] = await Promise.all([
                window.electron.ssh.getProfiles().catch(() => []),
                window.electron.terminal.getDockerContainers().catch(() => ({ success: false })),
            ]);

            setRemoteSshProfiles(normalizeSshProfiles(profilesRaw));

            const dockerContainers = ('containers' in dockerResult && dockerResult.containers) ? dockerResult.containers : [];
            setRemoteDockerContainers(normalizeDockerContainers(dockerContainers));
        } catch (error) {
            appLogger.error(
                'TerminalPanel',
                'Failed to load remote terminal connections',
                error as Error
            );
            setRemoteSshProfiles([]);
            setRemoteDockerContainers([]);
        } finally {
            setIsLoadingRemoteConnections(false);
        }
    }, []);

    /**
     * Resolve default backend ID from available backends
     * 
     * @param backends - Available backends
     * @param preferredId - Optional preferred backend ID
     * @returns Default backend ID
     */
    const resolveDefaultBackendId = useCallback(
        (backends: TerminalBackendInfo[], preferredId?: string | null) => {
            const preferred = (preferredId ?? preferredBackendId)?.trim();
            if (preferred) {
                const preferredBackend = backends.find(
                    backend => backend.id === preferred && backend.available
                );
                if (preferredBackend) {
                    return preferredBackend.id;
                }
            }

            return (
                backends.find(backend => backend.id === 'node-pty' && backend.available)?.id ??
                backends.find(backend => backend.available)?.id
            );
        },
        [preferredBackendId]
    );

    /**
     * Persist preferred backend ID to settings and localStorage
     * 
     * @param backendId - Backend ID to persist
     */
    const persistPreferredBackendId = useCallback(async (backendId: string) => {
        setPreferredBackendId(backendId);
        try {
            window.localStorage.setItem(preferredBackendStorageKey, backendId);
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
        try {
            const settings = await window.electron.getSettings();
            const currentBackend = settings?.general?.defaultTerminalBackend;
            if (!settings?.general || currentBackend === backendId) {
                return;
            }

            await window.electron.saveSettings({
                ...settings,
                general: {
                    ...settings.general,
                    defaultTerminalBackend: backendId,
                },
            });
        } catch (error) {
            appLogger.error(
                'TerminalPanel',
                'Failed to persist preferred terminal backend',
                error as Error
            );
        }
    }, [preferredBackendStorageKey]);

    /**
     * Load preferred backend on mount
     */
    useEffect(() => {
        queueMicrotask(() => {
            void loadPreferredBackendPreference();
            void fetchDiscoverySnapshot();
        });
    }, [loadPreferredBackendPreference, fetchDiscoverySnapshot]);

    /**
     * Auto-persist backend when backends become available
     */
    useEffect(() => {
        if (availableBackends.length === 0) {
            return;
        }

        const resolved = resolveDefaultBackendId(availableBackends);
        if (!resolved || resolved === preferredBackendId) {
            return;
        }

        queueMicrotask(() => {
            void persistPreferredBackendId(resolved);
        });
    }, [availableBackends, preferredBackendId, resolveDefaultBackendId, persistPreferredBackendId]);

    const hasRemoteConnections = remoteSshProfiles.length > 0 || remoteDockerContainers.length > 0;
    const resolvedDefaultBackendId = resolveDefaultBackendId(availableBackends);

    return {
        isLoadingShells,
        isLoadingBackends,
        availableShells,
        availableBackends,
        isLoadingRemoteConnections,
        remoteSshProfiles,
        remoteDockerContainers,
        preferredBackendId,
        hasRemoteConnections,
        resolvedDefaultBackendId,
        fetchDiscoverySnapshot,
        fetchAvailableShells,
        fetchAvailableBackends,
        fetchRemoteConnections,
        resolveDefaultBackendId,
        persistPreferredBackendId,
    };
}

