import { useState, useEffect } from 'react'
import { SFTPBrowser } from './SFTPBrowser'
import { SSHConnection } from '../types'

interface SSHManagerProps {
    isOpen: boolean
    onClose: () => void
}

export function SSHManager({ isOpen, onClose }: SSHManagerProps) {
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
    const [isConnecting, setIsConnecting] = useState(false)
    const [terminalOutput, setTerminalOutput] = useState<string>('')
    const [activeTab, setActiveTab] = useState<'terminal' | 'files'>('terminal')
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            loadConnections()
            setupListeners()
        }
        return () => {
            if (isOpen) {
                window.electron.ssh.removeAllListeners()
            }
        }
    }, [isOpen])

    const setupListeners = () => {
        window.electron.ssh.onStdout((data: any) => {
            setTerminalOutput(prev => prev + data.toString())
        })
        window.electron.ssh.onStderr((data: any) => {
            setTerminalOutput(prev => prev + data.toString())
        })
        window.electron.ssh.onShellData((eventData: any) => {
            setTerminalOutput(prev => prev + eventData.data)
        })
        window.electron.ssh.onConnected((id: string) => {
            updateConnectionStatus(id, 'connected')
            setIsConnecting(false)
            setSelectedConnectionId(id)
            // Start shell when connected
            window.electron.ssh.shellStart(id)
        })
        window.electron.ssh.onDisconnected((id: string) => {
            updateConnectionStatus(id, 'disconnected')
            if (selectedConnectionId === id) setSelectedConnectionId(null)
        })
    }

    const loadConnections = async () => {
        const conns = await window.electron.ssh.getConnections()
        setConnections(conns.map((c: any) => ({
            ...c,
            status: 'disconnected' // Initial state, will check actual status
        })))

        // Check status for each
        for (const conn of conns) {
            const isConnected = await window.electron.ssh.isConnected(conn.id)
            if (isConnected) {
                updateConnectionStatus(conn.id, 'connected')
            }
        }
    }

    const updateConnectionStatus = (id: string, status: SSHConnection['status'], error?: string) => {
        setConnections(prev => prev.map(c =>
            c.id === id ? { ...c, status, error } : c
        ))
    }


    const handleAddConnection = async () => {
        setIsConnecting(true)
        setTerminalOutput(`Connecting to ${newConnection.host}...\n`)

        const result = await window.electron.ssh.connect({
            host: newConnection.host,
            port: newConnection.port,
            username: newConnection.username,
            password: newConnection.password,
            privateKey: newConnection.privateKey ? newConnection.privateKey : undefined
        })

        setIsConnecting(false)
        console.log('Connect result:', result)

        if (result.success) {
            setTerminalOutput(prev => prev + `Successfully connected to ${newConnection.host}\n`)
            setShowAddModal(false)
            loadConnections()
        } else {
            setTerminalOutput(prev => prev + `Error: ${result.error}\n`)
        }
    }

    const handleDisconnect = async (id: string) => {
        await window.electron.ssh.disconnect(id)
        updateConnectionStatus(id, 'disconnected')
        setTerminalOutput(prev => prev + `Disconnected.\n`)
    }

    const handleExecute = async (id: string, cmd: string) => {
        if (!cmd.trim()) return
        // Send to interactive shell
        await window.electron.ssh.shellWrite(id, cmd + '\n')
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay">
            <div className="modal-content ssh-manager bg-popover border border-border shadow-2xl rounded-2xl overflow-hidden" style={{ width: '800px', height: '600px', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2>SSH Bağlantıları</h2>
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
                            + Yeni Bağlantı
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
                                        {conn.status === 'connected' && (
                                            <button
                                                onClick={() => handleDisconnect(conn.id)}
                                                style={{ fontSize: '0.8em', padding: '2px 6px' }}
                                            >
                                                Kes
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Terminal / Details Area */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="ssh-tabs flex border-b border-border/50 bg-muted/20">
                            <button
                                onClick={() => setActiveTab('terminal')}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: activeTab === 'terminal' ? 'var(--background)' : 'transparent',
                                    border: 'none',
                                    color: activeTab === 'terminal' ? 'var(--foreground)' : 'var(--muted-foreground)',
                                    borderBottom: activeTab === 'terminal' ? '2px solid var(--primary)' : 'none'
                                }}
                            >
                                Terminal
                            </button>
                            <button
                                onClick={() => setActiveTab('files')}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: activeTab === 'files' ? 'var(--background)' : 'transparent',
                                    border: 'none',
                                    color: activeTab === 'files' ? 'var(--foreground)' : 'var(--muted-foreground)',
                                    borderBottom: activeTab === 'files' ? '2px solid var(--primary)' : 'none'
                                }}
                            >
                                Dosyalar
                            </button>
                        </div>

                        {activeTab === 'terminal' ? (
                            <div className="flex-1 p-4 flex flex-col bg-background">
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
                                    {terminalOutput || 'Terminal çıktısı burada görünecek...'}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        placeholder="Komut çalıştır..."
                                        style={{ flex: 1, padding: '8px', backgroundColor: 'var(--muted)', border: 'none', color: 'var(--foreground)' }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const target = e.target as HTMLInputElement
                                                if (selectedConnectionId) {
                                                    handleExecute(selectedConnectionId, target.value)
                                                    target.value = ''
                                                } else {
                                                    setTerminalOutput(prev => prev + 'Bağlı sunucu yok!\n')
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        ) : (
                            selectedConnectionId ? (
                                <SFTPBrowser connectionId={selectedConnectionId} />
                            ) : (
                                <div className="flex-1 flex items-center justify-center bg-background text-muted-foreground">
                                    Lütfen bir bağlantı seçin
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* Add Connection Modal Overlay */}
                {showAddModal && (
                    <div className="modal-overlay" style={{ zIndex: 1000 }}>
                        <div className="modal-content" style={{ width: '400px' }}>
                            <h3>Yeni Bağlantı</h3>
                            <div className="form-group">
                                <label>Host</label>
                                <input
                                    value={newConnection.host}
                                    onChange={e => setNewConnection({ ...newConnection, host: e.target.value })}
                                    placeholder="192.168.1.1"
                                />
                            </div>
                            <div className="form-group">
                                <label>Port</label>
                                <input
                                    type="number"
                                    value={newConnection.port}
                                    onChange={e => setNewConnection({ ...newConnection, port: parseInt(e.target.value) })}
                                    placeholder="22"
                                />
                            </div>
                            <div className="form-group">
                                <label>Username</label>
                                <input
                                    value={newConnection.username}
                                    onChange={e => setNewConnection({ ...newConnection, username: e.target.value })}
                                    placeholder="root"
                                />
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <input
                                    type="password"
                                    value={newConnection.password}
                                    onChange={e => setNewConnection({ ...newConnection, password: e.target.value })}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                                <button onClick={() => setShowAddModal(false)}>İptal</button>
                                <button className="primary-btn" onClick={handleAddConnection} disabled={isConnecting}>
                                    {isConnecting ? 'Bağlanıyor...' : 'Bağlan'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
