
import { useCallback, useEffect, useRef, useState } from 'react';

import {
    parseSSHProfile,
    sshManagerErrorCodes,
} from '@/features/ssh/utils/ssh-manager-validation';
import { recordSSHManagerHealthEvent } from '@/store/ssh-manager-health.store';
import { SSHConnection } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

type SSHManagerUiState = 'loading' | 'ready' | 'empty' | 'failure';

const MAX_RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 140;

async function waitForRetry(): Promise<void> {
    await new Promise(resolve => {
        setTimeout(resolve, RETRY_DELAY_MS);
    });
}

async function withBoundedRetry<T>(
    operation: () => Promise<T>,
    attempts = MAX_RETRY_ATTEMPTS
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            const normalizedError =
                error instanceof Error ? error : new Error(String(error));
            lastError = normalizedError;
            if (attempt < attempts - 1) {
                await waitForRetry();
            }
        }
    }

    throw (lastError ?? new Error('Retry operation failed'));
}

export function useSSHConnections(isOpen: boolean) {
    const [connections, setConnections] = useState<SSHConnection[]>([]);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isLoadingConnections, setIsLoadingConnections] = useState(false);
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
    const [uiState, setUiState] = useState<SSHManagerUiState>('empty');
    const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);
    const selectedConnectionIdRef = useRef<string | null>(null);

    useEffect(() => {
        selectedConnectionIdRef.current = selectedConnectionId;
    }, [selectedConnectionId]);

    const updateConnectionStatus = useCallback((
        id: string,
        status: SSHConnection['status'],
        error?: string
    ) => {
        setConnections(prev =>
            prev.map(connection => {
                if (connection.id !== id) {
                    return connection;
                }

                const updated: SSHConnection = { ...connection, status };
                if (typeof error === 'string' && error.trim() !== '') {
                    updated.error = error;
                } else {
                    delete updated.error;
                }
                return updated;
            })
        );
    }, []);

    const loadConnections = useCallback(async () => {
        const startedAt = Date.now();
        setIsLoadingConnections(true);
        setUiState('loading');
        setLastErrorCode(null);

        try {
            const [profilesRaw, activeConnections] = await withBoundedRetry(
                () => Promise.all([
                    window.electron.ssh.getProfiles(),
                    window.electron.ssh.getConnections(),
                ]),
                MAX_RETRY_ATTEMPTS
            );

            const mergedConnections = new Map<string, SSHConnection>();
            let hadValidationFailure = false;

            for (const rawProfile of profilesRaw) {
                const parsed = parseSSHProfile(rawProfile);
                if (!parsed.success) {
                    hadValidationFailure = true;
                    continue;
                }
                mergedConnections.set(parsed.profile.id, {
                    ...parsed.profile,
                    status: 'disconnected',
                });
            }

            for (const active of activeConnections) {
                const parsed = parseSSHProfile({ ...active, status: 'connected' });
                if (!parsed.success) {
                    hadValidationFailure = true;
                    continue;
                }
                const existing = mergedConnections.get(parsed.profile.id);
                mergedConnections.set(parsed.profile.id, {
                    ...(existing ?? parsed.profile),
                    ...parsed.profile,
                    status: 'connected',
                });
            }

            const normalizedConnections = Array.from(mergedConnections.values());
            setConnections(normalizedConnections);
            setUiState(normalizedConnections.length === 0 ? 'empty' : 'ready');

            if (hadValidationFailure) {
                setLastErrorCode(sshManagerErrorCodes.validation);
                recordSSHManagerHealthEvent({
                    channel: 'ssh.loadConnections',
                    status: 'validation-failure',
                    durationMs: Date.now() - startedAt,
                    errorCode: sshManagerErrorCodes.validation,
                });
            } else {
                recordSSHManagerHealthEvent({
                    channel: 'ssh.loadConnections',
                    status: 'success',
                    durationMs: Date.now() - startedAt,
                });
            }

            for (const connection of normalizedConnections) {
                if (connection.status !== 'connected') {
                    continue;
                }

                const stillConnected = await window.electron.ssh.isConnected(connection.id);
                if (!stillConnected) {
                    updateConnectionStatus(connection.id, 'disconnected');
                }
            }
        } catch (error) {
            const normalizedError =
                error instanceof Error ? error : new Error(String(error));
            appLogger.error('SSH', 'Failed to load connections', normalizedError);
            setUiState('failure');
            setLastErrorCode(sshManagerErrorCodes.loadFailed);
            setConnections([]);
            recordSSHManagerHealthEvent({
                channel: 'ssh.loadConnections',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: sshManagerErrorCodes.loadFailed,
            });
        } finally {
            setIsLoadingConnections(false);
        }
    }, [updateConnectionStatus]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        void loadConnections().catch(error => {
            const normalizedError =
                error instanceof Error ? error : new Error(String(error));
            appLogger.error('SSH', 'SSH init error', normalizedError);
        });

        const onConnected = (id: string) => {
            updateConnectionStatus(id, 'connected');
            setIsConnecting(false);
            setSelectedConnectionId(id);
            void window.electron.ssh.shellStart(id).catch(error => {
                const normalizedError =
                    error instanceof Error ? error : new Error(String(error));
                appLogger.error('SSH', 'Failed to start shell after connect', normalizedError);
            });
        };

        const onDisconnected = (id: string) => {
            updateConnectionStatus(id, 'disconnected');
            if (selectedConnectionIdRef.current === id) {
                setSelectedConnectionId(null);
            }
        };

        window.electron.ssh.onConnected(onConnected);
        window.electron.ssh.onDisconnected(onDisconnected);

        return () => {
            window.electron.ssh.removeAllListeners();
        };
    }, [isOpen, loadConnections, updateConnectionStatus]);

    return {
        connections,
        setConnections,
        isConnecting,
        setIsConnecting,
        isLoadingConnections,
        selectedConnectionId,
        setSelectedConnectionId,
        uiState,
        lastErrorCode,
        loadConnections,
        updateConnectionStatus,
    };
}
