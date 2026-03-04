import React, { memo, useCallback, useMemo, useState } from 'react';

import { Workspace } from '@/types';

import {
    executeWorkspaceRunbook,
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
    const [runbookTimeline, setRunbookTimeline] = useState<string[]>([]);
    const [runbookOutput, setRunbookOutput] = useState('');

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
        setActiveRunbookId(runbook.id);
        setRunbookOutput('');
        setRunbookTimeline([`Preparing ${runbook.label}...`]);
        const result = await executeWorkspaceRunbook(preflightWorkspace, runbook);
        setRunbookTimeline(result.timeline);
        setRunbookOutput(
            `${result.success ? 'Success' : 'Failed'}\nRollback hint: ${result.rollbackHint}\n\n${result.output}`
        );
        setActiveRunbookId(null);
    }, [preflightWorkspace]);

    if (!preflightResult) {
        return null;
    }

    return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-3">
            <div className="text-sm font-semibold text-destructive">
                Startup checks for {preflightWorkspaceTitle || 'project'} ({preflightResult.openingMode} mode)
            </div>
            <div className="text-xs text-muted-foreground">
                Security posture: {preflightResult.securityPosture.risk} risk •
                max concurrent ops: {preflightResult.maxConcurrentOperations}
            </div>
            <div className="flex flex-wrap gap-2">
                <select
                    value={severityFilter}
                    onChange={event => setSeverityFilter(event.target.value as 'all' | 'error' | 'warning' | 'info')}
                    className="px-2 py-1 rounded border border-border/50 bg-background text-xs"
                >
                    <option value="all">All severities</option>
                    <option value="error">Errors</option>
                    <option value="warning">Warnings</option>
                    <option value="info">Info</option>
                </select>
                <select
                    value={sourceFilter}
                    onChange={event => setSourceFilter(event.target.value as 'all' | 'mount' | 'git' | 'task' | 'analysis' | 'terminal' | 'policy' | 'security' | 'toolchain')}
                    className="px-2 py-1 rounded border border-border/50 bg-background text-xs"
                >
                    <option value="all">All sources</option>
                    <option value="mount">Mount</option>
                    <option value="git">Git</option>
                    <option value="task">Task</option>
                    <option value="analysis">Analysis</option>
                    <option value="terminal">Terminal</option>
                    <option value="policy">Policy</option>
                    <option value="security">Security</option>
                    <option value="toolchain">Toolchain</option>
                </select>
            </div>
            <ul className="space-y-2 text-xs text-foreground">
                {filteredIssues.map(issue => (
                    <li key={issue.id} className="space-y-1">
                        <div>
                            {issue.severity.toUpperCase()} [{issue.source}]: {issue.message}
                        </div>
                        <div className="text-muted-foreground">
                            Fix: {issue.fixAction}
                        </div>
                    </li>
                ))}
            </ul>
            {preflightResult.runbooks.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs font-semibold">Runbooks</div>
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
                                {activeRunbookId === runbook.id ? 'Running…' : `Run ${runbook.label}`}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {runbookTimeline.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs font-semibold">Runbook timeline</div>
                    <ul className="text-xs space-y-1">
                        {runbookTimeline.map((line, index) => (
                            <li key={`${line}-${index}`}>{line}</li>
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
