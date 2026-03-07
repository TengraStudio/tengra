import { Activity } from 'lucide-react';
import React from 'react';

import { SidebarStatusIndicator, StatusType } from '@/components/layout/sidebar-components/SidebarStatusIndicator';
import { Language, useTranslation } from '@/i18n';
import { useWorkspacesPageHealthStore } from '@/store/projects-page-health.store';

interface ProjectsPageHealthIndicatorProps {
    language: Language;
}

/**
 * Displays the health status of the projects page operations (workspace mounts, etc.).
 * Listens to the projectsPageHealthStore and provides visual feedback.
 */
export const ProjectsPageHealthIndicator: React.FC<ProjectsPageHealthIndicatorProps> = ({ language }) => {
    const { t } = useTranslation(language);
    const health = useWorkspacesPageHealthStore(state => state);

    const status: StatusType = health.status === 'healthy' ? 'online' : 'warning';

    // Detailed info for tooltip
    const lastErrorCode = health.metrics.lastErrorCode;
    const failures = health.metrics.totalFailures;

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/20 border border-border/40 transition-all hover:bg-muted/30 group relative cursor-default">
            <SidebarStatusIndicator status={status} size="sm" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                {health.status === 'healthy' ? t('common.healthy') : t('common.degraded')}
            </span>

            {/* Tooltip */}
            <div className="absolute top-full right-0 mt-2 p-3 bg-popover border border-border rounded-xl shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 min-w-[200px] border-t-primary/30">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/40">
                    <Activity className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('projects.systemHealth')}</span>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground">{t('projects.healthStatus')}:</span>
                        <span className={health.status === 'healthy' ? 'text-success font-bold' : 'text-warning font-bold'}>
                            {health.status === 'healthy' ? t('common.healthy') : t('common.degraded')}
                        </span>
                    </div>

                    {failures > 0 && (
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="text-muted-foreground">{t('projects.totalFailures')}:</span>
                            <span className="text-destructive font-mono font-bold">{failures}</span>
                        </div>
                    )}

                    {lastErrorCode && (
                        <div className="pt-2 border-t border-border/20">
                            <div className="text-[9px] text-muted-foreground mb-1 uppercase tracking-tighter">Last Error Code:</div>
                            <div className="text-[10px] font-mono p-1.5 rounded bg-black/20 text-destructive border border-destructive/20 break-all">
                                {lastErrorCode}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
