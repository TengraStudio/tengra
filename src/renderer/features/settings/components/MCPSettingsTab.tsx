import { useState } from 'react'
import { Server, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MCPServersTab } from './MCPServersTab'
import { MCPStore } from '@/features/mcp/MCPStore'

export const MCPSettingsTab = () => {
    const [activeTab, setActiveTab] = useState<'servers' | 'marketplace'>('servers')

    return (
        <div className="h-full flex flex-col">
            {/* Sub-tab Navigation */}
            <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Model Context Protocol</h1>
                    <p className="text-sm text-muted-foreground">Manage your MCP servers and install new tools</p>
                </div>

                <div className="flex bg-muted/40 p-1 rounded-lg border border-border/40">
                    <button
                        onClick={() => setActiveTab('servers')}
                        className={cn(
                            "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                            activeTab === 'servers'
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                    >
                        <Server className="w-4 h-4" />
                        Servers
                    </button>
                    <button
                        onClick={() => setActiveTab('marketplace')}
                        className={cn(
                            "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                            activeTab === 'marketplace'
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                    >
                        <ShoppingBag className="w-4 h-4" />
                        Marketplace
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'servers' ? (
                    <MCPServersTab />
                ) : (
                    <MCPStore />
                )}
            </div>
        </div>
    )
}
