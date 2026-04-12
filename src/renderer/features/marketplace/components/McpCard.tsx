import { Package, Shield, Trash2, CheckCircle2, Zap } from 'lucide-react';

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
    version?: string;
    author?: string;
}

interface McpCardProps {
    plugin: McpPlugin;
    t: (key: string, options?: Record<string, string | number>) => string;
    onUninstall?: (id: string, name: string) => void;
}

export const McpCard = ({ plugin, t, onUninstall }: McpCardProps): JSX.Element => {
    const localizedDesc = t(`marketplace.mcp.plugins.${plugin.name.toLowerCase()}.description`);
    const description = localizedDesc.includes('marketplace.mcp.plugins') ? plugin.description : localizedDesc;
    
    return (
        <div className={`
            group relative flex h-full min-h-[160px] flex-col overflow-hidden rounded-xl border transition-all duration-300
            ${plugin.isEnabled 
                ? 'border-primary/50 bg-card/10 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] ring-1 ring-primary/20' 
                : 'border-border/40 bg-card/20 hover:border-primary/30 hover:bg-card/40'}
            p-5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] hover:scale-[1.01] active:scale-[0.995]
        `}>
            {/* Visual glow if enabled */}
            {plugin.isEnabled && (
                <div className="absolute -inset-px rounded-xl border border-primary/40 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
            )}

            <div className="relative z-10 flex flex-1 flex-col">
                <div className="flex gap-5">
                    {/* Icon Container */}
                    <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-xl transition-all shadow-inner group-hover:scale-105
                        ${plugin.isEnabled 
                            ? 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/30' 
                            : 'bg-muted/30 text-muted-foreground ring-1 ring-inset ring-white/5'
                        }`}>
                        {plugin.source === 'core' ? <Shield className="h-10 w-10" /> : <Package className="h-10 w-10" />}
                    </div>

                    <div className="flex flex-col justify-center min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                            <h3 className="truncate text-lg font-black tracking-tight text-foreground transition-colors group-hover:text-primary">
                                {plugin.name}
                            </h3>
                            {plugin.isAlive && (
                                <div 
                                    className="h-2.5 w-2.5 shrink-0 rounded-full bg-success shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-pulse" 
                                    title={t('common.active')} 
                                />
                            )}
                        </div>
                        
                        <div className="mt-2 flex items-center gap-3">
                            <span className="truncate max-w-[140px] text-[11px] font-bold uppercase tracking-wider text-muted-foreground/40 italic">
                                {plugin.author || (plugin.source === 'core' ? 'Tengra Core' : 'Unknown')}
                            </span>
                            <span className="h-1 w-1 rounded-full bg-border/40" />
                            <div className="flex h-5 items-center gap-1 rounded bg-muted/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 ring-1 ring-inset ring-white/5">
                                V{plugin.version || '1.0.0'}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons - Top Right */}
                    <div className="flex items-start gap-2.5 h-fit shrink-0">
                        {onUninstall && plugin.source !== 'core' && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUninstall(plugin.id, plugin.name);
                                }}
                                title={t('marketplace.uninstall')}
                                className="group/btn h-9 w-9 flex items-center justify-center rounded-lg bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20 hover:bg-destructive hover:text-destructive-foreground transition-all active:scale-90 shadow-sm"
                            >
                                <Trash2 className="h-4 w-4 transition-transform group-hover/btn:rotate-12" />
                            </button>
                        )}
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success ring-1 ring-inset ring-success/20 shadow-sm">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex-1">
                    <p className="line-clamp-3 text-[13px] font-medium leading-relaxed text-muted-foreground/60 transition-colors group-hover:text-muted-foreground/80">
                        {description}
                    </p>
                </div>

                {plugin.actions.length > 0 && (
                    <div className="mt-5 space-y-3 border-t border-border/5 pt-4">
                        <div className="flex items-center gap-2 opacity-50">
                            <Zap className="h-3 w-3 text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{t('marketplace.mcp.stats.tools')}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 overflow-hidden max-h-14">
                            {plugin.actions.slice(0, 5).map((action, index) => (
                                <div 
                                    key={`${plugin.id}-${action.name}-${index}`} 
                                    className="rounded bg-muted/20 px-2 py-1 text-[10px] font-bold text-muted-foreground/80 ring-1 ring-inset ring-white/5 hover:bg-primary/10 hover:text-primary transition-colors cursor-default"
                                    title={action.description}
                                >
                                    {action.name}
                                </div>
                            ))}
                            {plugin.actions.length > 5 && (
                                <div className="rounded bg-muted/10 px-2 py-1 text-[10px] font-bold text-muted-foreground/40 ring-1 ring-inset ring-white/5">
                                    +{plugin.actions.length - 5}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

