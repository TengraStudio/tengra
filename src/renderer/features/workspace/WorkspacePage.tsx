import { AppSettings, ChatError } from '@shared/types';
import { CodexUsage, QuotaResponse } from '@shared/types/quota';
import { Archive, ArrowDownUp, Edit, FolderOpen, Monitor, Trash2 } from 'lucide-react';
import React, { lazy, memo, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { Language, useTranslation } from '@/i18n';
import type { GroupedModels } from '@/types';
import { Message, TerminalTab, Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

const WorkspaceDetails = lazy(() => import('@renderer/features/workspace/components/WorkspaceDetails').then(m => ({ default: m.WorkspaceDetails })));
const WorkspaceWizardModal = lazy(() => import('@renderer/features/workspace/components/WorkspaceWizardModal').then(m => ({ default: m.WorkspaceWizardModal })));

import { VirtualizedWorkspaceGrid } from './components/VirtualizedWorkspaceGrid';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import { WorkspaceModals } from './components/WorkspaceModals';
import {
    loadWorkspaceListPreferences,
    saveWorkspaceListPreferences,
    useWorkspaceListStateMachine
} from './hooks/useWorkspaceListStateMachine';
import {
    executeWorkspaceRunbook,
    runWorkspaceStartupPreflight,
    WorkspaceRunbook,
    WorkspaceStartupPreflightResult
} from './utils/workspace-startup-preflight';

interface WorkspacesPageProps {
    workspaces: Workspace[]
    selectedWorkspace?: Workspace | null
    onSelectWorkspace?: (workspace: Workspace | null) => void
    language: Language
    tabs: TerminalTab[]
    activeTabId: string | null
    setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void
    setActiveTabId: (id: string | null) => void
    selectedProvider: string
    selectedModel: string
    onSelectModel: (provider: string, model: string) => void
    groupedModels?: GroupedModels
    quotas?: { accounts: QuotaResponse[] } | null
    codexUsage?: { accounts: { usage: CodexUsage }[] } | null
    settings?: AppSettings | null
    sendMessage?: (content?: string) => void
    messages?: Message[]
    isLoading?: boolean
    chatError?: ChatError | null
}

export const WorkspacesPage: React.FC<WorkspacesPageProps> = ({
    workspaces, selectedWorkspace, onSelectWorkspace, language, tabs, activeTabId, setTabs, setActiveTabId,
    selectedProvider, selectedModel, onSelectModel, groupedModels, quotas, codexUsage, settings,
    sendMessage, messages, isLoading, chatError
}) => {
    const { t } = useTranslation(language);
    const LIST_SETTINGS_STORAGE_KEY = 'workspaces.listView.settings.v1';
    const [searchQuery, setSearchQuery] = useState('');
    const [showWizard, setShowWizard] = useState(false);
    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'title' | 'updatedAt' | 'createdAt'>('updatedAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [listPreset, setListPreset] = useState<'recent' | 'oldest' | 'name-az' | 'name-za'>('recent');
    const [preflightWorkspaceTitle, setPreflightWorkspaceTitle] = useState('');
    const [preflightWorkspace, setPreflightWorkspace] = useState<Workspace | null>(null);
    const [preflightResult, setPreflightResult] = useState<WorkspaceStartupPreflightResult | null>(null);
    const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
    const [sourceFilter, setSourceFilter] = useState<'all' | 'mount' | 'git' | 'task' | 'analysis' | 'terminal' | 'policy' | 'security' | 'toolchain'>('all');
    const [activeRunbookId, setActiveRunbookId] = useState<string | null>(null);
    const [runbookTimeline, setRunbookTimeline] = useState<string[]>([]);
    const [runbookOutput, setRunbookOutput] = useState('');

    React.useEffect(() => {
        const savedPreferences = loadWorkspaceListPreferences(LIST_SETTINGS_STORAGE_KEY, {
            viewMode: 'grid',
            sortBy: 'updatedAt',
            sortDirection: 'desc',
            listPreset: 'recent',
        });
        setViewMode(savedPreferences.viewMode);
        setSortBy(savedPreferences.sortBy);
        setSortDirection(savedPreferences.sortDirection);
        setListPreset(savedPreferences.listPreset);
    }, []);

    React.useEffect(() => {
        saveWorkspaceListPreferences(LIST_SETTINGS_STORAGE_KEY, {
            viewMode,
            sortBy,
            sortDirection,
            listPreset,
        });
    }, [viewMode, sortBy, sortDirection, listPreset]);

    const normalizedSearchQuery = React.useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);
    const workspaceSearchIndex = React.useMemo(() => {
        const index = new Map<string, string>();
        for (const workspace of workspaces) {
            index.set(
                workspace.id,
                `${workspace.title} ${workspace.description}`.toLowerCase()
            );
        }
        return index;
    }, [workspaces]);
    const sortedWorkspacesByActiveSort = React.useMemo(() => {
        const direction = sortDirection === 'asc' ? 1 : -1;
        return [...workspaces].sort((a, b) => {
            if (sortBy === 'title') {
                return a.title.localeCompare(b.title) * direction;
            }
            return (a[sortBy] - b[sortBy]) * direction;
        });
    }, [workspaces, sortBy, sortDirection]);
    const filteredWorkspaces = React.useMemo(
        () =>
            normalizedSearchQuery === ''
                ? sortedWorkspacesByActiveSort
                : sortedWorkspacesByActiveSort.filter(workspace =>
                    (workspaceSearchIndex.get(workspace.id) ?? '').includes(normalizedSearchQuery)
                ),
        [sortedWorkspacesByActiveSort, normalizedSearchQuery, workspaceSearchIndex]
    );
    const sortedWorkspaces = filteredWorkspaces;

    const toggleSort = (nextSortBy: 'title' | 'updatedAt' | 'createdAt') => {
        if (sortBy === nextSortBy) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortBy(nextSortBy);
        setSortDirection(nextSortBy === 'title' ? 'asc' : 'desc');
    };

    const applyListPreset = (preset: 'recent' | 'oldest' | 'name-az' | 'name-za') => {
        setListPreset(preset);
        switch (preset) {
            case 'oldest':
                setSortBy('updatedAt');
                setSortDirection('asc');
                break;
            case 'name-az':
                setSortBy('title');
                setSortDirection('asc');
                break;
            case 'name-za':
                setSortBy('title');
                setSortDirection('desc');
                break;
            default:
                setSortBy('updatedAt');
                setSortDirection('desc');
                break;
        }
    };

    const exportWorkspacesList = () => {
        const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
        const lines = [
            ['title', 'description', 'path', 'status', 'updatedAt', 'createdAt'].join(','),
            ...sortedWorkspaces.map(workspace => [
                escapeCsv(workspace.title),
                escapeCsv(workspace.description ?? ''),
                escapeCsv(workspace.path),
                escapeCsv(workspace.status ?? ''),
                new Date(workspace.updatedAt).toISOString(),
                new Date(workspace.createdAt).toISOString(),
            ].join(',')),
        ];

        const csv = lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `workspaces-${new Date().toISOString().slice(0, 10)}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    // Use state machine for coordinated state management
    const sm = useWorkspaceListStateMachine({
        filteredWorkspaces,
        onError: (error: unknown) => appLogger.error('WorkspacesPage', 'Operation failed', error instanceof Error ? error : new Error(String(error)))
    });

    // Adapter: Map state machine state to modal props
    const editingWorkspace = sm.state.status === 'editing' ? sm.state.targetWorkspace : null;
    const deletingWorkspace = sm.state.status === 'deleting' ? sm.state.targetWorkspace : null;
    const isArchiving = sm.state.status === 'archiving' ? sm.state.targetWorkspace : null;
    const isBulkDeleting = sm.state.status === 'bulk_deleting';
    const isBulkArchiving = sm.state.status === 'bulk_archiving';
    const bulkArchiveMode = React.useMemo(() => {
        const selectedWorkspaces = sortedWorkspaces.filter(workspace =>
            sm.state.selectedWorkspaceIds.has(workspace.id)
        );
        if (selectedWorkspaces.length === 0) {
            return 'archive' as const;
        }
        return selectedWorkspaces.every(workspace => workspace.status === 'archived')
            ? ('restore' as const)
            : ('archive' as const);
    }, [sm.state.selectedWorkspaceIds, sortedWorkspaces]);

    const handleSelectWorkspace = React.useCallback(async (workspace: Workspace) => {
        const preflight = await runWorkspaceStartupPreflight(workspace);
        setPreflightWorkspace(workspace);
        setPreflightWorkspaceTitle(workspace.title);
        setPreflightResult(preflight);
        if (!preflight.canOpen) {
            return;
        }
        setPreflightWorkspaceTitle('');
        setPreflightWorkspace(null);
        setPreflightResult(null);
        setRunbookTimeline([]);
        setRunbookOutput('');
        onSelectWorkspace?.(workspace);
    }, [onSelectWorkspace]);

    const filteredIssues = React.useMemo(() => {
        if (!preflightResult) {
            return [];
        }
        return preflightResult.issues.filter(issue => {
            const severityMatches = severityFilter === 'all' || issue.severity === severityFilter;
            const sourceMatches = sourceFilter === 'all' || issue.source === sourceFilter;
            return severityMatches && sourceMatches;
        });
    }, [preflightResult, severityFilter, sourceFilter]);

    const handleRunbook = React.useCallback(async (runbook: WorkspaceRunbook) => {
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

    if (selectedWorkspace) {
        return (
            <>
                <WorkspaceDetails
                    workspace={selectedWorkspace}
                    onBack={() => onSelectWorkspace?.(null)}
                    onDeleteWorkspace={() => sm.startDelete(selectedWorkspace)}
                    language={language}
                    tabs={tabs}
                    activeTabId={activeTabId}
                    setTabs={setTabs}
                    setActiveTabId={setActiveTabId}
                    selectedProvider={selectedProvider}
                    selectedModel={selectedModel}
                    onSelectModel={onSelectModel}
                    groupedModels={groupedModels}
                    quotas={quotas}
                    codexUsage={codexUsage ?? undefined}
                    settings={settings ?? undefined}
                    sendMessage={sendMessage}
                    messages={messages}
                    isLoading={isLoading}
                    chatError={chatError}
                />
                <WorkspaceModals
                    editingWorkspace={null}
                    setEditingWorkspace={() => { }}
                    deletingWorkspace={deletingWorkspace}
                    setDeletingWorkspace={(workspace) => workspace ? sm.startDelete(workspace) : sm.cancelDelete()}
                    isArchiving={isArchiving}
                    setIsArchiving={(workspace) => workspace ? sm.startArchive(workspace) : sm.cancelArchive()}
                    isBulkDeleting={isBulkDeleting}
                    setIsBulkDeleting={(v) => v ? sm.startBulkDelete() : sm.cancelBulkDelete()}
                    isBulkArchiving={isBulkArchiving}
                    setIsBulkArchiving={(v) => v ? sm.startBulkArchive() : sm.cancelBulkArchive()}
                    selectedCount={sm.state.selectedWorkspaceIds.size}
                    editForm={sm.state.editForm}
                    setEditForm={sm.updateEditForm}
                    handleUpdateWorkspace={sm.executeUpdate}
                    handleDeleteWorkspace={sm.executeDelete}
                    handleArchiveWorkspace={sm.executeArchive}
                    handleBulkDelete={sm.executeBulkDelete}
                    handleBulkArchive={sm.executeBulkArchive}
                    bulkArchiveMode={bulkArchiveMode}
                    t={t}
                />
            </>
        );
    }

    return (
        <div className="h-full flex flex-col bg-background p-8 overflow-y-auto">
            <div className="max-w-5xl mx-auto w-full space-y-8">

                {/* Header and Actions */}
                <WorkspaceHeader
                    title={t('sidebar.workspaces')}
                    subtitle={t('workspaces.subtitle')}
                    newWorkspaceLabel={t('workspaces.newWorkspaceButton')}
                    searchPlaceholder={t('workspaces.searchPlaceholder')}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    onNewWorkspace={() => setShowWizard(true)}
                    // Selection props
                    selectedCount={sm.state.selectedWorkspaceIds.size}
                    totalCount={sortedWorkspaces.length}
                    onToggleSelectAll={sm.toggleSelectAll}
                    onBulkDelete={sm.startBulkDelete}
                    onBulkArchive={sm.startBulkArchive}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    listPreset={listPreset}
                    onListPresetChange={(preset) =>
                        applyListPreset(preset as 'recent' | 'oldest' | 'name-az' | 'name-za')
                    }
                    onExportList={exportWorkspacesList}
                    t={t}
                    language={language}
                />

                {viewMode === 'grid' ? (
                    <div>
                        <VirtualizedWorkspaceGrid
                            workspaces={sortedWorkspaces}
                            onSelectWorkspace={(p) => {
                                void handleSelectWorkspace(p);
                            }}
                            showWorkspaceMenu={showWorkspaceMenu}
                            setShowWorkspaceMenu={setShowWorkspaceMenu}
                            workspaceStateMachine={sm}
                            t={t}
                        />
                        {sortedWorkspaces.length === 0 && (
                            <div className="py-12 text-center border-2 border-dashed border-border/30 rounded-xl">
                                <Monitor className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                                <p className="text-muted-foreground font-medium">{t('workspaces.noWorkspaces')}</p>
                                <p className="text-xs text-muted-foreground/50 mt-1">{t('workspaces.startNewWorkspace')}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="rounded-xl border border-border/40 overflow-hidden">
                        <div className="grid grid-cols-[40px_2fr_2fr_1fr_160px] gap-3 px-4 py-3 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            <div />
                            <button onClick={() => toggleSort('title')} className="flex items-center gap-1 text-left hover:text-foreground transition-colors">
                                Name <ArrowDownUp className="w-3 h-3" />
                            </button>
                            <div>Path</div>
                            <button onClick={() => toggleSort('updatedAt')} className="flex items-center gap-1 text-left hover:text-foreground transition-colors">
                                Updated <ArrowDownUp className="w-3 h-3" />
                            </button>
                            <div className="text-right">Actions</div>
                        </div>
                        <Virtuoso
                            style={{ height: 520 }}
                            data={sortedWorkspaces}
                            itemContent={(_index, workspace) => (
                                <div className="grid grid-cols-[40px_2fr_2fr_1fr_160px] gap-3 px-4 py-3 border-t border-border/20 items-center text-sm">
                                    <div>
                                        <input
                                            type="checkbox"
                                            checked={sm.state.selectedWorkspaceIds.has(workspace.id)}
                                            onChange={() => sm.toggleSelection(workspace.id)}
                                            className="w-4 h-4 rounded border-border/40 bg-muted/30 text-foreground focus:ring-foreground/20 cursor-pointer"
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            void handleSelectWorkspace(workspace);
                                        }}
                                        className="text-left min-w-0"
                                        title={workspace.description || t('workspaces.noDescription')}
                                    >
                                        <div className="font-medium truncate">{workspace.title}</div>
                                        <div className="text-xs text-muted-foreground truncate">{workspace.description || t('workspaces.noDescription')}</div>
                                    </button>
                                    <div className="text-xs text-muted-foreground truncate font-mono">{workspace.path}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {new Date(workspace.updatedAt).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => {
                                                void handleSelectWorkspace(workspace);
                                            }}
                                            className="p-2 rounded-md hover:bg-muted/30"
                                            title="Open"
                                        >
                                            <FolderOpen className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => sm.startEdit(workspace)} className="p-2 rounded-md hover:bg-muted/30" title={t('common.edit')}>
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => sm.startArchive(workspace)}
                                            className="p-2 rounded-md hover:bg-muted/30"
                                            title={
                                                workspace.status === 'archived'
                                                    ? t('common.unarchive') || 'Restore'
                                                    : t('workspaces.archiveWorkspace')
                                            }
                                        >
                                            <Archive className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => sm.startDelete(workspace)} className="p-2 rounded-md hover:bg-destructive/10 text-destructive" title={t('common.delete')}>
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        />
                        {sortedWorkspaces.length === 0 && (
                            <div className="py-12 text-center border-t border-border/20">
                                <Monitor className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                                <p className="text-muted-foreground font-medium">{t('workspaces.noWorkspaces')}</p>
                                <p className="text-xs text-muted-foreground/50 mt-1">{t('workspaces.startNewWorkspace')}</p>
                            </div>
                        )}
                    </div>
                )}
                {preflightResult && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-3">
                        <div className="text-sm font-semibold text-destructive">
                            Startup checks for {preflightWorkspaceTitle || 'workspace'} ({preflightResult.openingMode} mode)
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
                )}

                <WorkspaceModals
                    editingWorkspace={editingWorkspace}
                    setEditingWorkspace={(workspace) => workspace ? sm.startEdit(workspace) : sm.cancelEdit()}
                    deletingWorkspace={deletingWorkspace}
                    setDeletingWorkspace={(workspace) => workspace ? sm.startDelete(workspace) : sm.cancelDelete()}
                    isArchiving={isArchiving}
                    setIsArchiving={(workspace) => workspace ? sm.startArchive(workspace) : sm.cancelArchive()}
                    isBulkDeleting={isBulkDeleting}
                    setIsBulkDeleting={(v) => v ? sm.startBulkDelete() : sm.cancelBulkDelete()}
                    isBulkArchiving={isBulkArchiving}
                    setIsBulkArchiving={(v) => v ? sm.startBulkArchive() : sm.cancelBulkArchive()}
                    selectedCount={sm.state.selectedWorkspaceIds.size}
                    editForm={sm.state.editForm}
                    setEditForm={sm.updateEditForm}
                    handleUpdateWorkspace={sm.executeUpdate}
                    handleDeleteWorkspace={sm.executeDelete}
                    handleArchiveWorkspace={sm.executeArchive}
                    handleBulkDelete={sm.executeBulkDelete}
                    handleBulkArchive={sm.executeBulkArchive}
                    bulkArchiveMode={bulkArchiveMode}
                    t={t}
                />

                <WorkspaceWizardModal
                    isOpen={showWizard}
                    onClose={() => setShowWizard(false)}
                    onWorkspaceCreated={async (...args) => {
                        const success = await sm.executeCreate(...args);
                        if (success) { setShowWizard(false); }
                        return success;
                    }}
                    language={language}
                />
            </div>
        </div >
    );
};

export const MemoizedWorkspacesPage = memo(WorkspacesPage);

