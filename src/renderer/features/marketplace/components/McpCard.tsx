import { CircleDot, Package, Power, Shield, Trash2 } from 'lucide-react';

interface McpAction { name: string; description: string; }
export interface McpPlugin { id: string; name: string; description: string; isEnabled: boolean; isAlive: boolean; source: 'core' | 'user' | 'remote'; actions: McpAction[]; }
interface McpCardProps { plugin: McpPlugin; t: (key: string, options?: Record<string, string | number>) => string; onToggle: (p: McpPlugin) => void; onUninstall: (p: McpPlugin) => void; }

export const McpCard = ({ plugin, t, onToggle, onUninstall }: McpCardProps): JSX.Element => {
    const localizedDesc = t(`marketplace.mcp.plugins.${plugin.name.toLowerCase()}.description`);
    const description = localizedDesc.includes('marketplace.mcp.plugins') ? plugin.description : localizedDesc;

    return (
        <div className={`flex flex-col border rounded-lg overflow-hidden transition-all duration-300 ${
            plugin.isEnabled ? 'bg-card border-border shadow-sm ring-1 ring-primary/5' : 'bg-muted/10 border-border/20 opacity-60 grayscale-50'
        }`}>
            <div className="p-5 space-y-4">
                <CardHeader plugin={plugin} description={description} onToggle={onToggle} onUninstall={onUninstall} />
                {plugin.isEnabled && plugin.actions.length > 0 && <CardActions actions={plugin.actions} t={t} />}
            </div>
        </div>
    );
};

function CardHeader({ plugin, description, onToggle, onUninstall }: Omit<McpCardProps, 't'> & { description: string }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
                <div className={`p-2.5 rounded mt-0.5 flex-shrink-0 ${plugin.isEnabled ? 'bg-primary/10 text-primary shadow-sm' : 'bg-muted text-muted-foreground/40'}`}>
                    {plugin.source === 'core' ? <Shield className="w-4.5 h-4.5" /> : <Package className="w-4.5 h-4.5" />}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="text-sm font-bold truncate leading-none text-foreground">{plugin.name}</h3>
                        <StatusBadge isEnabled={plugin.isEnabled} />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium leading-relaxed line-clamp-3">{description}</p>
                </div>
            </div>
            <CardControls plugin={plugin} onToggle={onToggle} onUninstall={onUninstall} />
        </div>
    );
}

function StatusBadge({ isEnabled }: { isEnabled: boolean }) {
    return isEnabled ? (
        <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-success/10 text-success text-xs font-bold">
            <div className="w-1 h-1 rounded-full bg-success animate-pulse" /> Active
        </span>
    ) : (
        <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground/40 text-xs font-bold">
            Standby
        </span>
    );
}

function CardControls({ plugin, onToggle, onUninstall }: Omit<McpCardProps, 't'>) {
    return (
        <div className="flex items-center gap-2 flex-shrink-0">
            <button
                onClick={() => onToggle(plugin)}
                className={`p-2 rounded-md transition-all duration-200 ${
                    plugin.isEnabled ? 'bg-foreground text-background shadow-md ring-2 ring-primary/20' : 'bg-muted border border-border/40 text-muted-foreground/40 hover:bg-muted/80'
                }`}
            >
                <Power className="w-4 h-4" />
            </button>
            {plugin.source !== 'core' && (
                <button onClick={() => onUninstall(plugin)} className="p-2 rounded-md text-muted-foreground/30 hover:bg-destructive/5 hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}

function CardActions({ actions, t }: { actions: McpAction[], t: (key: string, options?: Record<string, string | number>) => string }) {
    return (
        <div className="pt-4 border-t border-border/10 space-y-3">
            <div className="flex items-center gap-2 opacity-30">
                <CircleDot className="w-3 h-3 text-primary" />
                <span className="text-xs font-bold">{t('marketplace.mcp.stats.tools')}</span>
            </div>
            <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border/20">
                {actions.map((action, idx) => (
                    <div key={idx} className="group/item flex flex-col p-2.5 rounded bg-muted/10 border border-border/5 hover:bg-muted/20 transition-colors">
                        <span className="text-sm font-bold text-foreground mb-0.5">{action.name}</span>
                        <span className="text-xs text-muted-foreground font-medium leading-snug">{action.description}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
