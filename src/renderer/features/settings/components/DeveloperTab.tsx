import { safeJsonParse } from '@shared/utils/sanitize.util';
import { RefreshCw, Terminal } from 'lucide-react';
import React from 'react';

import { getPersistedPanelLayoutSnapshot } from '@/components/layout/panel-layout-persistence';
import { setAnimationDebugEnabled, useAnimationAnalyticsStore } from '@/store/animation-analytics.store';
import { useResponsiveAnalyticsStore } from '@/store/responsive-analytics.store';
import { exportUiLayoutState } from '@/store/ui-layout.store';
import { AppSettings } from '@/types/settings';

interface DeveloperTabProps {
    settings: AppSettings | null
    setStatusMessage: (m: string) => void
    onRefreshModels: (bypassCache?: boolean) => void
    loadSettings: () => Promise<void>
    setIsLoading: (v: boolean) => void
    t: (key: string) => string
}

export const DeveloperTab: React.FC<DeveloperTabProps> = ({ settings, setStatusMessage, onRefreshModels, loadSettings, setIsLoading, t }) => {
    const animationStats = useAnimationAnalyticsStore(snapshot => snapshot);
    const responsiveStats = useResponsiveAnalyticsStore(snapshot => snapshot);

    return (
        <div className="space-y-6">
            <div className="bg-card p-6 rounded-xl border border-border">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary"><Terminal className="w-5 h-5" /></div>
                    <div><h3 className="text-lg font-bold text-foreground">{t('developer.title')}</h3><p className="text-xs text-muted-foreground">{t('developer.subtitle')}</p></div>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                        <div><div className="text-sm font-bold text-foreground">{t('developer.clearCache')}</div><div className="text-xs text-muted-foreground">{t('developer.clearCacheDesc')}</div></div>
                        <button onClick={() => { localStorage.clear(); sessionStorage.clear(); setStatusMessage(t('developer.cacheCleared')); setTimeout(() => setStatusMessage(''), 3000); }} className="px-3 py-2 rounded-lg text-xs font-bold bg-muted/30 text-muted-foreground border border-border/50">{t('developer.clearCache')}</button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                        <div><div className="text-sm font-bold text-foreground">{t('developer.refreshData')}</div><div className="text-xs text-muted-foreground">{t('developer.refreshDataDesc')}</div></div>
                        <button onClick={() => { void (async () => { try { setIsLoading(true); onRefreshModels(true); await loadSettings(); setStatusMessage(t('developer.dataRefreshed')); setTimeout(() => setStatusMessage(''), 3000); } finally { setIsLoading(false); } })(); }} className="px-3 py-2 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" /> {t('common.refresh')}</button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                        <div><div className="text-sm font-bold text-foreground">{t('developer.exportSettings')}</div><div className="text-xs text-muted-foreground">{t('developer.exportSettingsDesc')}</div></div>
                        <button onClick={() => { if (!settings) { return; } const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Tandem-settings-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url); setStatusMessage(t('developer.settingsExported')); setTimeout(() => setStatusMessage(''), 3000); }} className="px-3 py-2 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20">{t('developer.exportSettings')}</button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                        <div>
                            <div className="text-sm font-bold text-foreground">Export UI State</div>
                            <div className="text-xs text-muted-foreground">Export window/layout/sidebar state snapshot</div>
                        </div>
                        <button
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
                                a.download = `Tandem-ui-state-${new Date().toISOString().split('T')[0]}.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                                setStatusMessage('UI state exported');
                                setTimeout(() => setStatusMessage(''), 3000);
                            }}
                            className="px-3 py-2 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20"
                        >
                            Export UI State
                        </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                        <div><div className="text-sm font-bold text-foreground">{t('developer.importSettings')}</div><div className="text-xs text-muted-foreground">{t('developer.importSettingsDesc')}</div></div>
                        <label className="px-3 py-2 rounded-lg text-xs font-bold bg-muted/30 text-muted-foreground border border-border/50 cursor-pointer">{t('developer.import')}<input type="file" accept=".json" className="hidden" onChange={(e) => { void (async () => { const file = e.target.files?.[0]; if (!file) { return; } try { const imported = safeJsonParse<Record<string, unknown> | null>(await file.text(), null); if (!imported) { throw new Error('Invalid JSON'); } await window.electron.saveSettings(imported); await loadSettings(); setStatusMessage(t('developer.settingsImported')); setTimeout(() => setStatusMessage(''), 3000); } catch { window.electron.log.warn(t('developer.invalidSettingsFile')); } })(); }} /></label>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-3">
                        <div className="text-sm font-bold text-foreground">Animation Diagnostics</div>
                        <div className="text-xs text-muted-foreground">
                            Plays: {animationStats.totals.played} | Reduced motion plays: {animationStats.totals.reducedMotionPlays}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    const next = !animationStats.debugEnabled;
                                    setAnimationDebugEnabled(next);
                                    setStatusMessage(next ? 'Animation debug enabled' : 'Animation debug disabled');
                                    setTimeout(() => setStatusMessage(''), 3000);
                                }}
                                className="px-3 py-2 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20"
                            >
                                {animationStats.debugEnabled ? 'Disable Animation Debug' : 'Enable Animation Debug'}
                            </button>
                            <button
                                onClick={() => {
                                    const current = localStorage.getItem('tandem.motion.force-reduced') === 'true';
                                    localStorage.setItem('tandem.motion.force-reduced', String(!current));
                                    setStatusMessage(!current ? 'Forced reduced motion enabled' : 'Forced reduced motion disabled');
                                    setTimeout(() => setStatusMessage(''), 3000);
                                }}
                                className="px-3 py-2 rounded-lg text-xs font-bold bg-muted/30 text-muted-foreground border border-border/50"
                            >
                                Toggle Forced Reduced Motion
                            </button>
                        </div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-1">
                        <div className="text-sm font-bold text-foreground">Responsive Analytics</div>
                        <div className="text-xs text-muted-foreground">
                            Current: {responsiveStats.current} ({responsiveStats.viewport.width}x{responsiveStats.viewport.height})
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Mobile: {responsiveStats.counters.mobile} | Tablet: {responsiveStats.counters.tablet} | Desktop: {responsiveStats.counters.desktop} | Wide: {responsiveStats.counters.wide}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


