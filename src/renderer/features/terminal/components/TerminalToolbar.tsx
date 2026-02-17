import { AlertTriangle, Check, ChevronDown, LayoutGrid, Maximize2, Minimize2, Play, Plus, Rows2, Square, TerminalSquare } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { TerminalTab } from '@/types';

import type { SplitAnalytics, SplitPreset } from '../utils/split-config';

import { TerminalAppearanceModals } from './TerminalAppearanceModals';
import { TerminalSplitControls } from './TerminalSplitControls';
import { TerminalTabsBar } from './TerminalTabsBar';

interface TerminalBackendInfo {
    id: string;
    name: string;
    available: boolean;
}

interface RemoteSshProfile {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
}

interface RemoteDockerContainer {
    id: string;
    name: string;
    status: string;
    shell: string;
}

interface TerminalToolbarProps {
    tabs: TerminalTab[];
    activeTabId: string | null;
    draggingTabId: string | null;
    dragOverTabId: string | null;
    handleTabSelect: (tabId: string) => void;
    closeTab: (tabId: string) => void;
    handleTabDragStart: ComponentProps<typeof TerminalTabsBar>['onTabDragStart'];
    handleTabDragOver: ComponentProps<typeof TerminalTabsBar>['onTabDragOver'];
    handleTabDrop: ComponentProps<typeof TerminalTabsBar>['onTabDrop'];
    resetTabDragState: () => void;
    isNewTerminalMenuOpen: boolean;
    setIsNewTerminalMenuOpen: (open: boolean) => void;
    isLoadingLaunchOptions: boolean;
    availableShells: { id: string; name: string; path: string }[];
    selectableBackends: TerminalBackendInfo[];
    integratedBackend?: TerminalBackendInfo;
    launchableExternalBackends: TerminalBackendInfo[];
    defaultBackendName: string;
    resolvedDefaultBackendId: string | undefined;
    persistPreferredBackendId: (backendId: string) => Promise<void>;
    createTerminal: (shellId: string, backendId?: string) => void;
    resolvePreferredShellId: () => string | null;
    t: (key: string) => string;
    isLoadingRemoteConnections: boolean;
    remoteSshProfiles: RemoteSshProfile[];
    remoteDockerContainers: RemoteDockerContainer[];
    hasRemoteConnections: boolean;
    createRemoteTerminal: (
        options:
            | { kind: 'ssh'; profile: RemoteSshProfile }
            | { kind: 'docker'; container: RemoteDockerContainer }
    ) => void;
    isSplitPresetMenuOpen: boolean;
    setIsSplitPresetMenuOpen: (open: boolean) => void;
    splitView: {
        orientation: 'horizontal' | 'vertical';
        primaryId: string;
        secondaryId: string;
    } | null;
    splitPresetOptions: SplitPreset[];
    splitAnalytics: SplitAnalytics;
    isSynchronizedInputEnabled: boolean;
    saveCurrentSplitAsPreset: () => void;
    applySplitPreset: (preset: SplitPreset) => void;
    renameSplitPreset: (presetId: string) => void;
    deleteSplitPreset: (presetId: string) => void;
    resetSplitAnalytics: () => void;
    toggleSynchronizedInput: () => void;
    toggleSplitOrientation: () => void;
    closeSplitView: () => void;
    isGalleryView: boolean;
    toggleGalleryView: () => void;
    onFloatingChange?: (floating: boolean) => void;
    toggleFloatingMode: () => void;
    isFloating: boolean;
    toggleSemanticPanel: () => void;
    hasActiveSession: boolean;
    activeSemanticIssuesLength: number;
    activeSemanticErrorCount: number;
    openMultiplexerPanel: () => void;
    isMultiplexerOpen: boolean;
    toggleRecording: () => void;
    activeRecordingTabId: string | null;
    isMaximized: boolean;
    setIsMaximized: (maximized: boolean) => void;
    onToggle: () => void;
    appearanceProps: ComponentProps<typeof TerminalAppearanceModals>;
}

export function TerminalToolbar({
    tabs,
    activeTabId,
    draggingTabId,
    dragOverTabId,
    handleTabSelect,
    closeTab,
    handleTabDragStart,
    handleTabDragOver,
    handleTabDrop,
    resetTabDragState,
    isNewTerminalMenuOpen,
    setIsNewTerminalMenuOpen,
    isLoadingLaunchOptions,
    availableShells,
    selectableBackends,
    integratedBackend,
    launchableExternalBackends,
    defaultBackendName,
    resolvedDefaultBackendId,
    persistPreferredBackendId,
    createTerminal,
    resolvePreferredShellId,
    t,
    isLoadingRemoteConnections,
    remoteSshProfiles,
    remoteDockerContainers,
    hasRemoteConnections,
    createRemoteTerminal,
    isSplitPresetMenuOpen,
    setIsSplitPresetMenuOpen,
    splitView,
    splitPresetOptions,
    splitAnalytics,
    isSynchronizedInputEnabled,
    saveCurrentSplitAsPreset,
    applySplitPreset,
    renameSplitPreset,
    deleteSplitPreset,
    resetSplitAnalytics,
    toggleSynchronizedInput,
    toggleSplitOrientation,
    closeSplitView,
    isGalleryView,
    toggleGalleryView,
    onFloatingChange,
    toggleFloatingMode,
    isFloating,
    toggleSemanticPanel,
    hasActiveSession,
    activeSemanticIssuesLength,
    activeSemanticErrorCount,
    openMultiplexerPanel,
    isMultiplexerOpen,
    toggleRecording,
    activeRecordingTabId,
    isMaximized,
    setIsMaximized,
    onToggle,
    appearanceProps,
}: TerminalToolbarProps) {
    return (
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/70">
            <TerminalTabsBar
                tabs={tabs}
                activeTabId={activeTabId}
                draggingTabId={draggingTabId}
                dragOverTabId={dragOverTabId}
                onSelectTab={handleTabSelect}
                onCloseTab={closeTab}
                onTabDragStart={handleTabDragStart}
                onTabDragOver={handleTabDragOver}
                onTabDrop={handleTabDrop}
                onTabDragEnd={resetTabDragState}
            />
            <div className="flex items-center gap-1 border-l border-border/50 pl-1 shrink-0">
                <Popover open={isNewTerminalMenuOpen} onOpenChange={setIsNewTerminalMenuOpen}>
                    <PopoverTrigger asChild>
                        <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        side="top"
                        align="start"
                        sideOffset={8}
                        className="w-auto min-w-[220px] p-1 bg-popover border border-border rounded-lg"
                    >
                        {isLoadingLaunchOptions ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                                {t('common.loading')}
                            </div>
                        ) : availableShells.length > 0 ? (
                            <>
                                {selectableBackends.length > 0 && (
                                    <div className="px-2 pt-1 pb-1">
                                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                            {t('terminal.defaultBackend')}: {defaultBackendName}
                                        </div>
                                        <div className="mt-1 space-y-0.5">
                                            {selectableBackends.map(backend => (
                                                <button
                                                    key={backend.id}
                                                    onClick={() => {
                                                        void persistPreferredBackendId(backend.id);
                                                    }}
                                                    className="w-full px-2 py-1 text-left text-[11px] rounded-sm hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 text-foreground"
                                                >
                                                    <span className="truncate">{backend.name}</span>
                                                    {resolvedDefaultBackendId === backend.id && (
                                                        <Check className="w-3 h-3 text-primary shrink-0" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {integratedBackend && (
                                    <>
                                        <div className="h-px bg-border/70 my-1" />
                                        <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                            {t('terminal.integratedSessions')}
                                        </div>
                                        {availableShells.map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => {
                                                    createTerminal(s.id, integratedBackend.id);
                                                }}
                                                className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-accent/50 transition-colors flex items-center gap-2 text-foreground rounded-sm"
                                            >
                                                <span className="opacity-50">&gt;_</span>
                                                {s.name}
                                            </button>
                                        ))}
                                    </>
                                )}
                                {launchableExternalBackends.length > 0 && (
                                    <>
                                        <div className="h-px bg-border/70 my-1" />
                                        <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                            {t('terminal.externalTerminals')}
                                        </div>
                                        {launchableExternalBackends.map(backend => (
                                            <button
                                                key={backend.id}
                                                onClick={() => {
                                                    const shellId = resolvePreferredShellId();
                                                    if (shellId) {
                                                        createTerminal(shellId, backend.id);
                                                    }
                                                }}
                                                className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 text-foreground rounded-sm"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <TerminalSquare className="w-3 h-3 opacity-60" />
                                                    {backend.name}
                                                </span>
                                                {resolvedDefaultBackendId === backend.id && (
                                                    <Check className="w-3 h-3 text-primary shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                    </>
                                )}
                                <div className="h-px bg-border/70 my-1" />
                                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                    {t('terminal.select_connection')}
                                </div>
                                {isLoadingRemoteConnections && (
                                    <div className="px-3 py-2 text-xs text-muted-foreground">
                                        {t('common.loading')}
                                    </div>
                                )}
                                {!isLoadingRemoteConnections &&
                                    remoteSshProfiles.map(profile => (
                                        <button
                                            key={`ssh-${profile.id}`}
                                            onClick={() => {
                                                createRemoteTerminal({ kind: 'ssh', profile });
                                            }}
                                            className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 text-foreground rounded-sm"
                                            title={`${profile.username}@${profile.host}:${profile.port}`}
                                        >
                                            <span className="truncate">SSH: {profile.name}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {profile.host}
                                            </span>
                                        </button>
                                    ))}
                                {!isLoadingRemoteConnections &&
                                    remoteDockerContainers.map(container => (
                                        <button
                                            key={`docker-${container.id}`}
                                            onClick={() => {
                                                createRemoteTerminal({ kind: 'docker', container });
                                            }}
                                            className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 text-foreground rounded-sm"
                                            title={container.id}
                                        >
                                            <span className="truncate">Docker: {container.name}</span>
                                            <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                                                {container.status}
                                            </span>
                                        </button>
                                    ))}
                                {!isLoadingRemoteConnections && !hasRemoteConnections && (
                                    <div className="px-3 py-2 text-xs text-muted-foreground">
                                        {t('terminal.no_ssh_profiles')} / {t('terminal.no_containers')}
                                    </div>
                                )}
                                {selectableBackends.length === 0 && (
                                    <div className="px-3 py-2 text-xs text-muted-foreground">
                                        {t('terminal.noBackendsAvailable')}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                                {t('terminal.noShellsFound')}
                            </div>
                        )}
                    </PopoverContent>
                </Popover>
                <div className="flex items-center gap-1">
                    <TerminalAppearanceModals {...appearanceProps} />
                    <TerminalSplitControls
                        t={t}
                        isSplitPresetMenuOpen={isSplitPresetMenuOpen}
                        setIsSplitPresetMenuOpen={setIsSplitPresetMenuOpen}
                        splitView={splitView}
                        splitPresetOptions={splitPresetOptions}
                        splitAnalytics={splitAnalytics}
                        isSynchronizedInputEnabled={isSynchronizedInputEnabled}
                        saveCurrentSplitAsPreset={saveCurrentSplitAsPreset}
                        applySplitPreset={applySplitPreset}
                        renameSplitPreset={renameSplitPreset}
                        deleteSplitPreset={deleteSplitPreset}
                        resetSplitAnalytics={resetSplitAnalytics}
                        toggleSynchronizedInput={toggleSynchronizedInput}
                        toggleSplitOrientation={toggleSplitOrientation}
                        closeSplitView={closeSplitView}
                    />
                    <button
                        onClick={toggleGalleryView}
                        disabled={tabs.length <= 1}
                        className={cn(
                            'p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                            isGalleryView && 'text-primary'
                        )}
                        title={t('terminal.galleryView')}
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    {onFloatingChange && (
                        <button
                            onClick={toggleFloatingMode}
                            className={cn(
                                'p-1.5 text-muted-foreground hover:text-foreground transition-colors',
                                isFloating && 'text-primary'
                            )}
                            title={
                                isFloating ? t('terminal.dockTerminal') : t('terminal.floatTerminal')
                            }
                        >
                            <TerminalSquare className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        onClick={toggleSemanticPanel}
                        disabled={!hasActiveSession}
                        className="relative p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={t('terminal.semanticIssues')}
                    >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {activeSemanticIssuesLength > 0 && (
                            <span
                                className={cn(
                                    'absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full text-[9px] leading-[14px] text-center font-semibold',
                                    activeSemanticErrorCount > 0
                                        ? 'bg-destructive/90 text-destructive-foreground'
                                        : 'bg-amber-500/90 text-black'
                                )}
                            >
                                {Math.min(activeSemanticIssuesLength, 99)}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={openMultiplexerPanel}
                        disabled={!hasActiveSession}
                        className={cn(
                            'p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                            isMultiplexerOpen && 'text-primary'
                        )}
                        title="Multiplexer (tmux/screen)"
                    >
                        <Rows2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={toggleRecording}
                        disabled={!hasActiveSession}
                        className={cn(
                            'relative p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                            activeRecordingTabId && 'text-destructive'
                        )}
                        title={activeRecordingTabId ? 'Stop recording' : 'Start recording'}
                    >
                        {activeRecordingTabId ? (
                            <Square className="w-3.5 h-3.5" />
                        ) : (
                            <Play className="w-3.5 h-3.5" />
                        )}
                        {activeRecordingTabId && (
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-destructive" />
                        )}
                    </button>
                    <button
                        onClick={() => {
                            setIsMaximized(!isMaximized);
                        }}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {isMaximized ? (
                            <Minimize2 className="w-3.5 h-3.5" />
                        ) : (
                            <Maximize2 className="w-3.5 h-3.5" />
                        )}
                    </button>
                    <button
                        onClick={onToggle}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
