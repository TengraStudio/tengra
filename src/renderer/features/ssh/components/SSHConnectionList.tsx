import React, { CSSProperties, memo, useCallback, useMemo } from 'react';
import { List, RowComponentProps } from 'react-window';

import { cn } from '@/lib/utils';
import { SSHConnection } from '@/types';

// PERF-001-2: Virtualization threshold and constants
const VIRTUALIZATION_THRESHOLD = 50;
const ITEM_HEIGHT = 100; // Approximate height of connection cards
const LIST_HEIGHT = 500; // Default list container height

interface SSHConnectionListProps {
    connections: SSHConnection[]
    selectedId: string | null
    onSelect: (id: string) => void
    onConnect: (conn: SSHConnection) => void
    onDisconnect: (id: string) => void
    onDeleteRequest: (id: string) => void
    onAdd: () => void
    t: (key: string, params?: Record<string, string | number>) => string
    /** Optional: height of the list container for virtualization */
    listHeight?: number
}

interface RowProps {
    connections: SSHConnection[]
    selectedId: string | null
    onSelect: (id: string) => void
    onConnect: (conn: SSHConnection) => void
    onDisconnect: (id: string) => void
    onDeleteRequest: (id: string) => void
    t: (key: string, params?: Record<string, string | number>) => string
}

/**
 * PERF-001-2: Connection card component for both virtualized and non-virtualized rendering
 */
const ConnectionCard = memo(({
    conn,
    selectedId,
    onSelect,
    onConnect,
    onDisconnect,
    onDeleteRequest,
    t
}: {
    conn: SSHConnection
    selectedId: string | null
    onSelect: (id: string) => void
    onConnect: (conn: SSHConnection) => void
    onDisconnect: (id: string) => void
    onDeleteRequest: (id: string) => void
    t: (key: string, params?: Record<string, string | number>) => string
}) => (
    <div
        className={cn(
            "p-3 border rounded-lg mb-2 cursor-pointer transition-all",
            conn.id === selectedId
                ? "bg-primary/10 border-primary/40"
                : "bg-transparent border-border hover:bg-muted/30"
        )}
        onClick={() => conn.status === 'connected' && onSelect(conn.id)}
    >
        <div className="font-bold text-foreground">{conn.name !== '' ? conn.name : conn.host}</div>
        <div style={{ fontSize: '0.8em', opacity: 0.7 }}>{conn.username}@{conn.host}</div>
        <div style={{ marginTop: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className={cn(
                "text-xxs font-bold uppercase tracking-wider",
                conn.status === 'connected' ? "text-primary" :
                    conn.status === 'connecting' ? "text-warning" : "text-muted-foreground"
            )}>
                ● {conn.status}
            </span>
            {conn.status === 'connected' ? (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDisconnect(conn.id);
                    }}
                    className="text-xs px-2 py-0.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded border border-destructive/20"
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
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeleteRequest(conn.id);
                        }}
                        className="text-xs px-2 py-0.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded transition-colors"
                        title={t('ssh.deleteProfile')}
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    </div>
));
ConnectionCard.displayName = 'ConnectionCard';

/**
 * PERF-001-2: Virtualized row renderer for connection list
 */
const ConnectionRow = ({
    index,
    style,
    connections,
    selectedId,
    onSelect,
    onConnect,
    onDisconnect,
    onDeleteRequest,
    t
}: RowComponentProps<RowProps> & { index: number; style: CSSProperties }) => {
    const conn = connections[index];

    return (
        <div style={style}>
            <ConnectionCard
                conn={conn}
                selectedId={selectedId}
                onSelect={onSelect}
                onConnect={onConnect}
                onDisconnect={onDisconnect}
                onDeleteRequest={onDeleteRequest}
                t={t}
            />
        </div>
    );
};

export const SSHConnectionList: React.FC<SSHConnectionListProps> = ({
    connections,
    selectedId,
    onSelect,
    onConnect,
    onDisconnect,
    onDeleteRequest,
    onAdd,
    t,
    listHeight = LIST_HEIGHT
}) => {
    // PERF-001-2: Memoize row props to prevent unnecessary re-renders
    const rowProps = useMemo<RowProps>(() => ({
        connections,
        selectedId,
        onSelect,
        onConnect,
        onDisconnect,
        onDeleteRequest,
        t
    }), [connections, selectedId, onSelect, onConnect, onDisconnect, onDeleteRequest, t]);

    // PERF-001-2: Use virtualization for large lists
    const shouldVirtualize = connections.length > VIRTUALIZATION_THRESHOLD;

    // Memoized row component creator
    const RowComponent = useCallback(
        (props: RowComponentProps<RowProps>) => <ConnectionRow {...props} {...rowProps} />,
        [rowProps]
    );

    return (
        <div className="border-r border-border/50 p-4 flex flex-col bg-muted/20 w-64">
            <button
                className="primary-btn"
                style={{ marginBottom: '16px' }}
                onClick={onAdd}
            >
                {t('ssh.newConnection')}
            </button>

            <div className="connection-list" style={{ overflowY: shouldVirtualize ? 'hidden' : 'auto', flex: 1 }}>
                {shouldVirtualize ? (
                    // PERF-001-2: Use virtualized list for large datasets
                    <List
                        style={{ height: listHeight }}
                        rowCount={connections.length}
                        rowHeight={ITEM_HEIGHT}
                        rowComponent={RowComponent}
                        rowProps={rowProps}
                        overscanCount={5}
                    />
                ) : (
                    // Regular rendering for small lists
                    connections.map(conn => (
                        <ConnectionCard
                            key={conn.id}
                            conn={conn}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            onConnect={onConnect}
                            onDisconnect={onDisconnect}
                            onDeleteRequest={onDeleteRequest}
                            t={t}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
