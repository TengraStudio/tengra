import { sanitizeMcpSettingsView } from '@renderer/features/settings/utils/mcp-settings-validation';
import {
    recordMcpSettingsFailure,
    recordMcpSettingsSuccess,
    setMcpSettingsUiState,
    useMcpSettingsHealth,
} from '@renderer/store/mcp-settings-health.store';
import { lazy, Suspense, useEffect, useMemo } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

const MCPServersTab = lazy(async () => import('./MCPServersTab').then(module => ({ default: module.MCPServersTab })));

export const MCPSettingsTab = () => {
    const { t } = useTranslation();
    const healthSummary = useMcpSettingsHealth(snapshot => snapshot);

    useEffect(() => {
        const startedAt = performance.now();
        setMcpSettingsUiState('loading');
        try {
            sanitizeMcpSettingsView('servers');
            recordMcpSettingsSuccess(performance.now() - startedAt);
            setMcpSettingsUiState('ready');
        } catch {
            recordMcpSettingsFailure('MCP_SETTINGS_VIEW_PERSIST_FAILED', performance.now() - startedAt);
            setMcpSettingsUiState('failure');
        }
    }, []);

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
                    <MCPServersTab />
                </Suspense>
            </div>
        </div>
    );
};

