import { MCPServersTab } from '@renderer/features/settings/components/MCPServersTab';
import { useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { MCPMarketplaceStudio } from '../../mcp/MCPMarketplaceStudio';

export const MCPSettingsTab = () => {
    const { t } = useTranslation();
    const [activeView, setActiveView] = useState<'servers' | 'marketplace'>('marketplace');

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border/40">
                <h1 className="text-xl font-bold">{t('settings.mcp.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('settings.mcp.subtitle')}</p>
                <div className="mt-4 flex items-center gap-2">
                    <button
                        onClick={() => setActiveView('marketplace')}
                        className={cn(
                            'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                            activeView === 'marketplace'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {t('settings.tabs.mcpMarketplace')}
                    </button>
                    <button
                        onClick={() => setActiveView('servers')}
                        className={cn(
                            'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                            activeView === 'servers'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted/30 text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {t('settings.tabs.mcpServers')}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {activeView === 'marketplace' ? (
                    <div className="h-full overflow-auto p-4">
                        <MCPMarketplaceStudio />
                    </div>
                ) : (
                    <MCPServersTab />
                )}
            </div>
        </div>
    );
};
