import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { JsonValue } from '@shared/types';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { Activity, Database, Download, FileUp, HardDrive, Layout, RefreshCw, Terminal, Trash2 } from 'lucide-react';
import React, { useEffect } from 'react';

import { getPersistedPanelLayoutSnapshot } from '@/components/layout/panel-layout-persistence';
import { ManagedRuntimeStatusPanel } from '@/components/runtime/ManagedRuntimeStatusPanel';
import { cn } from '@/lib/utils';
import { setAnimationDebugEnabled, useAnimationAnalyticsStore } from '@/store/animation-analytics.store';
import { useResponsiveAnalyticsStore } from '@/store/responsive-analytics.store';
import {
    loadRuntimeBootstrapStatus,
    repairManagedRuntime,
    useRuntimeBootstrapStore,
} from '@/store/runtime-bootstrap.store';
import { exportUiLayoutState } from '@/store/ui-layout.store';
import { AppSettings } from '@/types/settings';
import { isAppSettings } from '@/utils/app-settings.util';
import { appLogger } from '@/utils/renderer-logger';

import { PerformanceDashboard } from './PerformanceDashboard';

interface DeveloperTabProps {
    settings: AppSettings | null;
    setStatusMessage: (m: string) => void;
    onRefreshModels: (bypassCache?: boolean) => void;
    loadSettings: () => Promise<void>;
    setIsLoading: (v: boolean) => void;
    t: (key: string, _options?: Record<string, string | number>) => string;
}

export const DeveloperTab: React.FC<DeveloperTabProps> = ({ settings, setStatusMessage, onRefreshModels, loadSettings, setIsLoading, t }) => {
    const animationStats = useAnimationAnalyticsStore(snapshot => snapshot);
    const responsiveStats = useResponsiveAnalyticsStore(snapshot => snapshot);
    const runtimeStatus = useRuntimeBootstrapStore(snapshot => snapshot.status);
    const runtimeIsLoading = useRuntimeBootstrapStore(snapshot => snapshot.isLoading);
    const runtimeIsRepairing = useRuntimeBootstrapStore(snapshot => snapshot.isRepairing);
    const runtimeError = useRuntimeBootstrapStore(snapshot => snapshot.error);

    useEffect(() => {
        if (runtimeStatus || runtimeIsLoading) {
            return;
        }

        void loadRuntimeBootstrapStatus();
    }, [runtimeIsLoading, runtimeStatus]);

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out pb-20">
            {/* Page Header */}
            <div className="relative group px-1">
                <div className="flex items-center gap-4 mb-3">
                    <div className="p-3.5 rounded-2xl bg-primary/10 text-primary shadow-2xl shadow-primary/10 group-hover:scale-110 transition-transform duration-700 ring-1 ring-primary/20">
                        <Terminal className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-foreground leading-none">
                            {t('developer.title')}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="h-1 w-8 bg-primary rounded-full group-hover:w-12 transition-all duration-700" />
                            <p className="typo-body font-bold text-muted-foreground opacity-50">
                                {t('developer.coreSystemDiagnostics')}
                            </p>
                        </div>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-2xl font-medium px-1">
                    {t('developer.subtitle')}
                </p>
            </div>

            {/* Core Runtime Status */}
            <div className="grid grid-cols-1 gap-8">
                <ManagedRuntimeStatusPanel
                    status={runtimeStatus}
                    isLoading={runtimeIsLoading}
                    isRepairing={runtimeIsRepairing}
                    error={runtimeError}
                    onRefresh={() => {
                        void loadRuntimeBootstrapStatus(true);
                    }}
                    onRepair={() => {
                        void repairManagedRuntime();
                    }}
                />
            </div>

            {/* Diagnostics and Data Control */}
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                {/* Data Control Panel */}
                <div className="bg-card rounded-3xl border border-border/40 p-8 space-y-8 shadow-sm group/data hover:border-border/60 transition-all duration-500 overflow-hidden relative">
                    <div className="flex items-center gap-3 px-1 relative z-10">
                        <Database className="w-4 h-4 text-primary" />
                        <h4 className="typo-body font-bold text-muted-foreground/40">{t('developer.dataProtocols')}</h4>
                    </div>

                    <div className="space-y-4 relative z-10">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/5 group/row hover:bg-muted/10 border border-border/10 transition-all">
                            <div className="space-y-1">
                                <div className="typo-body font-bold text-foreground flex items-center gap-2">
                                    <Trash2 className="w-3 h-3 text-red-500/60" />
                                    {t('developer.clearCache')}
                                </div>
                                <div className="typo-body font-bold text-muted-foreground/40 max-w-[200px] leading-relaxed">
                                    {t('developer.clearCacheDesc')}
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { localStorage.clear(); sessionStorage.clear(); setStatusMessage(t('developer.cacheCleared')); setTimeout(() => setStatusMessage(''), 3000); }}
                                className="h-9 px-4 rounded-xl border-border/40 typo-body font-bold hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                            >
                                {t('developer.executeClear')}
                            </Button>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/5 group/row hover:bg-muted/10 border border-border/10 transition-all">
                            <div className="space-y-1">
                                <div className="typo-body font-bold text-foreground flex items-center gap-2">
                                    <RefreshCw className="w-3 h-3 text-primary/60" />
                                    {t('developer.refreshData')}
                                </div>
                                <div className="typo-body font-bold text-muted-foreground/40 max-w-[200px] leading-relaxed">
                                    {t('developer.refreshDataDesc')}
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { void (async () => { try { setIsLoading(true); onRefreshModels(true); await loadSettings(); setStatusMessage(t('developer.dataRefreshed')); setTimeout(() => setStatusMessage(''), 3000); } finally { setIsLoading(false); } })(); }}
                                className="h-9 px-4 rounded-xl border-primary/20 bg-primary/5 text-primary typo-body font-bold hover:bg-primary hover:text-primary-foreground transition-all"
                            >
                                {t('developer.reloadAssets')}
                            </Button>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/5 group/row hover:bg-muted/10 border border-border/10 transition-all">
                            <div className="space-y-1">
                                <div className="typo-body font-bold text-foreground flex items-center gap-2">
                                    <Download className="w-3 h-3 text-primary/60" />
                                    {t('developer.exportSchema')}
                                </div>
                                <div className="typo-body font-bold text-muted-foreground/40 max-w-[200px] leading-relaxed">
                                    {t('developer.exportSchemaDesc')}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { if (!settings) { return; } const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Tengra-settings-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url); setStatusMessage(t('developer.settingsExported')); setTimeout(() => setStatusMessage(''), 3000); }}
                                    className="h-9 w-9 p-0 rounded-xl border-border/40 flex items-center justify-center hover:bg-muted/20 text-muted-foreground transition-all"
                                    title={t('developer.exportSettings')}
                                >
                                    <HardDrive className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const payload = {
                                            exportedAt: Date.now(),
                                            window: settings?.window ?? null,
                                            uiLayout: exportUiLayoutState(),
                                            panelLayout: getPersistedPanelLayoutSnapshot(),
                                        };
                                        const blob = new Blob([JSON.stringify(payload, null, 2)], {
                                            type: 'application/json',
                                        });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `Tengra-ui-state-${new Date().toISOString().split('T')[0]}.json`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                        setStatusMessage(t('developer.uiStateExported'));
                                        setTimeout(() => setStatusMessage(''), 3000);
                                    }}
                                    className="h-9 w-9 p-0 rounded-xl border-border/40 flex items-center justify-center hover:bg-muted/20 text-muted-foreground transition-all"
                                    title={t('developer.exportUiState')}
                                >
                                    <Layout className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/5 group/row hover:bg-muted/10 border border-border/10 transition-all">
                            <div className="space-y-1">
                                <div className="typo-body font-bold text-foreground flex items-center gap-2">
                                    <FileUp className="w-3 h-3 text-primary/60" />
                                    {t('developer.importSettings')}
                                </div>
                                <div className="typo-body font-bold text-muted-foreground/40 max-w-[200px] leading-relaxed">
                                    {t('developer.restoreFromSnapshot')}
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="h-9 px-4 rounded-xl border-primary/20 bg-primary/5 text-primary typo-body font-bold hover:bg-primary hover:text-primary-foreground transition-all"
                            >
                                <label className="cursor-pointer">
                                    {t('developer.import')}
                                    <input type="file" accept=".json" className="hidden" onChange={(e) => { void (async () => { const file = e.target.files?.[0]; if (!file) { return; } try { const imported = safeJsonParse<JsonValue | null>(await file.text(), null); if (!isAppSettings(imported)) { throw new Error(t('developer.invalidSettingsFile')); } await window.electron.saveSettings(imported); await loadSettings(); setStatusMessage(t('developer.settingsImported')); setTimeout(() => setStatusMessage(''), 3000); } catch { appLogger.warn('DeveloperTab', t('developer.invalidSettingsFile')); } })(); }} />
                                </label>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Animation & UX Diagnostics */}
                <div className="bg-card rounded-3xl border border-border/40 p-8 space-y-8 shadow-sm group/ux hover:border-border/60 transition-all duration-500 overflow-hidden relative">
                    <div className="flex items-center gap-3 px-1 relative z-10">
                        <Activity className="w-4 h-4 text-primary" />
                        <h4 className="typo-body font-bold text-muted-foreground/40">{t('developer.uxDiagnostics')}</h4>
                    </div>

                    <div className="space-y-6 relative z-10">
                        <div className="p-6 rounded-[2rem] border border-border/40 bg-muted/10 shadow-inner">
                            <div className="typo-body font-bold text-foreground mb-4">{t('developer.responsiveStateMatrix')}</div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl border border-border/10 bg-background/50">
                                    <div className="typo-body font-bold text-muted-foreground/30 mb-1">{t('developer.activeViewport')}</div>
                                    <div className="text-xl font-bold text-primary leading-none">{responsiveStats.current}</div>
                                </div>
                                <div className="p-4 rounded-2xl border border-border/10 bg-background/50">
                                    <div className="typo-body font-bold text-muted-foreground/30 mb-1">{t('developer.renderResolution')}</div>
                                    <div className="text-xl font-bold text-foreground leading-none">{responsiveStats.viewport.width} <span className="typo-body opacity-20">X</span> {responsiveStats.viewport.height}</div>
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-2 px-1">
                                <Badge variant="outline" className="h-4 typo-body px-1 font-bold border-border/20 opacity-40">M:{responsiveStats.counters.mobile}</Badge>
                                <Badge variant="outline" className="h-4 typo-body px-1 font-bold border-border/20 opacity-40">T:{responsiveStats.counters.tablet}</Badge>
                                <Badge variant="outline" className="h-4 typo-body px-1 font-bold border-border/20 opacity-40">D:{responsiveStats.counters.desktop}</Badge>
                                <Badge variant="outline" className="h-4 typo-body px-1 font-bold border-border/20 opacity-40">W:{responsiveStats.counters.wide}</Badge>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <div className="space-y-0.5">
                                    <div className="typo-body font-bold text-foreground">{t('developer.motionEngineDebug')}</div>
                                    <div className="typo-body font-bold text-muted-foreground/40">{t('developer.pulsesRegistered', { count: animationStats.totals.played })}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const next = !animationStats.debugEnabled;
                                            setAnimationDebugEnabled(next);
                                            setStatusMessage(next ? t('developer.animationDebugEnabled') : t('developer.animationDebugDisabled'));
                                            setTimeout(() => setStatusMessage(''), 3000);
                                        }}
                                        className={cn(
                                            "h-9 px-4 rounded-xl border-border/40 typo-body font-bold    transition-all",
                                            animationStats.debugEnabled && "bg-primary/10 text-primary border-primary/20"
                                        )}
                                    >
                                        {animationStats.debugEnabled ? t('common.disable') : t('common.enable')}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const current = localStorage.getItem('tengra.motion.force-reduced') === 'true';
                                            localStorage.setItem('tengra.motion.force-reduced', String(!current));
                                            setStatusMessage(!current ? t('developer.forcedReducedMotionEnabled') : t('developer.forcedReducedMotionDisabled'));
                                            setTimeout(() => setStatusMessage(''), 3000);
                                        }}
                                        className="h-9 px-4 rounded-xl border-border/40 typo-body font-bold hover:bg-muted/20 transition-all"
                                    >
                                        {t('developer.forceReduced')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Dashboard */}
            <div className="bg-card rounded-3xl border border-border/40 p-8 space-y-8 shadow-sm group/performance hover:border-border/60 transition-all duration-500 overflow-hidden relative">
                <div className="flex items-center gap-3 px-1 relative z-10">
                    <Activity className="w-4 h-4 text-primary" />
                    <h4 className="typo-body font-bold text-muted-foreground/40">{t('developer.performanceOverview')}</h4>
                </div>
                <div className="relative z-10">
                    <PerformanceDashboard />
                </div>
            </div>
        </div>
    );
};



