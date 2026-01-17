
import React from 'react'

import { SSHConnection } from '@/types'

interface SSHConnectionListProps {
    connections: SSHConnection[]
    selectedId: string | null
    onSelect: (id: string) => void
    onConnect: (conn: SSHConnection) => void
    onDisconnect: (id: string) => void
    onDelete: (id: string, e: React.MouseEvent) => void
    onAdd: () => void
    t: (key: string, params?: Record<string, string | number>) => string
}

export const SSHConnectionList: React.FC<SSHConnectionListProps> = ({
    connections,
    selectedId,
    onSelect,
    onConnect,
    onDisconnect,
    onDelete,
    onAdd,
    t
}) => {
    return (
        <div className="border-r border-border/50 p-4 flex flex-col bg-muted/10 w-[250px]">
            <button
                className="primary-btn"
                style={{ marginBottom: '16px' }}
                onClick={onAdd}
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
                        backgroundColor: conn.id === selectedId ? 'var(--primary-transparent, rgba(16, 163, 127, 0.1))' : 'transparent',
                        cursor: 'pointer'
                    }}
                        onClick={() => conn.status === 'connected' && onSelect(conn.id)}
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
                                        onDisconnect(conn.id)
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
                                            onConnect(conn)
                                        }}
                                        className="text-xs px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary rounded border border-primary/20"
                                    >
                                        {t('ssh.connect')}
                                    </button>
                                    <button
                                        onClick={(e) => onDelete(conn.id, e)}
                                        className="text-xs px-2 py-0.5 hover:bg-red-500/10 hover:text-red-500 text-muted-foreground rounded transition-colors"
                                        title={t('ssh.deleteProfile')}
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
    )
}
