import React, { memo, useCallback, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { Workspace } from '@/types';

import {
    executeWorkspaceRunbook,
    LocalizedText,
    WorkspaceRunbook,
    WorkspaceStartupPreflightResult
} from '../utils/workspace-startup-preflight';

interface WorkspacePreflightBannerProps {
    preflightResult: WorkspaceStartupPreflightResult | null;
    preflightWorkspaceTitle: string;
    preflightWorkspace: Workspace | null;
}

export const WorkspacePreflightBanner: React.FC<WorkspacePreflightBannerProps> = memo(({
    preflightResult,
    preflightWorkspaceTitle,
    preflightWorkspace
}) => {
    const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
    const [sourceFilter, setSourceFilter] = useState<'all' | 'mount' | 'git' | 'task' | 'analysis' | 'terminal' | 'policy' | 'security' | 'toolchain'>('all');
    const [activeRunbookId, setActiveRunbookId] = useState<string | null>(null);
    const [runbookTimeline, setRunbookTimeline] = useState<LocalizedText[]>([]);
    const [runbookOutput, setRunbookOutput] = useState('');
    const { t } = useTranslation();
    const getLocalizedText = useCallback((text: LocalizedText): string => {
        return t(text.key, text.params);
    }, [t]);

    const filteredIssues = useMemo(() => {
        if (!preflightResult) {
            return [];
        }
        return preflightResult.issues.filter(issue => {
            const severityMatches = severityFilter === 'all' || issue.severity === severityFilter;
            const sourceMatches = sourceFilter === 'all' || issue.source === sourceFilter;
            return severityMatches && sourceMatches;
        });
    }, [preflightResult, severityFilter, sourceFilter]);

    const handleRunbook = useCallback(async (runbook: WorkspaceRunbook) => {
        if (!preflightWorkspace) {
            return;
        }
        const runbookLabel = getLocalizedText(runbook.label);
        setActiveRunbookId(runbook.id);
        setRunbookOutput('');
        setRunbookTimeline([{ key: 'workspace.issueBanner.preparingRunbook', params: { label: runbookLabel } }]);
        const result = await executeWorkspaceRunbook(preflightWorkspace, runbook);
        setRunbookTimeline(result.timeline);
        setRunbookOutput(
            `${result.success ? t('workspace.issueBanner.runbookStatus.success') : t('workspace.issueBanner.runbookStatus.failed')}\n${t('workspace.issueBanner.rollbackHint', { hint: getLocalizedText(result.rollbackHint) })}\n\n${result.output}`
        );
        setActiveRunbookId(null);
    }, [getLocalizedText, preflightWorkspace, t]);

    if (!preflightResult) {
        return null;
    }

    return (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-3">
            <div className="text-sm font-semibold text-destructive">
                {t('workspace.issueBanner.startupChecks', {
                    workspace: preflightWorkspaceTitle || t('workspace.issueBanner.workspaceFallback'),
                    mode: t(`workspace.issueBanner.openingMode.${preflightResult.openingMode}`)
                })}
            </div>
            <div className="text-xs text-muted-foreground">
                {t('workspace.issueBanner.securityPosture', { risk: preflightResult.securityPosture.risk })} •
                {t('workspace.issueBanner.maxConcurrentOps', { count: preflightResult.maxConcurrentOperations })}
            </div>
            <div className="flex flex-wrap gap-2">
                <select
                    value={severityFilter}
                    onChange={event => setSeverityFilter(event.target.value as 'all' | 'error' | 'warning' | 'info')}
                    className="px-2 py-1 rounded border border-border/50 bg-background text-xs"
                >
                    <option value="all">{t('workspace.issueBanner.filters.severity.all')}</option>
                    <option value="error">{t('workspace.issueBanner.filters.severity.error')}</option>
                    <option value="warning">{t('workspace.issueBanner.filters.severity.warning')}</option>
                    <option value="info">{t('workspace.issueBanner.filters.severity.info')}</option>
                </select>
                <select
                    value={sourceFilter}
                    onChange={event => setSourceFilter(event.target.value as 'all' | 'mount' | 'git' | 'task' | 'analysis' | 'terminal' | 'policy' | 'security' | 'toolchain')}
                    className="px-2 py-1 rounded border border-border/50 bg-background text-xs"
                >
                    <option value="all">{t('workspace.issueBanner.filters.source.all')}</option>
                    <option value="mount">{t('workspace.issueBanner.filters.source.mount')}</option>
                    <option value="git">{t('workspace.issueBanner.filters.source.git')}</option>
                    <option value="task">{t('workspace.issueBanner.filters.source.task')}</option>
                    <option value="analysis">{t('workspace.issueBanner.filters.source.analysis')}</option>
                    <option value="terminal">{t('workspace.issueBanner.filters.source.terminal')}</option>
                    <option value="policy">{t('workspace.issueBanner.filters.source.policy')}</option>
                    <option value="security">{t('workspace.issueBanner.filters.source.security')}</option>
                    <option value="toolchain">{t('workspace.issueBanner.filters.source.toolchain')}</option>
                </select>
            </div>
            <ul className="space-y-2 text-xs text-foreground">
                {filteredIssues.map(issue => (
                    <li key={issue.id} className="space-y-1">
                        <div>
                            {issue.severity.toUpperCase()} [{issue.source}]: {getLocalizedText(issue.message)}
                        </div>
                        <div className="text-muted-foreground">
                            {t('workspace.issueBanner.fixPrefix')} {getLocalizedText(issue.fixAction)}
                        </div>
                    </li>
                ))}
            </ul>
            {preflightResult.runbooks.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs font-semibold">{t('workspace.issueBanner.runbooks')}</div>
                    <div className="flex flex-wrap gap-2">
                        {preflightResult.runbooks.map(runbook => (
                            <button
                                key={runbook.id}
                                onClick={() => {
                                    void handleRunbook(runbook);
                                }}
                                disabled={activeRunbookId !== null}
                                className="px-2 py-1 rounded border border-border/50 bg-background text-xs disabled:opacity-50"
                            >
                                {activeRunbookId === runbook.id
                                    ? t('workspace.issueBanner.running')
                                    : t('workspace.issueBanner.runLabel', { label: getLocalizedText(runbook.label) })}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {runbookTimeline.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs font-semibold">{t('workspace.issueBanner.runbookTimeline')}</div>
                    <ul className="text-xs space-y-1">
                        {runbookTimeline.map((line, index) => (
                            <li key={`${line.key}-${index}`}>{getLocalizedText(line)}</li>
                        ))}
                    </ul>
                </div>
            )}
            {runbookOutput && (
                <pre className="text-[11px] whitespace-pre-wrap bg-background/80 border border-border/40 rounded p-2">
                    {runbookOutput}
                </pre>
            )}
        </div>
    );
});
