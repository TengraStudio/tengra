import { NginxWizard } from '@renderer/features/ssh/NginxWizard'
import { PackageManager } from '@renderer/features/ssh/PackageManager'
import { SFTPBrowser } from '@renderer/features/ssh/SFTPBrowser'
import { SSHLogs } from '@renderer/features/ssh/SSHLogs'
import { StatsDashboard } from '@renderer/features/ssh/StatsDashboard'
import { useCallback,useEffect, useState } from 'react'

import { Language,useTranslation } from '@/i18n'
import { SSHConnection } from '@/types'

interface SSHManagerProps {
    isOpen: boolean
    onClose: () => void
    language: Language
}

interface SSHProfile {
    id: string
    name: string
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
}

export function SSHManager({ isOpen, onClose, language }: SSHManagerProps) {
    const { t } = useTranslation(language)
    const [connections, setConnections] = useState<SSHConnection[]>([])
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
    const [isConnecting, setIsConnecting] = useState(false)
    const [terminalOutput, setTerminalOutput] = useState<string>('')
    type TabId = 'terminal' | 'dashboard' | 'files' | 'packages' | 'logs' | 'management'
    const [activeTab, setActiveTab] = useState<TabId>('terminal')
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)

    const updateConnectionStatus = useCallback((id: string, status: SSHConnection['status'], error?: string) => {
        setConnections(prev => prev.map(c =>
            c.id === id ? { ...c, status, error } : c
        ))
    }, [])

    const setupListeners = useCallback(() => {
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
        window.electron.ssh.onConnected((id: string) => {
            updateConnectionStatus(id, 'connected')
            setIsConnecting(false)
            setSelectedConnectionId(id)
            window.electron.ssh.shellStart(id)
        })
        window.electron.ssh.onDisconnected((id: string) => {
            updateConnectionStatus(id, 'disconnected')
            if (selectedConnectionId === id) {setSelectedConnectionId(null)}
        })
    }, [selectedConnectionId, updateConnectionStatus])

    const loadConnections = useCallback(async () => {
        try {
            const profilesRaw = await window.electron.ssh.getProfiles() as SSHProfile[] || []
            const activeConns = await window.electron.ssh.getConnections() || []

            const merged: SSHConnection[] = profilesRaw.map(p => ({
                id: p.id || '',
                name: p.name || '',
                host: p.host || '',
                port: p.port || 22,
                username: p.username || '',
                password: p.password,
                privateKey: p.privateKey,
                status: 'disconnected' as const
            }))

            for (const active of activeConns) {
                const existingIndex = merged.findIndex(p => p.id === active.id)
                if (existingIndex >= 0) {
                    merged[existingIndex] = { ...merged[existingIndex], ...active, status: 'connected' as const }
                } else {
                    merged.push({ ...active, status: 'connected' as const } as SSHConnection)
                }
            }

            setConnections(merged)

            for (const conn of merged) {
                if (conn.status !== 'connected') {continue}
                const isConnected = await window.electron.ssh.isConnected(conn.id)
                if (!isConnected) {
                    updateConnectionStatus(conn.id, 'disconnected')
                }
            }
        } catch (e) {
            console.error('Failed to load connections:', e)
        }
    }, [updateConnectionStatus])

    useEffect(() => {
        let isMounted = true
        if (isOpen) {
            const init = async () => {
                await loadConnections()
                if (isMounted) {
                    setupListeners()
                }
            }
            init()
        }
        return () => {
            isMounted = false
            window.electron.ssh.removeAllListeners()
        }
    }, [isOpen, loadConnections, setupListeners])


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
                await window.electron.ssh.saveProfile({
                    ...newConnection,
                    id: result.id || '',
                    name: newConnection.name || newConnection.host
                })
            }

            loadConnections()
        } else {
            setTerminalOutput(prev => prev + `${t('ssh.connectionError', { error: result.error || 'Unknown error' })}\n`)
        }
    }

    const handleDeleteProfile = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (confirm(t('ssh.confirmDelete') || 'Are you sure you want to delete this profile?')) {
            await window.electron.ssh.deleteProfile(id)
            loadConnections()
        }
    }

    const handleDisconnect = async (id: string) => {
        await window.electron.ssh.disconnect(id)
        updateConnectionStatus(id, 'disconnected')
        setTerminalOutput(prev => prev + `${t('ssh.disconnected') || 'Disconnected.'}\n`)
    }

    const handleExecute = async (id: string, cmd: string) => {
        if (!cmd.trim()) {return}
        await window.electron.ssh.shellWrite(id, cmd + '\n')
    }

    if (!isOpen) {return null}

    return (
        <div className="modal-overlay">
            <div className="modal-content ssh-manager bg-popover border border-border shadow-2xl rounded-2xl overflow-hidden" style={{ width: '800px', height: '600px', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2>{t('ssh.title')}</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Sidebar list */}
                    <div className="border-r border-border/50 p-4 flex flex-col bg-muted/10 w-[250px]">
                        <button
                            className="primary-btn"
                            style={{ marginBottom: '16px' }}
                            onClick={() => setShowAddModal(true)}
                        >
                            {t('ssh.newConnection')}
                        </button>

                        <div className="connection-list" style={{ overflowY: 'auto', flex: 1 }}>
                            {connections.map(conn => (
                                <div key={conn.id} className="connection-item" style={{
                                    padding: '10px',
                                    border: '1px solid var(--border-secondary)',
                                    borderRadius: '8px',
                                    marginBottom: '8px',
                                    backgroundColor: conn.id === selectedConnectionId ? 'var(--primary-transparent, rgba(16, 163, 127, 0.1))' : 'transparent',
                                    cursor: 'pointer'
                                }}
                                    onClick={() => conn.status === 'connected' && setSelectedConnectionId(conn.id)}
                                >
                                    <div style={{ fontWeight: 'bold' }}>{conn.name || conn.host}</div>
                                    <div style={{ fontSize: '0.8em', opacity: 0.7 }}>{conn.username}@{conn.host}</div>
                                    <div style={{ marginTop: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{
                                            fontSize: '0.8em',
                                            color: conn.status === 'connected' ? '#4CAF50' :
                                                conn.status === 'connecting' ? '#FFC107' : '#9E9E9E'
                                        }}>
                                            ● {conn.status}
                                        </span>
                                        {conn.status === 'connected' ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDisconnect(conn.id)
                                                }}
                                                className="text-xs px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded border border-red-500/20"
                                            >
                                                {t('ssh.disconnect')}
                                            </button>
                                        ) : (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        window.electron.ssh.connect({
                                                            host: conn.host,
                                                            port: conn.port,
                                                            username: conn.username,
                                                            password: conn.password,
                                                            privateKey: conn.privateKey
                                                        }).then(() => loadConnections())
                                                    }}
                                                    className="text-xs px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary rounded border border-primary/20"
                                                >
                                                    {t('ssh.connect')}
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteProfile(conn.id, e)}
                                                    className="text-xs px-2 py-0.5 hover:bg-red-500/10 hover:text-red-500 text-muted-foreground rounded transition-colors"
                                                    title="Delete Profile"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

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
                                <div className="flex h-full p-4 flex-col bg-background">
                                    <div style={{
                                        flex: 1,
                                        backgroundColor: 'var(--terminal-bg, #000)',
                                        color: 'var(--terminal-fg, #0f0)',
                                        fontFamily: 'monospace',
                                        padding: '10px',
                                        borderRadius: '4px',
                                        overflowY: 'auto',
                                        whiteSpace: 'pre-wrap',
                                        marginBottom: '10px'
                                    }}>
                                        {terminalOutput || t('ssh.terminalOutput')}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text"
                                            placeholder={t('ssh.runCommand')}
                                            className="flex-1 p-2 bg-muted border-none text-foreground text-sm rounded outline-none"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const target = e.target as HTMLInputElement
                                                    if (selectedConnectionId) {
                                                        handleExecute(selectedConnectionId, target.value)
                                                        target.value = ''
                                                    } else {
                                                        setTerminalOutput(prev => prev + `${t('ssh.noServerConnected')}\n`)
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
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

                {/* Add Connection Modal Overlay */}
                {showAddModal && (
                    <div className="modal-overlay" style={{ zIndex: 1000 }}>
                        <div className="modal-content" style={{ width: '400px' }}>
                            <h3>{t('ssh.newConnectionTitle')}</h3>
                            <div className="form-group">
                                <label>{t('ssh.host')}</label>
                                <input
                                    value={newConnection.host}
                                    onChange={e => setNewConnection({ ...newConnection, host: e.target.value })}
                                    placeholder="192.168.1.1"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('ssh.port')}</label>
                                <input
                                    type="number"
                                    value={newConnection.port}
                                    onChange={e => setNewConnection({ ...newConnection, port: parseInt(e.target.value) })}
                                    placeholder="22"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('ssh.username')}</label>
                                <input
                                    value={newConnection.username}
                                    onChange={e => setNewConnection({ ...newConnection, username: e.target.value })}
                                    placeholder="root"
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('ssh.password')}</label>
                                <input
                                    type="password"
                                    value={newConnection.password}
                                    onChange={e => setNewConnection({ ...newConnection, password: e.target.value })}
                                />
                            </div>
                            <div className="form-group flex items-center gap-2 mt-4">
                                <input
                                    type="checkbox"
                                    id="saveProfile"
                                    checked={shouldSaveProfile}
                                    onChange={e => setShouldSaveProfile(e.target.checked)}
                                />
                                <label htmlFor="saveProfile" className="text-sm select-none cursor-pointer">
                                    {t('ssh.saveProfile') || 'Save Connection Profile'}
                                </label>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                                <button onClick={() => setShowAddModal(false)}>{t('common.cancel')}</button>
                                <button className="primary-btn" onClick={handleAddConnection} disabled={isConnecting}>
                                    {isConnecting ? t('ssh.connecting') : t('ssh.connect')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
