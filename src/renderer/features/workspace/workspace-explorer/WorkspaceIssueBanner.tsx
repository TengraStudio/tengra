import React from 'react';

import { useTranslation } from '@/i18n';
import { Workspace } from '@/types';

import {
    executeWorkspaceRunbook,
    LocalizedText,
    WorkspaceRunbook,
    WorkspaceStartupPreflightResult,
} from '../utils/workspace-startup-preflight';

const ISSUE_SEVERITY_OPTIONS = ['all', 'error', 'warning', 'info'] as const;
const ISSUE_SOURCE_OPTIONS = [
    'all',
    'mount',
    'git',
    'task',
    'analysis',
    'terminal',
    'policy',
    'security',
    'toolchain',
] as const;

type IssueSeverityFilter = (typeof ISSUE_SEVERITY_OPTIONS)[number];
type IssueSourceFilter = (typeof ISSUE_SOURCE_OPTIONS)[number];

function isIssueSeverityFilter(value: string): value is IssueSeverityFilter {
    return ISSUE_SEVERITY_OPTIONS.some(option => option === value);
}

function isIssueSourceFilter(value: string): value is IssueSourceFilter {
    return ISSUE_SOURCE_OPTIONS.some(option => option === value);
}

interface WorkspaceIssueBannerProps {
    preflightResult: WorkspaceStartupPreflightResult;
    preflightWorkspace: Workspace;
    preflightWorkspaceTitle: string;
    severityFilter: IssueSeverityFilter;
    setSeverityFilter: (value: IssueSeverityFilter) => void;
    sourceFilter: IssueSourceFilter;
    setSourceFilter: (value: IssueSourceFilter) => void;
    activeRunbookId: string | null;
    setActiveRunbookId: (id: string | null) => void;
    runbookTimeline: LocalizedText[];
    setRunbookTimeline: (timeline: LocalizedText[]) => void;
    runbookOutput: string;
    setRunbookOutput: (output: string) => void;
}

export const WorkspaceIssueBanner: React.FC<WorkspaceIssueBannerProps> = ({
    preflightResult, preflightWorkspace, preflightWorkspaceTitle,
    severityFilter, setSeverityFilter, sourceFilter, setSourceFilter,
    activeRunbookId, setActiveRunbookId, runbookTimeline, setRunbookTimeline,
    runbookOutput, setRunbookOutput
}) => {
    const { t } = useTranslation();
    const getLocalizedText = React.useCallback((text: LocalizedText): string => {
        return t(text.key, text.params);
    }, [t]);

    const handleRunbook = React.useCallback(async (runbook: WorkspaceRunbook) => {
        if (!preflightWorkspace) {return;}
        const runbookLabel = getLocalizedText(runbook.label);
        setActiveRunbookId(runbook.id);
        setRunbookOutput('');
        setRunbookTimeline([{ key: 'workspace.issueBanner.preparingRunbook', params: { label: runbookLabel } }]);
        const result = await executeWorkspaceRunbook(preflightWorkspace, runbook);
        setRunbookTimeline(result.timeline);
        setRunbookOutput([
            result.success ? t('workspace.issueBanner.runbookStatus.success') : t('workspace.issueBanner.runbookStatus.failed'),
            t('workspace.issueBanner.rollbackHint', { hint: getLocalizedText(result.rollbackHint) }),
            '',
            result.output
        ].join('\n'));
        setActiveRunbookId(null);
    }, [getLocalizedText, preflightWorkspace, setActiveRunbookId, setRunbookOutput, setRunbookTimeline, t]);

    const filteredIssues = React.useMemo(() => {
        return preflightResult.issues.filter(issue => {
            const severityMatches = severityFilter === 'all' || issue.severity === severityFilter;
            const sourceMatches = sourceFilter === 'all' || issue.source === sourceFilter;
            return severityMatches && sourceMatches;
        });
    }, [preflightResult, severityFilter, sourceFilter]);

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
                    onChange={event => {
                        const nextSeverity = event.target.value;
                        if (isIssueSeverityFilter(nextSeverity)) {
                            setSeverityFilter(nextSeverity);
                        }
                    }}
                    className="px-2 py-1 rounded border border-border/50 bg-background text-xs"
                >
                    <option value="all">{t('workspace.issueBanner.filters.severity.all')}</option>
                    <option value="error">{t('workspace.issueBanner.filters.severity.error')}</option>
                    <option value="warning">{t('workspace.issueBanner.filters.severity.warning')}</option>
                    <option value="info">{t('workspace.issueBanner.filters.severity.info')}</option>
                </select>
                <select
                    value={sourceFilter}
                    onChange={event => {
                        const nextSource = event.target.value;
                        if (isIssueSourceFilter(nextSource)) {
                            setSourceFilter(nextSource);
                        }
                    }}
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
                                onClick={() => void handleRunbook(runbook)}
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
};
