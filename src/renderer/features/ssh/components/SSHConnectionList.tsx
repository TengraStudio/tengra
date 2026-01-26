
import React from 'react';

import { cn } from '@/lib/utils';
import { SSHConnection } from '@/types';

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
        <div className="border-r border-border/50 p-4 flex flex-col bg-muted/20 w-[250px]">
            <button
                className="primary-btn"
                style={{ marginBottom: '16px' }}
                onClick={onAdd}
            >
                {t('ssh.newConnection')}
            </button>

            <div className="connection-list" style={{ overflowY: 'auto', flex: 1 }}>
                {connections.map(conn => (
                    <div key={conn.id} className={cn(
                        "p-3 border rounded-lg mb-2 cursor-pointer transition-all",
                        conn.id === selectedId
                            ? "bg-primary/10 border-primary/40"
                            : "bg-transparent border-border hover:bg-muted/30"
                    )}
                        onClick={() => conn.status === 'connected' && onSelect(conn.id)}
                    >
                        <div className="font-bold text-foreground">{conn.name || conn.host}</div>
                        <div style={{ fontSize: '0.8em', opacity: 0.7 }}>{conn.username}@{conn.host}</div>
                        <div style={{ marginTop: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wider",
                                conn.status === 'connected' ? "text-primary" :
                                    conn.status === 'connecting' ? "text-amber-500" : "text-muted-foreground"
                            )}>
                                ● {conn.status}
                            </span>
                            {conn.status === 'connected' ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDisconnect(conn.id);
                                    }}
                                    className="text-xs px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded border border-red-500/20"
                                >
                                    {t('ssh.disconnect')}
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onConnect(conn);
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
    );
};
