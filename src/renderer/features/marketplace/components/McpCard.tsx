import { CircleDot, Package, Shield } from 'lucide-react';

interface McpAction {
    name: string;
    description: string;
}

export interface McpPlugin {
    id: string;
    name: string;
    description: string;
    isEnabled: boolean;
    isAlive: boolean;
    source: 'core' | 'user' | 'remote';
    actions: McpAction[];
}

interface McpCardProps {
    plugin: McpPlugin;
    t: (key: string, options?: Record<string, string | number>) => string;
}

export const McpCard = ({ plugin, t }: McpCardProps): JSX.Element => {
    const localizedDesc = t(`marketplace.mcp.plugins.${plugin.name.toLowerCase()}.description`);
    const description = localizedDesc.includes('marketplace.mcp.plugins') ? plugin.description : localizedDesc;
    const statusLabel = plugin.isEnabled ? t('common.active') : t('marketplace.mcp.stats.inactive');

    return (
        <div className={`flex flex-col overflow-hidden rounded-lg border transition-all duration-300 ${
            plugin.isEnabled ? 'border-border bg-card shadow-sm ring-1 ring-primary/5' : 'border-border/20 bg-muted/10'
        }`}>
            <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-4">
                        <div className={`mt-0.5 flex-shrink-0 rounded p-2.5 ${plugin.isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {plugin.source === 'core' ? <Shield className="h-4.5 w-4.5" /> : <Package className="h-4.5 w-4.5" />}
                        </div>
                        <div className="min-w-0">
                            <div className="mb-1.5 flex items-center gap-2">
                                <h3 className="truncate text-sm font-bold leading-none text-foreground">{plugin.name}</h3>
                                <span className={`rounded-full px-1.5 py-0.5 typo-caption font-bold ${plugin.isEnabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                                    {statusLabel}
                                </span>
                            </div>
                            <p className="line-clamp-3 text-sm font-medium leading-relaxed text-muted-foreground">{description}</p>
                        </div>
                    </div>
                </div>

                {plugin.actions.length > 0 && (
                    <div className="space-y-3 border-t border-border/10 pt-4">
                        <div className="flex items-center gap-2 opacity-60">
                            <CircleDot className="h-3 w-3 text-primary" />
                            <span className="typo-caption font-bold">{t('marketplace.mcp.stats.tools')}</span>
                        </div>
                        <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                            {plugin.actions.map((action, index) => (
                                <div key={`${plugin.id}-${action.name}-${index}`} className="flex flex-col rounded border border-border/10 bg-muted/10 p-2.5">
                                    <span className="mb-0.5 text-sm font-bold text-foreground">{action.name}</span>
                                    <span className="typo-caption font-medium leading-snug text-muted-foreground">{action.description}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

