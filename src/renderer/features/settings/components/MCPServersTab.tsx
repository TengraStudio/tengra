import { CheckCircle2, Edit2,Plus, Server, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

interface MCPServer {
    id: string
    name: string
    url: string
    status: 'connected' | 'disconnected' | 'error'
    type: 'stdio' | 'sse'
}

export const MCPServersTab = () => {
    const [servers, setServers] = useState<MCPServer[]>([
        { id: '1', name: 'Local Dev Server', url: 'http://localhost:8000/sse', status: 'connected', type: 'sse' },
        { id: '2', name: 'PostgreSQL MCP', url: 'stdio: npx -y @modelcontextprotocol/server-postgres', status: 'disconnected', type: 'stdio' }
    ]);

    const handleDelete = (id: string) => {
        setServers(prev => prev.filter(s => s.id !== id));
    };

    return (
        <div className="h-full flex flex-col p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Server className="w-5 h-5" />
                        Configured Servers
                    </h2>
                    <p className="text-sm text-muted-foreground">Manage your Model Context Protocol server connections</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                    <Plus className="w-4 h-4" />
                    Connect Server
                </button>
            </div>

            <div className="grid gap-3">
                {servers.map(server => (
                    <div key={server.id} className="group flex items-center justify-between p-4 bg-muted/30 border border-border/50 rounded-xl hover:border-border/80 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "p-2.5 rounded-lg",
                                server.status === 'connected' ? "bg-green-500/10 text-green-500" :
                                    server.status === 'error' ? "bg-red-500/10 text-red-500" :
                                        "bg-zinc-500/10 text-zinc-500"
                            )}>
                                <Server className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-medium flex items-center gap-2">
                                    {server.name}
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted uppercase text-muted-foreground border">
                                        {server.type}
                                    </span>
                                </h3>
                                <p className="text-xs text-muted-foreground font-mono mt-0.5">{server.url}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-1 bg-background rounded-full border border-border/50">
                                {server.status === 'connected' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                                {server.status === 'disconnected' && <div className="w-2 h-2 rounded-full bg-zinc-400" />}
                                {server.status === 'error' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                                <span className="text-xs capitalize">{server.status}</span>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(server.id)}
                                    className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {servers.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50 border border-dashed border-border/50 rounded-xl">
                        <Server className="w-10 h-10 mb-3 opacity-20" />
                        <p>No servers connected</p>
                    </div>
                )}
            </div>
        </div>
    );
};
