import { useCallback, useEffect, useState } from 'react';

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

function toDisplayString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * Normalize SSH profiles from raw data
 * 
 * @param raw - Raw SSH profile data
 * @returns Normalized SSH profiles
 */
function normalizeSshProfiles(raw: unknown): RemoteSshProfile[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    const profiles: RemoteSshProfile[] = [];
    raw.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
            return;
        }
        const record = item as Record<string, unknown>;
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
    record: Record<string, unknown>,
    index: number
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
        'unknown';
    const shell =
        toDisplayString(record.shell) ||
        toDisplayString(record.Shell) ||
        '/bin/sh';

    if (!id || !name) {
        return null;
    }

    return {
        id: id || `docker-${index}`,
        name: name || `Container ${index + 1}`,
        image: image || 'unknown',
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
function normalizeDockerContainers(raw: unknown): RemoteDockerContainer[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    const containers: RemoteDockerContainer[] = [];
    raw.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
            return;
        }
        const container = parseDockerContainerRecord(item as Record<string, unknown>, index);
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

    /**
     * Fetch available shells
     * 
     * @returns Available shells
     */
    const fetchAvailableShells = useCallback(async () => {
        try {
            setIsLoadingShells(true);
            if (!(await window.electron.terminal.isAvailable())) {
                return [];
            }
            const shells = await window.electron.terminal.getShells();
            setAvailableShells(shells);
            return shells;
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to load shells', error as Error);
            return [];
        } finally {
            setIsLoadingShells(false);
        }
    }, []);

    /**
     * Fetch available backends
     * 
     * @returns Available backends
     */
    const fetchAvailableBackends = useCallback(async () => {
        try {
            setIsLoadingBackends(true);
            if (!(await window.electron.terminal.isAvailable())) {
                return [];
            }
            const backends = await window.electron.terminal.getBackends();
            setAvailableBackends(backends);
            return backends;
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to load terminal backends', error as Error);
            return [];
        } finally {
            setIsLoadingBackends(false);
        }
    }, []);

    /**
     * Fetch remote connections (SSH profiles and Docker containers)
     */
    const fetchRemoteConnections = useCallback(async () => {
        try {
            setIsLoadingRemoteConnections(true);

            const [profilesRaw, dockerRaw] = await Promise.all([
                window.electron.ssh.getProfiles().catch(() => []),
                window.electron.terminal.getDockerContainers().catch(() => []),
            ]);

            setRemoteSshProfiles(normalizeSshProfiles(profilesRaw));
            setRemoteDockerContainers(normalizeDockerContainers(dockerRaw as unknown));
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
        void loadPreferredBackendPreference();
    }, [loadPreferredBackendPreference]);

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

        void persistPreferredBackendId(resolved);
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
        fetchAvailableShells,
        fetchAvailableBackends,
        fetchRemoteConnections,
        resolveDefaultBackendId,
        persistPreferredBackendId,
    };
}
