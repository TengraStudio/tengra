/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertTriangle, IconChevronDown, IconChevronUp, IconGitCompare, IconInfoCircle, IconX } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { useWorkspaceDiagnostics } from '@/store/diagnostics.store';
import { CodeAnnotation, WorkspaceDiagnosticsStatus, WorkspaceIssue } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface TerminalWorkspaceIssuesTabProps {
    workspacePath?: string;
    workspaceId?: string;
    activeFilePath?: string;
    activeFileContent?: string;
    activeFileType?: 'code' | 'image' | 'diff';
    onOpenFile?: (path: string, line?: number) => void;
}

const WORKSPACE_ISSUES_REFRESH_INTERVAL_MS = 60_000;
const WORKSPACE_ISSUES_REQUEST_TIMEOUT_MS = 15_000;
const WORKSPACE_ISSUES_INITIAL_DELAY_MS = 100;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
            reject(new Error('WORKSPACE_ISSUES_REQUEST_TIMEOUT'));
        }, timeoutMs);
        void promise.then(
            value => {
                window.clearTimeout(timeoutId);
                resolve(value);
            },
            error => {
                window.clearTimeout(timeoutId);
                reject(error);
            }
        );
    });
}

function dedupeWorkspaceIssues(issues: WorkspaceIssue[]): WorkspaceIssue[] {
    const seen = new Set<string>();
    const merged: WorkspaceIssue[] = [];
    for (const issue of issues) {
        const key = [
            issue.file,
            issue.line,
            issue.column ?? 0,
            issue.severity,
            issue.source ?? '',
            issue.code ?? '',
            issue.message,
        ].join('|');
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        merged.push(issue);
    }
    return merged;
}

function resolveIssuePath(workspacePath: string, file: string): string {
    if (/^[A-Za-z]:[\\/]/.test(file) || file.startsWith('\\\\')) {
        return file;
    }
    const separator = workspacePath.includes('\\') ? '\\' : '/';
    return `${workspacePath}${workspacePath.endsWith(separator) ? '' : separator}${file}`;
}

type ProblemSeverity = 'error' | 'warning' | 'info';

interface WorkspaceProblemLike {
    file?: string;
    path?: string;
    message?: string;
    text?: string;
    source?: string;
    code?: string | number;
    line?: number;
    column?: number;
    severity?: ProblemSeverity | string;
    type?: string;
}

interface ProblemGroup {
    filePath: string;
    fileName: string;
    directory: string;
    entries: WorkspaceProblemLike[];
}

function getProblemFilePath(problem: WorkspaceProblemLike): string {
    return problem.file ?? problem.path ?? 'Unknown';
}

function getProblemMessage(problem: WorkspaceProblemLike): string {
    return problem.message ?? problem.text ?? 'Unknown problem';
}

function getProblemSource(problem: WorkspaceProblemLike): string {
    const source = problem.source ?? problem.type ?? 'workspace';
    const code = problem.code;
    return code === undefined || code === null || code === ''
        ? source
        : `${source}(${code})`;
}

function getProblemSeverity(problem: WorkspaceProblemLike): ProblemSeverity {
    const raw = String(problem.severity ?? problem.type ?? '').toLowerCase();

    if (raw.includes('error')) {
        return 'error';
    }

    if (raw.includes('warn')) {
        return 'warning';
    }

    return 'info';
}

function groupProblemsByFile(
    problems: WorkspaceProblemLike[],
    rootPath?: string
): ProblemGroup[] {
    const groups = new Map<string, WorkspaceProblemLike[]>();

    for (const problem of problems) {
        const filePath = getProblemFilePath(problem);
        const entries = groups.get(filePath) ?? [];
        entries.push(problem);
        groups.set(filePath, entries);
    }

    return Array.from(groups.entries())
        .map(([filePath, entries]) => {
            const normalized = filePath.replace(/\\/g, '/');
            const fileName = normalized.split('/').at(-1) ?? normalized;

            const normalizedRoot = rootPath?.replace(/\\/g, '/');

            const relative = normalizedRoot && normalized.toLowerCase().startsWith(normalizedRoot.toLowerCase())
                ? normalized.slice(normalizedRoot.length).replace(/^[/\\]+/, '')
                : normalized;

            const directory = relative.includes('/')
                ? relative.split('/').slice(0, -1).join('\\')
                : '';


            return {
                filePath,
                fileName,
                directory,

                entries: entries.sort((left, right) => {
                    const leftLine = Number(left.line ?? 0);
                    const rightLine = Number(right.line ?? 0);
                    if (leftLine !== rightLine) {
                        return leftLine - rightLine;
                    }

                    return Number(left.column ?? 0) - Number(right.column ?? 0);
                }),
            };
        })
        .sort((left, right) => left.filePath.localeCompare(right.filePath));
}

function normalizeFilePathForCompare(value: string): string {
    return value.replace(/\\/g, '/').toLowerCase();
}

function fileUriToPath(uri: string): string {
    const withoutScheme = decodeURIComponent(uri.replace(/^file:\/\/\//, ''));
    if (/^[A-Za-z]:\//.test(withoutScheme)) {
        return withoutScheme.replace(/\//g, '\\');
    }
    return withoutScheme;
}

function toWorkspaceRelativePath(filePath: string, workspacePath?: string): string {
    if (!workspacePath) {
        return filePath;
    }

    const normalizedFile = filePath.replace(/\\/g, '/');
    const normalizedRoot = workspacePath.replace(/\\/g, '/');

    if (normalizedFile.toLowerCase().startsWith(normalizedRoot.toLowerCase())) {
        return normalizedFile.slice(normalizedRoot.length).replace(/^[/\\]+/, '');
    }

    return filePath;
}

export function TerminalWorkspaceIssuesTab({
    workspacePath,
    workspaceId,
    activeFilePath,
    activeFileContent,
    activeFileType,
    onOpenFile,
}: TerminalWorkspaceIssuesTabProps) {
    const [analysis, setAnalysis] = useState<{
        issues: WorkspaceIssue[];
        lspDiagnostics: WorkspaceIssue[];
        diagnosticsStatus?: WorkspaceDiagnosticsStatus;
    }>({ issues: [], lspDiagnostics: [], diagnosticsStatus: undefined });
    const [isLoading, setIsLoading] = useState(false);
    const [activeCursor, setActiveCursor] = useState<{ filePath: string; line: number } | null>(null);
    const requestIdRef = useRef(0);

    const loadIssues = useCallback(async () => {
        if (!workspacePath) {
            setAnalysis({ issues: [], lspDiagnostics: [], diagnosticsStatus: undefined });
            return;
        }

        const requestId = ++requestIdRef.current;
        setIsLoading(true);
        try {
            const activeFileEligible = Boolean(
                activeFileType === 'code'
                && typeof activeFilePath === 'string'
                && activeFilePath.length > 0
                && typeof activeFileContent === 'string'
            );

            const [workspaceResults, activeFileDiagnostics] = await Promise.allSettled([
                withTimeout(
                    window.electron.workspace.analyze(workspacePath, workspaceId ?? workspacePath),
                    WORKSPACE_ISSUES_REQUEST_TIMEOUT_MS
                ),
                activeFileEligible
                    ? withTimeout(
                        window.electron.workspace.getFileDiagnostics(
                            workspacePath,
                            activeFilePath as string,
                            activeFileContent as string
                        ),
                        WORKSPACE_ISSUES_REQUEST_TIMEOUT_MS
                    )
                    : Promise.resolve([] as WorkspaceIssue[]),
            ]);

            if (requestId !== requestIdRef.current) {
                return;
            }

            const workspaceAnalysis = workspaceResults.status === 'fulfilled'
                ? workspaceResults.value
                : null;
            const activeDiagnostics = activeFileDiagnostics.status === 'fulfilled'
                ? activeFileDiagnostics.value
                : [];

            if (!workspaceAnalysis && activeDiagnostics.length === 0) {
                throw new Error('WORKSPACE_ISSUES_ANALYSIS_UNAVAILABLE');
            }

            const workspaceDiagnostics = workspaceAnalysis?.lspDiagnostics ?? [];
            const mergedDiagnostics = dedupeWorkspaceIssues([
                ...workspaceDiagnostics,
                ...activeDiagnostics,
            ]);

            setAnalysis({
                issues: workspaceAnalysis?.issues ?? [],
                lspDiagnostics: mergedDiagnostics,
                diagnosticsStatus: workspaceAnalysis?.diagnosticsStatus,

            });
        } catch (error) {
            if (requestId !== requestIdRef.current) {
                return;
            }
            appLogger.error(
                'TerminalWorkspaceIssuesTab',
                `Failed to analyze workspace issues for ${workspacePath}`,
                error as Error
            );
        } finally {
            if (requestId === requestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [workspaceId, workspacePath, activeFilePath, activeFileContent, activeFileType]);

    // Defer the expensive workspace.analyze() call so LSP store diagnostics
    // (which arrive in seconds) render immediately without waiting for the
    // full analysis pipeline (ESLint + TSC, which can take minutes).
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadIssues();
        }, WORKSPACE_ISSUES_INITIAL_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [loadIssues]);

    // The LSP service registers diagnostics keyed by workspace PATH
    // (lspService.startServer uses rootPath as the workspaceId), but
    // the component receives a database UUID as workspaceId. Query the
    // store with the path so the lookup actually matches.
    const workspaceDiagnostics = useWorkspaceDiagnostics(workspacePath);

    const lspIssues = useMemo(() => {
        if (!workspaceDiagnostics) {
            return [];
        }

        const issues: WorkspaceIssue[] = [];

        for (const [uri, fileDiag] of workspaceDiagnostics.entries()) {
            const absolutePath = fileUriToPath(uri);
            const relativePath = toWorkspaceRelativePath(absolutePath, workspacePath);

            for (const diagnostic of fileDiag.diagnostics) {
                issues.push({
                    severity: diagnostic.severity === 1 ? 'error' : 'warning',
                    message: diagnostic.message,
                    file: relativePath,
                    line: (diagnostic.range?.start?.line ?? 0) + 1,
                    column: (diagnostic.range?.start?.character ?? 0) + 1,
                    source: diagnostic.source || 'lsp',
                    code: diagnostic.code as string,
                });
            }
        }

        return issues;
    }, [workspaceDiagnostics, workspacePath]);

    useEffect(() => {
        if (!workspacePath) {
            return;
        }
        const timer = window.setInterval(() => void loadIssues(), WORKSPACE_ISSUES_REFRESH_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [loadIssues, workspacePath]);

    useEffect(() => {
        if (!activeFilePath) {
            return;
        }

        setActiveCursor({
            filePath: toWorkspaceRelativePath(activeFilePath, workspacePath),
            line: 1,
        });
    }, [activeFilePath, workspacePath]);
 
    const visibleIssues = useMemo(
        () => dedupeWorkspaceIssues([
            ...analysis.issues,
            ...analysis.lspDiagnostics,
            ...lspIssues,
        ]),
        [analysis.issues, analysis.lspDiagnostics, lspIssues]
    );

    const problemGroups = useMemo(() => {
        const groups = groupProblemsByFile(visibleIssues, workspacePath);

        if (!activeCursor?.filePath) {
            return groups;
        }

        const activeNormalized = normalizeFilePathForCompare(activeCursor.filePath);

        return [...groups].sort((left, right) => {
            const leftActive = normalizeFilePathForCompare(left.filePath).endsWith(activeNormalized)
                || normalizeFilePathForCompare(left.filePath) === activeNormalized;
            const rightActive = normalizeFilePathForCompare(right.filePath).endsWith(activeNormalized)
                || normalizeFilePathForCompare(right.filePath) === activeNormalized;

            if (leftActive && !rightActive) {
                return -1;
            }

            if (!leftActive && rightActive) {
                return 1;
            }

            return left.filePath.localeCompare(right.filePath);
        });
    }, [visibleIssues, workspacePath, activeCursor]);

    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Sync expanded groups when new file groups appear so they start expanded.
    // Without this, groups loaded asynchronously were never added to the set
    // and appeared permanently collapsed ("only 1 issue category" bug).
    useEffect(() => {
        if (problemGroups.length === 0) {
            return;
        }
        setExpandedGroups(prev => {
            const incoming = new Set(problemGroups.map(g => g.filePath));
            const hasNew = problemGroups.some(g => !prev.has(g.filePath));
            if (!hasNew) {
                return prev;
            }
            // Merge: keep existing expanded state, add any new groups as expanded
            const merged = new Set(prev);
            for (const path of incoming) {
                merged.add(path);
            }
            return merged;
        });
    }, [problemGroups]);

    return (
        <div className="h-full flex flex-col bg-background/40">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {problemGroups.length === 0 ? (
                    <>
                    </>
                ) : (
                    <div className="min-w-full">
                        {problemGroups.map(group => {



                            return (
                                <div key={group.filePath} className={`w-full transition-all duration-200 ease-in-out`}>
                                    <button
                                        type="button"
                                        className={cn("flex h-9 w-full items-center gap-2 px-3 text-left hover:bg-foreground/20 transition-colors duration-200 ease-in-out")}
                                        onClick={() => {
                                            setExpandedGroups(prev => {
                                                const newExpandedGroups = new Set(prev);
                                                if (newExpandedGroups.has(group.filePath)) {
                                                    newExpandedGroups.delete(group.filePath);
                                                } else {
                                                    newExpandedGroups.add(group.filePath);
                                                }
                                                return newExpandedGroups;
                                            });
                                        }}

                                    >
                                        <span>
                                            {expandedGroups.has(group.filePath) ? (
                                                <IconChevronUp className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </span>
                                        <span className="truncate font-medium">
                                            {group.fileName}
                                        </span>
                                        {group.directory && (
                                            <span className="truncate text-muted-foreground">
                                                {group.directory}
                                            </span>
                                        )}
                                        <span className="ml-auto rounded-full bg-foreground/20 px-2 py-0.5 text-xs text-foreground">
                                            {group.entries.length}
                                        </span>
                                    </button>

                                    <div className={`overflow-hidden transition-all duration-200 ease-in-out ${expandedGroups.has(group.filePath) ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                        {group.entries.map((problem, index) => {
                                            const severity = getProblemSeverity(problem);
                                            const line = problem.line ?? 1;
                                            const column = problem.column ?? 1;

                                            const problemFile = getProblemFilePath(problem);
                                            const isHighlighted =
                                                activeCursor &&
                                                normalizeFilePathForCompare(problemFile).endsWith(normalizeFilePathForCompare(activeCursor.filePath)) &&
                                                line === activeCursor.line;

                                             return (
                                                <div
                                                    key={`${group.filePath}:${line}:${column}:${index}`}
                                                    className={cn("grid min-h-8 w-full grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 px-4 pr-3 text-left hover:bg-foreground/10 cursor-pointer group", isHighlighted && "bg-primary/15 rounded-md ring-1 ring-primary/40")}
                                                    onClick={() => {
                                                        const targetPath = workspacePath
                                                            ? resolveIssuePath(workspacePath, group.filePath)
                                                            : group.filePath;

                                                        onOpenFile?.(targetPath, line);
                                                    }}
                                                    ref={element => {
                                                        if (isHighlighted && element) {
                                                            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                                        }
                                                    }}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            const targetPath = workspacePath
                                                                ? resolveIssuePath(workspacePath, group.filePath)
                                                                : group.filePath;
                                                            onOpenFile?.(targetPath, line);
                                                        }
                                                    }}
                                                >

                                                    <span
                                                        className={
                                                            severity === 'error'
                                                                ? 'text-destructive'
                                                                : severity === 'warning'
                                                                    ? 'text-warning'
                                                                    : 'text-info'
                                                        }
                                                    >
                                                        {severity === 'error' ? <IconX className="h-4 w-4" /> : severity === 'warning' ? <IconAlertTriangle className="h-4 w-4" /> : <IconInfoCircle className="h-4 w-4" />}
                                                    </span>

                                                    <span className="truncate">
                                                        {getProblemMessage(problem)}
                                                    </span>

                                                    <div className="flex items-center gap-2 pr-2">
                                                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                                                            {getProblemSource(problem)}{' '}
                                                            <span className="ml-1">
                                                                [Ln {line}, Col {column}]
                                                            </span>
                                                        </span>
                                                        
                                                        <button
                                                            type="button"
                                                            className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-primary/20 hover:text-primary text-muted-foreground transition-all duration-200"
                                                            title="View Diff"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const targetPath = workspacePath
                                                                    ? resolveIssuePath(workspacePath, group.filePath)
                                                                    : group.filePath;
                                                                
                                                                const navEvent = new CustomEvent('tengra:workspace-navigate', {
                                                                    detail: {
                                                                        type: 'open_diff',
                                                                        path: targetPath,
                                                                        diffId: undefined 
                                                                    }
                                                                });
                                                                window.dispatchEvent(navEvent);
                                                            }}
                                                        >
                                                            <IconGitCompare className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
