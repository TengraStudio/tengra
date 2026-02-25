import { sanitizeMcpSettingsView } from '@renderer/features/settings/utils/mcp-settings-validation';
import {
    recordMcpSettingsFailure,
    recordMcpSettingsSuccess,
    setMcpSettingsUiState,
    useMcpSettingsHealth,
} from '@renderer/store/mcp-settings-health.store';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

const MCPServersTab = lazy(async () => import('./MCPServersTab').then(module => ({ default: module.MCPServersTab })));
const MCPMarketplaceStudio = lazy(async () =>
    import('../../mcp/MCPMarketplaceStudio').then(module => ({ default: module.MCPMarketplaceStudio }))
);
const MCP_SETTINGS_VIEW_STORAGE_KEY = 'tengra.settings.mcp.active-view.v1';

function persistActiveView(view: 'servers' | 'marketplace'): void {
    try {
        window.localStorage.setItem(MCP_SETTINGS_VIEW_STORAGE_KEY, view);
    } catch {
        // Ignore localStorage failures in restricted environments.
    }
}

function loadStoredActiveView(): 'servers' | 'marketplace' {
    try {
        return sanitizeMcpSettingsView(window.localStorage.getItem(MCP_SETTINGS_VIEW_STORAGE_KEY));
    } catch {
        return 'marketplace';
    }
}

export const MCPSettingsTab = () => {
    const { t } = useTranslation();
    const [activeView, setActiveView] = useState<'servers' | 'marketplace'>(() =>
        loadStoredActiveView()
    );
    const healthSummary = useMcpSettingsHealth(snapshot => snapshot);

    useEffect(() => {
        const startedAt = performance.now();
        setMcpSettingsUiState('loading');
        try {
            persistActiveView(activeView);
            recordMcpSettingsSuccess(performance.now() - startedAt);
            setMcpSettingsUiState('ready');
        } catch {
            recordMcpSettingsFailure('MCP_SETTINGS_VIEW_PERSIST_FAILED', performance.now() - startedAt);
            setMcpSettingsUiState('failure');
        }
    }, [activeView]);

    const statusTone = useMemo(() => {
        if (healthSummary.uiState === 'failure') {
            return 'text-destructive';
        }
        if (healthSummary.budgetExceededCount > 0) {
            return 'text-yellow-500';
        }
        return 'text-muted-foreground';
    }, [healthSummary.budgetExceededCount, healthSummary.uiState]);

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border/40">
                <h1 className="text-xl font-bold">{t('settings.mcp.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('settings.mcp.subtitle')}</p>
                <div className="mt-4 flex items-center gap-2">
                    <button
                        onClick={() => {
                            setActiveView('marketplace');
                        }}
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
                        onClick={() => {
                            setActiveView('servers');
                        }}
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
                <p className={cn('mt-2 text-[11px]', statusTone)}>
                    {t('settings.mcp.title')}: {healthSummary.uiState} | {t('common.loading')} avg{' '}
                    {healthSummary.avgDurationMs}ms / budget {healthSummary.budgetMs}ms
                </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                <Suspense
                    fallback={
                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                            {t('common.loading')}
                        </div>
                    }
                >
                    {activeView === 'marketplace' ? (
                        <div className="h-full overflow-auto p-4">
                            <MCPMarketplaceStudio />
                        </div>
                    ) : (
                        <MCPServersTab />
                    )}
                </Suspense>
            </div>
        </div>
    );
};

