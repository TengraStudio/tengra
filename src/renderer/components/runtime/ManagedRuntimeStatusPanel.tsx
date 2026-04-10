import { RuntimeBootstrapExecutionResult, RuntimeBootstrapExecutionStatus, RuntimeHealthEntry } from '@shared/types/runtime-manifest';
import { AlertTriangle, CheckCircle2, Download, Play, RefreshCw, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { translateErrorMessage } from '@/utils/error-handler.util';

interface ManagedRuntimeStatusPanelProps {
    status: RuntimeBootstrapExecutionResult | null;
    isLoading: boolean;
    isRepairing: boolean;
    error: string | null;
    blockingOnly?: boolean;
    fullscreen?: boolean;
    onRefresh: () => void;
    onRepair: () => void;
}

interface RuntimePanelEntry {
    componentId: string;
    displayName: string;
    detail: string;
    statusLabel: string;
    statusTone: 'success' | 'warning' | 'error';
    installUrl?: string;
    canInstall: boolean;
    canStart: boolean;
}

function resolveDetail(
    errorDetail: string | undefined,
    runtimeDetail: { message?: string; messageKey?: string; messageParams?: Record<string, string | number> } | undefined,
    t: (key: string, params?: Record<string, string | number>) => string
): string {
    if (errorDetail) {
        return errorDetail;
    }

    if (runtimeDetail?.messageKey) {
        return t(runtimeDetail.messageKey, runtimeDetail.messageParams);
    }

    return runtimeDetail?.message ?? '';
}

function resolveExecutionStatusLabel(
    executionStatus: RuntimeBootstrapExecutionStatus,
    t: (key: string) => string
): string {
    if (executionStatus === 'ready' || executionStatus === 'installed') {
        return t('runtime.status.ready');
    }
    if (executionStatus === 'install-required') {
        return t('runtime.status.notConfigured');
    }
    if (executionStatus === 'failed') {
        return t('runtime.status.failed');
    }
    return t('runtime.status.notConfigured');
}

function resolveTone(
    executionStatus: RuntimeBootstrapExecutionStatus,
    healthEntry: RuntimeHealthEntry | undefined
): RuntimePanelEntry['statusTone'] {
    if (executionStatus === 'ready' || executionStatus === 'installed') {
        return 'success';
    }
    if (healthEntry?.action === 'start') {
        return 'warning';
    }
    return 'error';
}

function buildPanelEntries(
    status: RuntimeBootstrapExecutionResult | null,
    blockingOnly: boolean,
    t: (key: string) => string
): RuntimePanelEntry[] {
    if (!status) {
        return [];
    }

    return status.entries.flatMap(entry => {
        const healthEntry = status.health.entries.find(item => item.componentId === entry.componentId);
        const hasBlockingIssue =
            (entry.requirement === 'required' &&
                (entry.status === 'install-required' || entry.status === 'failed')) ||
            (healthEntry?.requirement === 'required' &&
                healthEntry.source === 'external' &&
                healthEntry.action === 'install');

        if (blockingOnly && !hasBlockingIssue) {
            return [];
        }

        const detail = resolveDetail(entry.error, healthEntry, t);
        const canInstall = healthEntry?.source === 'external' && healthEntry.action === 'install' && !!healthEntry.installUrl;
        const canStart = healthEntry?.source === 'external' && healthEntry.action === 'start';

        return [{
            componentId: entry.componentId,
            displayName: entry.displayName,
            detail,
            statusLabel: resolveExecutionStatusLabel(entry.status, t),
            statusTone: resolveTone(entry.status, healthEntry),
            installUrl: healthEntry?.installUrl,
            canInstall,
            canStart,
        }];
    });
}

export function ManagedRuntimeStatusPanel({
    status,
    isLoading,
    isRepairing,
    error,
    blockingOnly = false,
    fullscreen = false,
    onRefresh,
    onRepair,
}: ManagedRuntimeStatusPanelProps) {
    const { t } = useTranslation();
    const [startingComponentId, setStartingComponentId] = useState<string | null>(null);

    const entries = useMemo(
        () => buildPanelEntries(status, blockingOnly, t),
        [blockingOnly, status, t]
    );

    const wrapperClassName = fullscreen
        ? 'h-screen w-screen bg-background text-foreground flex items-center justify-center p-6'
        : 'rounded-xl border border-border bg-card p-6';

    const cardClassName = fullscreen
        ? 'w-full max-w-4xl rounded-2xl border border-border bg-card/95 p-6 shadow-2xl backdrop-blur'
        : '';

    const title = t('runtime.managementTitle');
    const subtitle = t('runtime.statusTitle');

    const handleOpenInstallUrl = (installUrl: string) => {
        window.electron.openExternal(installUrl);
    };

    const handleStartExternal = async (componentId: string) => {
        if (componentId !== 'ollama') {
            return;
        }

        setStartingComponentId(componentId);
        try {
            await window.electron.startOllama();
            onRefresh();
        } finally {
            setStartingComponentId(null);
        }
    };

    return (
        <div className={wrapperClassName}>
            <div className={cardClassName}>
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-primary">
                            <Wrench className="h-5 w-5" />
                            <h2 className="text-lg font-semibold">{title}</h2>
                        </div>
                        <p className="text-sm text-muted-foreground">{subtitle}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onRefresh}
                            disabled={isLoading || isRepairing}
                            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 typo-caption font-semibold text-muted-foreground transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                            {t('common.refresh')}
                        </button>
                        <button
                            onClick={onRepair}
                            disabled={isLoading || isRepairing}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 typo-caption font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Download className={`h-3.5 w-3.5 ${isRepairing ? 'animate-bounce' : ''}`} />
                            {t('runtime.repairAction')}
                        </button>
                    </div>
                </div>

                {isLoading && (
                    <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                        {t('common.loading')}
                    </div>
                )}

                {error && (
                    <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {translateErrorMessage(error)}
                    </div>
                )}

                <div className="mt-4 space-y-3">
                    {entries.map(entry => (
                        <div
                            key={entry.componentId}
                            className="rounded-xl border border-border/70 bg-muted/20 p-4"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        {entry.statusTone === 'success' && <CheckCircle2 className="h-4 w-4 text-success" />}
                                        {entry.statusTone !== 'success' && <AlertTriangle className="h-4 w-4 text-warning" />}
                                        <div className="text-sm font-semibold text-foreground">{entry.displayName}</div>
                                    </div>
                                    {entry.detail && (
                                        <div className="typo-caption text-muted-foreground">{entry.detail}</div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`rounded-full border px-2 py-1 text-xxxs font-semibold   ${
                                            entry.statusTone === 'success'
                                                ? 'border-success/30 text-success'
                                                : entry.statusTone === 'warning'
                                                    ? 'border-warning/30 text-warning'
                                                    : 'border-destructive/30 text-destructive'
                                        }`}
                                    >
                                        {entry.statusLabel}
                                    </span>
                                    {entry.canInstall && entry.installUrl && (
                                        <button
                                            onClick={() => handleOpenInstallUrl(entry.installUrl ?? '')}
                                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 typo-caption font-semibold text-muted-foreground transition hover:bg-muted/40"
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                            {t('runtime.installAction')}
                                        </button>
                                    )}
                                    {entry.canStart && (
                                        <button
                                            onClick={() => {
                                                void handleStartExternal(entry.componentId);
                                            }}
                                            disabled={startingComponentId === entry.componentId}
                                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 typo-caption font-semibold text-muted-foreground transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <Play className="h-3.5 w-3.5" />
                                            {t('runtime.startAction')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {!isLoading && entries.length === 0 && (
                        <div className="rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
                            {t('runtime.status.ready')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
