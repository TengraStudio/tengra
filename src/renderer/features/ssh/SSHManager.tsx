import { NginxWizard } from '@renderer/features/ssh/NginxWizard';
import { PackageManager } from '@renderer/features/ssh/PackageManager';
import { SFTPBrowser } from '@renderer/features/ssh/SFTPBrowser';
import { SSHLogs } from '@renderer/features/ssh/SSHLogs';
import { StatsDashboard } from '@renderer/features/ssh/StatsDashboard';
import React, { useCallback, useEffect, useState } from 'react';

import { appLogger } from '@main/logging/logger';
import { Language, useTranslation } from '@/i18n';
import { SSHConnection } from '@/types';

import { AddConnectionModal } from './components/AddConnectionModal';
import { SSHConnectionList } from './components/SSHConnectionList';
import { SSHTerminal } from './components/SSHTerminal';
import { useSSHConnections } from './hooks/useSSHConnections';

interface SSHManagerProps { isOpen: boolean; onClose: () => void; language: Language; }
interface SSHProfile { name?: string; host: string; port: number; username: string; password?: string; privateKey?: string; }

const SSHTabs: React.FC<{ activeTab: string, onTabChange: (id: string) => void, t: (k: string) => string }> = ({ activeTab, onTabChange, t }) => (
    <div className="ssh-tabs flex border-b border-border/50 bg-muted/20 overflow-x-auto">
        {[{ id: 'terminal', label: t('ssh.terminal') }, { id: 'dashboard', label: t('ssh.dashboard') }, { id: 'files', label: t('ssh.files') }, { id: 'packages', label: t('ssh.packages') }, { id: 'logs', label: t('ssh.logs') }, { id: 'management', label: t('ssh.management') }].map(tab => (
            <button key={tab.id} onClick={() => { onTabChange(tab.id); }} style={{ padding: '8px 16px', backgroundColor: activeTab === tab.id ? 'var(--background)' : 'transparent', border: 'none', color: activeTab === tab.id ? 'var(--foreground)' : 'var(--muted-foreground)', borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : 'none', whiteSpace: 'nowrap' }}>{tab.label}</button>
        ))}
    </div>
);

export function SSHManager({ isOpen, onClose, language }: SSHManagerProps) {
    const { t } = useTranslation(language);
    const { connections, isConnecting, setIsConnecting, selectedConnectionId, setSelectedConnectionId, loadConnections } = useSSHConnections(isOpen);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newConnection, setNewConnection] = useState<SSHProfile>({ name: '', host: '', port: 22, username: '', password: '', privateKey: '' });
    const [shouldSaveProfile, setShouldSaveProfile] = useState(false);
    const [terminalOutput, setTerminalOutput] = useState('');
    const [activeTab, setActiveTab] = useState('terminal');

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
    }, [isOpen]);

    const handleAddConnection = useCallback(async () => {
        setIsConnecting(true);
        setTerminalOutput(`${t('ssh.connecting')} ${newConnection.host}...\n`);
        const res = await window.electron.ssh.connect({ ...newConnection, privateKey: newConnection.privateKey ?? undefined });
        setIsConnecting(false);
        if (res.success) {
            setTerminalOutput(p => { return p + `${t('ssh.connected', { host: newConnection.host })}\n`; });
            setShowAddModal(false);
            if (shouldSaveProfile) {
                await window.electron.ssh.saveProfile({ ...newConnection, id: res.id ?? '', name: newConnection.name ?? newConnection.host }).catch((err: Error) => {
                    appLogger.error('SSHManager', 'Failed to save profile', err);
                });
            }
            await loadConnections().catch((err: Error) => {
                appLogger.error('SSHManager', 'Failed to load connections', err);
            });
        } else {
            setTerminalOutput(p => { return p + `${t('ssh.connectionError', { error: res.error ?? 'Unknown' })}\n`; });
        }
    }, [newConnection, shouldSaveProfile, t, setIsConnecting, loadConnections]);

    const handleAddConnectionWrapper = useCallback(() => {
        void handleAddConnection();
    }, [handleAddConnection]);

    const handleConnect = useCallback((c: SSHConnection) => {
        void window.electron.ssh.connect(c).then(() => {
            void loadConnections();
        });
    }, [loadConnections]);

    const handleDisconnect = useCallback((id: string) => {
        void window.electron.ssh.disconnect(id);
        setTerminalOutput(p => { return p + `${t('ssh.disconnected')}\n`; });
    }, [t]);

    const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        // eslint-disable-next-line no-alert
        if (window.confirm(t('ssh.confirmDelete'))) {
            void window.electron.ssh.deleteProfile(id).then(() => {
                void loadConnections();
            });
        }
    }, [loadConnections, t]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content ssh-manager bg-popover border border-border shadow-2xl rounded-2xl overflow-hidden" style={{ width: '800px', height: '600px', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header"><h2>{t('ssh.title')}</h2><button className="close-btn" onClick={onClose}>×</button></div>
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    <SSHConnectionList connections={connections} selectedId={selectedConnectionId} onSelect={setSelectedConnectionId} onConnect={handleConnect} onDisconnect={handleDisconnect} onDelete={handleDelete} onAdd={() => { setShowAddModal(true); }} t={t} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <SSHTabs activeTab={activeTab} onTabChange={setActiveTab} t={t} />
                        <div className="flex-1 overflow-hidden">
                            {activeTab === 'terminal' ? (
                                <SSHTerminal terminalOutput={terminalOutput} t={t} onExecute={cmd => { if (selectedConnectionId) { void window.electron.ssh.shellWrite(selectedConnectionId, cmd + '\n'); } else { setTerminalOutput(p => { return p + `${t('ssh.noServerConnected')}\n`; }); } }} selectedConnectionId={selectedConnectionId} />
                            ) : !selectedConnectionId ? (
                                <div className="flex-1 h-full flex items-center justify-center bg-background text-muted-foreground">{t('ssh.selectConnection')}</div>
                            ) : activeTab === 'dashboard' ? (
                                <StatsDashboard connectionId={selectedConnectionId} />
                            ) : activeTab === 'packages' ? (
                                <PackageManager connectionId={selectedConnectionId} />
                            ) : activeTab === 'logs' ? (
                                <SSHLogs connectionId={selectedConnectionId} active />
                            ) : activeTab === 'management' ? (
                                <NginxWizard connectionId={selectedConnectionId} language={language} />
                            ) : (
                                <SFTPBrowser connectionId={selectedConnectionId} />
                            )}
                        </div>
                    </div>
                </div>
                <AddConnectionModal isOpen={showAddModal} onClose={() => { setShowAddModal(false); }} t={t} newConnection={newConnection} setNewConnection={setNewConnection} shouldSaveProfile={shouldSaveProfile} setShouldSaveProfile={setShouldSaveProfile} isConnecting={isConnecting} onConnect={handleAddConnectionWrapper} />
            </div>
        </div>
    );
}
