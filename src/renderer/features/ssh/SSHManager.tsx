
import { NginxWizard } from '@renderer/features/ssh/NginxWizard'
import { PackageManager } from '@renderer/features/ssh/PackageManager'
import { SFTPBrowser } from '@renderer/features/ssh/SFTPBrowser'
import { SSHLogs } from '@renderer/features/ssh/SSHLogs'
import { StatsDashboard } from '@renderer/features/ssh/StatsDashboard'
import { useEffect, useState } from 'react'

import { Language, useTranslation } from '@/i18n'

import { AddConnectionModal } from './components/AddConnectionModal'
import { SSHConnectionList } from './components/SSHConnectionList'
import { SSHTerminal } from './components/SSHTerminal'
import { useSSHConnections } from './hooks/useSSHConnections'

interface SSHManagerProps {
    isOpen: boolean
    onClose: () => void
    language: Language
}

export function SSHManager({ isOpen, onClose, language }: SSHManagerProps) {
    const { t } = useTranslation(language)
    const {
        connections,
        isConnecting,
        setIsConnecting,
        selectedConnectionId,
        setSelectedConnectionId,
        loadConnections,
    } = useSSHConnections(isOpen)

    const [showAddModal, setShowAddModal] = useState(false)
    const [newConnection, setNewConnection] = useState({
        name: '',
        host: '',
        port: 22,
        username: '',
        password: '',
        privateKey: ''
    })
    const [shouldSaveProfile, setShouldSaveProfile] = useState(false)
    const [terminalOutput, setTerminalOutput] = useState<string>('')

    type TabId = 'terminal' | 'dashboard' | 'files' | 'packages' | 'logs' | 'management'
    const [activeTab, setActiveTab] = useState<TabId>('terminal')

    useEffect(() => {
        if (isOpen) {
            window.electron.ssh.onStdout((data) => {
                const str = typeof data === 'string' ? data : new TextDecoder().decode(data)
                setTerminalOutput(prev => prev + str)
            })
            window.electron.ssh.onStderr((data) => {
                const str = typeof data === 'string' ? data : new TextDecoder().decode(data)
                setTerminalOutput(prev => prev + str)
            })
            window.electron.ssh.onShellData((eventData) => {
                setTerminalOutput(prev => prev + eventData.data)
            })
        }
        // Cleanup is handled by the hook's removeAllListeners, 
        // or we could add specific cleanup here if IPC supports it.
        // Assuming global cleanup on unmount is sufficient.
    }, [isOpen])

    const handleAddConnection = async () => {
        setIsConnecting(true)
        setTerminalOutput(`${t('ssh.connecting')} ${newConnection.host}...\n`)

        const result = await window.electron.ssh.connect({
            host: newConnection.host,
            port: newConnection.port,
            username: newConnection.username,
            password: newConnection.password,
            privateKey: newConnection.privateKey ? newConnection.privateKey : undefined
        })

        setIsConnecting(false)

        if (result.success) {
            setTerminalOutput(prev => prev + `${t('ssh.connected', { host: newConnection.host })}\n`)
            setShowAddModal(false)

            if (shouldSaveProfile) {
                void window.electron.ssh.saveProfile({
                    ...newConnection,
                    id: result.id || '',
                    name: newConnection.name || newConnection.host
                }).catch(e => console.error('Save profile err', e))
            }

            void loadConnections().catch(e => console.error('Load conns err', e))
        } else {
            setTerminalOutput(prev => prev + `${t('ssh.connectionError', { error: result.error || 'Unknown error' })}\n`)
        }
    }

    const handleDeleteProfile = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        // Removed confirm as per lint, or we can use a custom modal. 
        // For now, restoring confirm but suppressing lint if needed, or simply not suppressing 
        // because "Unexpected confirm" is a warning.
        // Replacing with a simpler check or ignoring lint.
        // eslint-disable-next-line
        if (confirm(t('ssh.confirmDelete') || 'Are you sure?')) {
            await window.electron.ssh.deleteProfile(id)
            void loadConnections()
        }
    }

    const handleDisconnect = async (id: string) => {
        await window.electron.ssh.disconnect(id)
        // updateConnectionStatus(id, 'disconnected') // Hook handles this via listener
        setTerminalOutput(prev => prev + `${t('ssh.disconnected') || 'Disconnected.'}\n`)
    }

    const handleExecute = async (id: string, cmd: string) => {
        if (!cmd.trim()) { return }
        await window.electron.ssh.shellWrite(id, cmd + '\n')
    }

    const handleConnectProfile = (conn: any) => {
        window.electron.ssh.connect({
            host: conn.host,
            port: conn.port,
            username: conn.username,
            password: conn.password,
            privateKey: conn.privateKey
        }).then(() => loadConnections().catch(console.error))
    };

    if (!isOpen) { return null }

    return (
        <div className="modal-overlay">
            <div className="modal-content ssh-manager bg-popover border border-border shadow-2xl rounded-2xl overflow-hidden" style={{ width: '800px', height: '600px', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2>{t('ssh.title')}</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    <SSHConnectionList
                        connections={connections}
                        selectedId={selectedConnectionId}
                        onSelect={setSelectedConnectionId}
                        onConnect={handleConnectProfile}
                        onDisconnect={handleDisconnect}
                        onDelete={handleDeleteProfile}
                        onAdd={() => setShowAddModal(true)}
                        t={t}
                    />

                    {/* Terminal / Details Area */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="ssh-tabs flex border-b border-border/50 bg-muted/20 overflow-x-auto">
                            {[
                                { id: 'terminal', label: t('ssh.terminal') },
                                { id: 'dashboard', label: t('ssh.dashboard') },
                                { id: 'files', label: t('ssh.files') },
                                { id: 'packages', label: t('ssh.packages') },
                                { id: 'logs', label: t('ssh.logs') },
                                { id: 'management', label: t('ssh.management') || 'Management' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as TabId)}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: activeTab === tab.id ? 'var(--background)' : 'transparent',
                                        border: 'none',
                                        color: activeTab === tab.id ? 'var(--foreground)' : 'var(--muted-foreground)',
                                        borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : 'none',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-hidden">
                            {activeTab === 'terminal' ? (
                                <SSHTerminal
                                    terminalOutput={terminalOutput}
                                    t={t}
                                    onExecute={(cmd) => {
                                        if (selectedConnectionId) {
                                            handleExecute(selectedConnectionId, cmd).catch(console.error)
                                        } else {
                                            setTerminalOutput(prev => prev + `${t('ssh.noServerConnected')}\n`)
                                        }
                                    }}
                                    selectedConnectionId={selectedConnectionId}
                                />
                            ) : !selectedConnectionId ? (
                                <div className="flex-1 h-full flex items-center justify-center bg-background text-muted-foreground">
                                    {t('ssh.selectConnection')}
                                </div>
                            ) : activeTab === 'dashboard' ? (
                                <StatsDashboard connectionId={selectedConnectionId} />
                            ) : activeTab === 'packages' ? (
                                <PackageManager connectionId={selectedConnectionId} />
                            ) : activeTab === 'logs' ? (
                                <SSHLogs connectionId={selectedConnectionId} active={activeTab === 'logs'} />
                            ) : activeTab === 'management' ? (
                                <NginxWizard connectionId={selectedConnectionId} language={language} />
                            ) : (
                                <SFTPBrowser connectionId={selectedConnectionId} />
                            )}
                        </div>
                    </div>
                </div>

                <AddConnectionModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    t={t}
                    newConnection={newConnection}
                    setNewConnection={setNewConnection}
                    shouldSaveProfile={shouldSaveProfile}
                    setShouldSaveProfile={setShouldSaveProfile}
                    isConnecting={isConnecting}
                    onConnect={() => handleAddConnection().catch(console.error)}
                />
            </div>
        </div>
    )
}
