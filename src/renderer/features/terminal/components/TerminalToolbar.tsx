/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { sanitizeBackendId, sanitizeShellId } from '@renderer/features/terminal/utils/terminal-toolbar-validation';
import {
    recordTerminalToolbarFailure,
    recordTerminalToolbarFallback,
    recordTerminalToolbarSuccess,
    setTerminalToolbarUiState,
} from '@renderer/store/terminal-toolbar-health.store';
import { Check, ChevronDown, Maximize2, Minimize2, Plus, TerminalSquare } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useEffect } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; 
import { UI_PRIMITIVES } from '@/constants/ui-primitives';
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
    closeTab: (id: string) => void;
    handleTabDragStart: (event: React.DragEvent<HTMLButtonElement>, tabId: string) => void;
    handleTabDragOver: (event: React.DragEvent<HTMLButtonElement>, tabId: string) => void;
    handleTabDrop: (event: React.DragEvent<HTMLButtonElement>, tabId: string) => void;
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
    resolvePreferredShellId: () => string | undefined;
    t: (key: string, options?: Record<string, string | number>) => string;
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
    toggleSemanticPanel: () => void;
    hasActiveSession: boolean;
    activeSemanticIssuesLength: number;
    activeSemanticErrorCount: number; 
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
    toggleRecording,
    activeRecordingTabId,
    isMaximized,
    setIsMaximized,
    onToggle,
    appearanceProps,
}: TerminalToolbarProps) {
    void toggleRecording;
    void activeRecordingTabId;
    void appearanceProps;

    useEffect(() => {
        setTerminalToolbarUiState('ready');
    }, []);

    return (
        <div className={cn(UI_PRIMITIVES.PANEL_SUB_HEADER, "pl-0")}>
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
                        className="w-72 max-h-screen overflow-y-auto p-1 bg-popover border border-border rounded-lg"
                    >
                        {isLoadingLaunchOptions ? (
                            <div className="px-3 py-2 typo-caption text-muted-foreground">
                                {t('common.loading')}
                            </div>
                        ) : availableShells.length > 0 ? (
                            <>
                                {selectableBackends.length > 0 && (
                                    <div className="px-2 pt-1 pb-1">
                                        <div className="text-xxxs text-muted-foreground">
                                            {t('terminal.defaultBackend')}: {defaultBackendName}
                                        </div>
                                        <div className="mt-1 space-y-0.5">
                                            {selectableBackends.map(backend => (
                                                <button
                                                    key={backend.id}
                                                    onClick={() => {
                                                        void persistPreferredBackendId(backend.id);
                                                    }}
                                                    className={cn(UI_PRIMITIVES.MENU_ITEM_BASE, "text-xxxs px-2 py-1 justify-between gap-2")}
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
                                        <div className="px-2 py-1 text-xxxs text-muted-foreground">
                                            {t('terminal.integratedSessions')}
                                        </div>
                                        {availableShells.map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => {
                                                        const shellId = sanitizeShellId(s.id);
                                                        const backendId = sanitizeBackendId(integratedBackend.id);
                                                        if (!shellId || !backendId) {
                                                            recordTerminalToolbarFailure('TERMINAL_TOOLBAR_INVALID_LAUNCH_INPUT');
                                                            return;
                                                        }
                                                        const startedAt = performance.now();
                                                        createTerminal(shellId, backendId);
                                                        recordTerminalToolbarSuccess(performance.now() - startedAt);
                                                    }}
                                                    className={UI_PRIMITIVES.MENU_ITEM_BASE}
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
                                        <div className="px-2 py-1 text-xxxs text-muted-foreground">
                                            {t('terminal.externalTerminals')}
                                        </div>
                                        {launchableExternalBackends.map(backend => (
                                            <button
                                                key={backend.id}
                                                onClick={() => {
                                                    const shellId = resolvePreferredShellId();
                                                    if (shellId) {
                                                        const startedAt = performance.now();
                                                        createTerminal(shellId, backend.id);
                                                        recordTerminalToolbarSuccess(performance.now() - startedAt);
                                                        return;
                                                    }
                                                    recordTerminalToolbarFallback();
                                                }}
                                                className={cn(UI_PRIMITIVES.MENU_ITEM_BASE, "justify-between")}
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
                                <div className="px-2 py-1 text-xxxs text-muted-foreground">
                                    {t('terminal.select_connection')}
                                </div>
                                {isLoadingRemoteConnections && (
                                    <div className="px-3 py-2 typo-caption text-muted-foreground">
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
                                            className={cn(UI_PRIMITIVES.MENU_ITEM_BASE, "justify-between")}
                                            title={`${profile.username}@${profile.host}:${profile.port}`}
                                        >
                                            <span className="truncate">{t('terminal.sshPrefix')}: {profile.name}</span>
                                            <span className="text-xxxs text-muted-foreground">
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
                                            className={cn(UI_PRIMITIVES.MENU_ITEM_BASE, "justify-between")}
                                            title={container.id}
                                        >
                                            <span className="truncate">{t('terminal.dockerPrefix')}: {container.name}</span>
                                            <span className="text-xxxs text-muted-foreground truncate max-w-24">
                                                {container.status}
                                            </span>
                                        </button>
                                    ))}
                                {!isLoadingRemoteConnections && !hasRemoteConnections && (
                                    <div className="px-3 py-2 typo-caption text-muted-foreground">
                                        {t('terminal.no_ssh_profiles')} / {t('terminal.no_containers')}
                                    </div>
                                )}
                                {selectableBackends.length === 0 && (
                                    <div className="px-3 py-2 typo-caption text-muted-foreground">
                                        {t('terminal.noBackendsAvailable')}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="px-3 py-2 typo-caption text-muted-foreground">
                                {t('terminal.noShellsFound')}
                            </div>
                        )}
                    </PopoverContent>
                </Popover>
                <div className="flex items-center gap-1">
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
