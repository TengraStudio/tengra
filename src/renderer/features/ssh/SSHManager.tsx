/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { NginxWizard } from '@renderer/features/ssh/NginxWizard';
import { PackageManager } from '@renderer/features/ssh/PackageManager';
import { SFTPBrowser } from '@renderer/features/ssh/SFTPBrowser';
import { SSHLogs } from '@renderer/features/ssh/SSHLogs';
import { StatsDashboard } from '@renderer/features/ssh/StatsDashboard';
import { SSHProfileTestResult } from '@shared/types/ssh';
import React, { useCallback, useEffect, useState } from 'react';

import { localizeIpcValidationMessage } from '@/features/ssh/utils/ipc-validation-message';
import {
    SSHConnectionFormInput,
    sshManagerErrorCodes,
    validateSSHConnectionForm
} from '@/features/ssh/utils/ssh-manager-validation';
import { Language, useTranslation } from '@/i18n';
import { recordSSHManagerHealthEvent } from '@/store/ssh-manager-health.store';
import { SSHConnection } from '@/types';
import { appLogger } from '@/utils/renderer-logger';
import { cn } from '@/lib/utils';

import { AddConnectionModal, SSHProfileTestUIResult } from './components/AddConnectionModal';
import { SSHConnectionList } from './components/SSHConnectionList';
import { SSHEnvSyncProfiles } from './components/SSHEnvSyncProfiles';
import { SSHIncidentRecoveryToolkit } from './components/SSHIncidentRecoveryToolkit';
import { SSHKeyManagement } from './components/SSHKeyManagement';
import { SSHTerminal } from './components/SSHTerminal';
import { SSHTunnels } from './components/SSHTunnels';
import { useSSHConnections } from './hooks/useSSHConnections';

/* Batch-02: Extracted Long Classes */
const C_SSHMANAGER_1 = "modal-content ssh-manager flex h-dialog-ssh w-modal-72 flex-col overflow-hidden rounded-2xl border border-border/30 bg-popover shadow-lg";
const C_SSHMANAGER_TAB_BUTTON = "border-none px-4 py-2 whitespace-nowrap transition-colors";


interface SSHManagerProps { isOpen: boolean; onClose: () => void; language: Language; }
type SSHTabId =
    | 'terminal'
    | 'dashboard'
    | 'files'
    | 'packages'
    | 'logs'
    | 'management'
    | 'keys'
    | 'tunnels'
    | 'sync'
    | 'recovery';

type SSHProfile = SSHConnectionFormInput;
interface SSHConnectResult {
    success: boolean;
    error?: string;
    id?: string;
}

const CONNECT_RETRY_ATTEMPTS = 2;
const CONNECT_RETRY_DELAY_MS = 150;

const SSHTabs: React.FC<{ activeTab: SSHTabId, onTabChange: (id: SSHTabId) => void, t: (k: string) => string }> = ({ activeTab, onTabChange, t }) => (
    <div className="ssh-tabs flex border-b border-border/50 bg-muted/20 overflow-x-auto">
        {[{ id: 'terminal', label: t('ssh.terminal') }, { id: 'dashboard', label: t('ssh.dashboard') }, { id: 'files', label: t('ssh.files') }, { id: 'packages', label: t('ssh.packages') }, { id: 'logs', label: t('ssh.logs') }, { id: 'management', label: t('ssh.management') }, { id: 'sync', label: t('ssh.syncProfiles') }, { id: 'recovery', label: t('ssh.recoveryToolkit') }, { id: 'keys', label: t('ssh.keyManagement') }, { id: 'tunnels', label: t('ssh.tunnels') }].map(tab => (
            <button
                key={tab.id}
                onClick={() => { onTabChange(tab.id as SSHTabId); }}
                className={cn(
                    C_SSHMANAGER_TAB_BUTTON,
                    activeTab === tab.id
                        ? 'bg-background text-foreground border-b-2 border-b-primary'
                        : 'bg-transparent text-muted-foreground'
                )}
            >
                {tab.label}
            </button>
        ))}
    </div>
);

async function waitForRetry(): Promise<void> {
    await new Promise(resolve => {
        setTimeout(resolve, CONNECT_RETRY_DELAY_MS);
    });
}

export function SSHManager({ isOpen, onClose, language }: SSHManagerProps) {
    const { t } = useTranslation(language);
    const {
        connections,
        isConnecting,
        setIsConnecting,
        isLoadingConnections,
        selectedConnectionId,
        setSelectedConnectionId,
        uiState,
        lastErrorCode,
        loadConnections,
        updateConnectionStatus,
    } = useSSHConnections(isOpen);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newConnection, setNewConnection] = useState<SSHProfile>({ name: '', host: '', port: 22, username: '', password: '', privateKey: '', jumpHost: '' });
    const [shouldSaveProfile, setShouldSaveProfile] = useState(false);
    const [terminalOutput, setTerminalOutput] = useState('');
    const [activeTab, setActiveTab] = useState<SSHTabId>('terminal');
    const [pendingDeleteProfileId, setPendingDeleteProfileId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const out = (d: string | Uint8Array) => {
            const s = typeof d === 'string' ? d : new TextDecoder().decode(d);
            setTerminalOutput(p => { return p + s; });
        };
        window.electron.ssh.onStdout(out);
        window.electron.ssh.onStderr(out);
        window.electron.ssh.onShellData(ed => {
            setTerminalOutput(p => { return p + ed.data; });
        });

        return () => {
            window.electron.ssh.removeAllListeners();
        };
    }, [isOpen]);

    const appendTerminalLine = useCallback((line: string) => {
        setTerminalOutput(previous => `${previous}${line}\n`);
    }, []);

    const runConnectWithRetry = useCallback(async (
        payload: SSHConnectionFormInput
    ): Promise<SSHConnectResult> => {
        let lastErrorMessage = t('ssh.unknownError');

        for (let attempt = 0; attempt < CONNECT_RETRY_ATTEMPTS; attempt += 1) {
            try {
                const result = await window.electron.ssh.connect({
                    ...payload,
                    authType: payload.privateKey ? 'key' : 'password',
                    password: payload.password,
                    privateKey: payload.privateKey,
                    jumpHost: payload.jumpHost,
                } as SSHConnection);

                if (result.success) {
                    return result;
                }
                const serverErrorMessage = result.error ?? t('ssh.unknownError');
                lastErrorMessage = localizeIpcValidationMessage(serverErrorMessage, t);
            } catch (error) {
                const unexpectedMessage = error instanceof Error ? error.message : t('ssh.unknownError');
                lastErrorMessage = localizeIpcValidationMessage(unexpectedMessage, t);
            }

            if (attempt < CONNECT_RETRY_ATTEMPTS - 1) {
                await waitForRetry();
            }
        }

        return {
            success: false,
            error: lastErrorMessage,
        };
    }, [t]);

    const handleAddConnection = useCallback(async () => {
        const validated = validateSSHConnectionForm(newConnection);
        if (!validated.success) {
            appendTerminalLine(t('ssh.connectionError', { error: t('ssh.unknownError') }));
            recordSSHManagerHealthEvent({
                channel: 'ssh.connect',
                status: 'validation-failure',
                errorCode: validated.errorCode,
            });
            return;
        }

        const startedAt = Date.now();
        setIsConnecting(true);
        appendTerminalLine(`${t('ssh.connecting')} ${validated.normalized.host}...`);

        try {
            const result = await runConnectWithRetry(validated.normalized);
            if (result.success) {
                appendTerminalLine(t('ssh.connected', { host: validated.normalized.host }));
                setShowAddModal(false);
                recordSSHManagerHealthEvent({
                    channel: 'ssh.connect',
                    status: 'success',
                    durationMs: Date.now() - startedAt,
                });

                if (shouldSaveProfile) {
                    if (!result.id) {
                        recordSSHManagerHealthEvent({
                            channel: 'ssh.connect',
                            status: 'failure',
                            durationMs: Date.now() - startedAt,
                            errorCode: sshManagerErrorCodes.saveProfileFailed,
                        });
                    } else if (!await window.electron.ssh.saveProfile({
                        id: result.id,
                        name: validated.normalized.name ?? validated.normalized.host,
                        host: validated.normalized.host,
                        port: validated.normalized.port,
                        username: validated.normalized.username,
                        password: validated.normalized.password,
                        privateKey: validated.normalized.privateKey,
                        jumpHost: validated.normalized.jumpHost,
                        authType: validated.normalized.privateKey ? 'key' : 'password',
                        status: 'disconnected',
                    })) {
                        recordSSHManagerHealthEvent({
                            channel: 'ssh.connect',
                            status: 'failure',
                            durationMs: Date.now() - startedAt,
                            errorCode: sshManagerErrorCodes.saveProfileFailed,
                        });
                    }
                }

                await loadConnections().catch((error: Error) => {
                    appLogger.error('SSHManager', 'Failed to load connections', error);
                });
                return;
            }

            appendTerminalLine(t('ssh.connectionError', { error: result.error ?? t('ssh.unknownError') }));
            recordSSHManagerHealthEvent({
                channel: 'ssh.connect',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: sshManagerErrorCodes.connectFailed,
            });
        } catch (error) {
            const normalizedError = error instanceof Error ? error : new Error(String(error));
            appLogger.error('SSHManager', 'Connection flow failed', normalizedError);
            appendTerminalLine(t('ssh.connectionError', { error: normalizedError.message }));
            recordSSHManagerHealthEvent({
                channel: 'ssh.connect',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: sshManagerErrorCodes.connectFailed,
            });
        } finally {
            setIsConnecting(false);
        }
    }, [appendTerminalLine, loadConnections, newConnection, runConnectWithRetry, setIsConnecting, shouldSaveProfile, t]);

    const handleAddConnectionWrapper = useCallback(() => {
        void handleAddConnection();
    }, [handleAddConnection]);

    const handleTestProfile = useCallback(async (): Promise<SSHProfileTestUIResult> => {
        const validated = validateSSHConnectionForm(newConnection);
        const startedAt = Date.now();

        if (!validated.success) {
            recordSSHManagerHealthEvent({
                channel: 'ssh.testProfile',
                status: 'validation-failure',
                durationMs: Date.now() - startedAt,
                errorCode: validated.errorCode,
            });
            return {
                success: false,
                message: t('ssh.profileTestFailed', { error: t('ssh.unknownError') }),
                errorCode: validated.errorCode,
                uiState: 'failure',
            };
        }

        for (let attempt = 0; attempt < CONNECT_RETRY_ATTEMPTS; attempt += 1) {
            try {
                const result = await window.electron.ssh.testProfile({
                    id: 'test-profile',
                    host: validated.normalized.host,
                    port: validated.normalized.port,
                    username: validated.normalized.username,
                    password: validated.normalized.password,
                    privateKey: validated.normalized.privateKey,
                    jumpHost: validated.normalized.jumpHost,
                    authType: validated.normalized.privateKey ? 'key' : 'password',
                    status: 'connecting',
                });

                const typedResult = result as SSHProfileTestResult;
                if (typedResult.success) {
                    recordSSHManagerHealthEvent({
                        channel: 'ssh.testProfile',
                        status: 'success',
                        durationMs: Date.now() - startedAt,
                    });
                    return {
                        success: true,
                        message: t('ssh.profileTestSuccess', { latency: typedResult.latencyMs }),
                        uiState: typedResult.uiState === 'failure' ? 'failure' : 'ready',
                        errorCode: typedResult.errorCode,
                    };
                }

                if (attempt === CONNECT_RETRY_ATTEMPTS - 1) {
                    const failedError = localizeIpcValidationMessage(
                        typedResult.error ?? t('ssh.unknownError'),
                        t
                    );
                    recordSSHManagerHealthEvent({
                        channel: 'ssh.testProfile',
                        status: 'failure',
                        durationMs: Date.now() - startedAt,
                        errorCode: typedResult.errorCode ?? sshManagerErrorCodes.testFailed,
                    });
                    return {
                        success: false,
                        message: t('ssh.profileTestFailed', { error: failedError }),
                        errorCode: typedResult.errorCode ?? sshManagerErrorCodes.testFailed,
                        uiState: typedResult.uiState === 'ready' ? 'ready' : 'failure',
                    };
                }
            } catch (error) {
                if (attempt === CONNECT_RETRY_ATTEMPTS - 1) {
                    const fallbackMessage = error instanceof Error ? error.message : t('ssh.unknownError');
                    const message = localizeIpcValidationMessage(fallbackMessage, t);
                    recordSSHManagerHealthEvent({
                        channel: 'ssh.testProfile',
                        status: 'failure',
                        durationMs: Date.now() - startedAt,
                        errorCode: sshManagerErrorCodes.testFailed,
                    });
                    return {
                        success: false,
                        message: t('ssh.profileTestFailed', { error: message }),
                        errorCode: sshManagerErrorCodes.testFailed,
                        uiState: 'failure',
                    };
                }
            }
            await waitForRetry();
        }

        recordSSHManagerHealthEvent({
            channel: 'ssh.testProfile',
            status: 'failure',
            durationMs: Date.now() - startedAt,
            errorCode: sshManagerErrorCodes.testFailed,
        });
        return {
            success: false,
            message: t('ssh.profileTestFailed', { error: t('ssh.unknownError') }),
            errorCode: sshManagerErrorCodes.testFailed,
            uiState: 'failure',
        };
    }, [newConnection, t]);

    const handleConnect = useCallback((c: SSHConnection) => {
        const startedAt = Date.now();
        setIsConnecting(true);
        void runConnectWithRetry({
            host: c.host,
            port: c.port,
            username: c.username,
            password: c.password,
            privateKey: c.privateKey,
            jumpHost: c.jumpHost,
            name: c.name,
        }).then(result => {
            if (result.success) {
                recordSSHManagerHealthEvent({
                    channel: 'ssh.connect',
                    status: 'success',
                    durationMs: Date.now() - startedAt,
                });
                void loadConnections();
                return;
            }

            updateConnectionStatus(c.id, 'error', result.error ?? t('ssh.unknownError'));
            recordSSHManagerHealthEvent({
                channel: 'ssh.connect',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: sshManagerErrorCodes.connectFailed,
            });
        }).catch(error => {
            const normalizedError = error instanceof Error ? error : new Error(String(error));
            appLogger.error('SSHManager', 'Connect failed unexpectedly', normalizedError);
            recordSSHManagerHealthEvent({
                channel: 'ssh.connect',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: sshManagerErrorCodes.connectFailed,
            });
        }).finally(() => {
            setIsConnecting(false);
        });
    }, [loadConnections, runConnectWithRetry, setIsConnecting, t, updateConnectionStatus]);

    const handleDisconnect = useCallback((id: string) => {
        void window.electron.ssh.disconnect(id).catch(error => {
            const normalizedError = error instanceof Error ? error : new Error(String(error));
            appLogger.error('SSHManager', 'Disconnect failed', normalizedError);
        });
        appendTerminalLine(t('ssh.disconnected'));
    }, [appendTerminalLine, t]);

    const handleDeleteRequest = useCallback((id: string) => {
        setPendingDeleteProfileId(id);
    }, []);

    const handleCancelDelete = useCallback(() => {
        setPendingDeleteProfileId(null);
    }, []);

    const handleConfirmDelete = useCallback(() => {
        if (!pendingDeleteProfileId) {
            return;
        }

        const startedAt = Date.now();
        const profileId = pendingDeleteProfileId;
        void window.electron.ssh.deleteProfile(profileId).then(success => {
            if (!success) {
                recordSSHManagerHealthEvent({
                    channel: 'ssh.deleteProfile',
                    status: 'failure',
                    durationMs: Date.now() - startedAt,
                    errorCode: sshManagerErrorCodes.deleteProfileFailed,
                });
                appendTerminalLine(t('ssh.connectionError', { error: t('ssh.unknownError') }));
                return;
            }

            recordSSHManagerHealthEvent({
                channel: 'ssh.deleteProfile',
                status: 'success',
                durationMs: Date.now() - startedAt,
            });
            setPendingDeleteProfileId(null);
            void loadConnections();
        }).catch(error => {
            const normalizedError = error instanceof Error ? error : new Error(String(error));
            appLogger.error('SSHManager', 'Delete profile failed', normalizedError);
            recordSSHManagerHealthEvent({
                channel: 'ssh.deleteProfile',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: sshManagerErrorCodes.deleteProfileFailed,
            });
            appendTerminalLine(t('ssh.connectionError', { error: normalizedError.message }));
        });
    }, [appendTerminalLine, loadConnections, pendingDeleteProfileId, t]);

    const handleTerminalExecute = useCallback((command: string) => {
        if (!selectedConnectionId) {
            appendTerminalLine(t('ssh.noServerConnected'));
            return;
        }
        void window.electron.ssh.shellWrite(selectedConnectionId, `${command}\n`).catch(error => {
            const normalizedError = error instanceof Error ? error : new Error(String(error));
            appLogger.error('SSHManager', 'Shell write failed', normalizedError);
            appendTerminalLine(t('ssh.connectionError', { error: normalizedError.message }));
        });
    }, [appendTerminalLine, selectedConnectionId, t]);

    const renderMainContent = () => {
        if (isLoadingConnections) {
            return (
                <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
                    {t('ssh.loading')}
                </div>
            );
        }

        if (uiState === 'failure') {
            return (
                <div className="flex h-full items-center justify-center bg-background text-destructive">
                    {t('ssh.connectionError', { error: lastErrorCode ?? t('ssh.unknownError') })}
                </div>
            );
        }

        if (uiState === 'empty' && activeTab !== 'keys' && activeTab !== 'terminal') {
            return (
                <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
                    {t('ssh.selectConnection')}
                </div>
            );
        }

        if (activeTab === 'terminal') {
            return (
                <SSHTerminal
                    terminalOutput={terminalOutput}
                    t={t}
                    onExecute={handleTerminalExecute}
                    selectedConnectionId={selectedConnectionId}
                />
            );
        }

        if (activeTab === 'keys') {
            return <SSHKeyManagement t={t} />;
        }

        if (!selectedConnectionId) {
            return (
                <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
                    {t('ssh.selectConnection')}
                </div>
            );
        }

        if (activeTab === 'tunnels') {
            return <SSHTunnels connectionId={selectedConnectionId} t={t} />;
        }
        if (activeTab === 'dashboard') {
            return <StatsDashboard connectionId={selectedConnectionId} />;
        }
        if (activeTab === 'packages') {
            return <PackageManager connectionId={selectedConnectionId} />;
        }
        if (activeTab === 'logs') {
            return <SSHLogs connectionId={selectedConnectionId} active />;
        }
        if (activeTab === 'management') {
            return <NginxWizard connectionId={selectedConnectionId} language={language} />;
        }
        if (activeTab === 'sync') {
            return <SSHEnvSyncProfiles connectionId={selectedConnectionId} t={t} />;
        }
        if (activeTab === 'recovery') {
            return <SSHIncidentRecoveryToolkit connectionId={selectedConnectionId} t={t} />;
        }

        return <SFTPBrowser connectionId={selectedConnectionId} />;
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal-overlay">
            <div className={C_SSHMANAGER_1}>
                <div className="modal-header flex items-center justify-between border-b border-border/20 px-4 py-4 sm:px-5">
                    <h2 className="text-lg font-semibold">{t('ssh.title')}</h2>
                    <button className="close-btn rounded-lg px-2 py-1 text-muted-foreground hover:bg-muted/30 hover:text-foreground" onClick={onClose}>×</button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                    <div className="relative border-b border-border/20 lg:w-72 lg:border-b-0 lg:border-r lg:border-border/20">
                        <SSHConnectionList
                            connections={connections}
                            selectedId={selectedConnectionId}
                            onSelect={setSelectedConnectionId}
                            onConnect={handleConnect}
                            onDisconnect={handleDisconnect}
                            onDeleteRequest={handleDeleteRequest}
                            onAdd={() => { setShowAddModal(true); }}
                            t={t}
                        />
                        {pendingDeleteProfileId ? (
                            <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-destructive/30 bg-background/95 p-3 typo-caption shadow-lg">
                                <div className="mb-2 text-muted-foreground">{t('ssh.confirmDelete')}</div>
                                <div className="flex gap-2">
                                    <button className="secondary-btn flex-1" onClick={handleCancelDelete}>
                                        {t('common.cancel')}
                                    </button>
                                    <button className="primary-btn flex-1" onClick={handleConfirmDelete}>
                                        {t('common.delete')}
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col">
                        <SSHTabs activeTab={activeTab} onTabChange={setActiveTab} t={t} />
                        <div className="flex-1 overflow-hidden">{renderMainContent()}</div>
                    </div>
                </div>
                <AddConnectionModal
                    isOpen={showAddModal}
                    onClose={() => { setShowAddModal(false); }}
                    t={t}
                    newConnection={newConnection}
                    setNewConnection={setNewConnection}
                    shouldSaveProfile={shouldSaveProfile}
                    setShouldSaveProfile={setShouldSaveProfile}
                    isConnecting={isConnecting}
                    onConnect={handleAddConnectionWrapper}
                    onTestProfile={handleTestProfile}
                />
            </div>
        </div>
    );
}
