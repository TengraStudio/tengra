import React from 'react';

import { TerminalTab } from '@/types';

import {
    TERMINAL_CURSOR_STYLES,
    TERMINAL_FONT_PRESETS,
    TERMINAL_THEME_PRESETS,
} from '../constants/terminal-panel-constants';
import type { RemoteDockerContainer, RemoteSshProfile, ShellInfo,TerminalBackendInfo } from '../hooks/useTerminalBackendsAndRemote';
import type { ResolvedTerminalAppearance,TerminalAppearancePreferences } from '../types/terminal-appearance';
import type { TerminalShortcutPresetId } from '../utils/shortcut-config';
import type { SplitAnalytics, SplitPreset } from '../utils/split-config';
import { DEFAULT_SPLIT_ANALYTICS } from '../utils/split-config';
import type { RemoteConnectionTarget } from '../utils/terminal-panel-types';

import { TerminalToolbar } from './TerminalToolbar';

export interface TerminalPanelToolbarConnectorProps {
    t: (path: string, options?: Record<string, string | number>) => string;
    displayTabs: TerminalTab[];
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
    availableShells: ShellInfo[];
    selectableBackends: TerminalBackendInfo[];
    integratedBackend: TerminalBackendInfo | undefined;
    launchableExternalBackends: TerminalBackendInfo[];
    defaultBackendName: string;
    resolvedDefaultBackendId: string | undefined;
    persistPreferredBackendId: (backendId: string) => Promise<void>;
    createTerminal: (type: string, backendId?: string) => string;
    resolvePreferredShellId: () => string | undefined;
    isLoadingRemoteConnections: boolean;
    remoteSshProfiles: RemoteSshProfile[];
    remoteDockerContainers: RemoteDockerContainer[];
    hasRemoteConnections: boolean;
    createRemoteTerminal: (target: RemoteConnectionTarget) => void;
    isSplitPresetMenuOpen: boolean;
    setIsSplitPresetMenuOpen: (open: boolean) => void;
    splitView: { orientation: 'horizontal' | 'vertical'; primaryId: string; secondaryId: string } | null;
    splitPresetOptions: SplitPreset[];
    splitAnalytics: SplitAnalytics;
    isSynchronizedInputEnabled: boolean;
    saveCurrentSplitAsPreset: () => void;
    applySplitPreset: (preset: SplitPreset) => void;
    renameSplitPreset: (id: string) => void;
    deleteSplitPreset: (id: string) => void;
    setSplitAnalytics: (fn: (prev: SplitAnalytics) => SplitAnalytics) => void;
    toggleSynchronizedInput: () => void;
    toggleSplitOrientation: () => void;
    closeSplitView: () => void;
    isGalleryView: boolean;
    toggleGalleryView: () => void;
    hasActiveSession: boolean;
    activeSemanticIssuesLength: number;
    activeSemanticErrorCount: number;
    openMultiplexerPanel: () => void;
    isMultiplexerOpen: boolean;
    toggleRecording: () => void;
    toggleSemanticPanel: () => void;
    activeRecordingTabId: string | null;
    isMaximized: boolean;
    setIsMaximized: (maximized: boolean) => void;
    onToggle: () => void;
    // Appearance props
    isAppearanceMenuOpen: boolean;
    setIsAppearanceMenuOpen: (open: boolean) => void;
    terminalAppearance: TerminalAppearancePreferences;
    resolvedTerminalAppearance: ResolvedTerminalAppearance;
    applyAppearancePatch: (patch: Partial<TerminalAppearancePreferences>) => void;
    exportAppearancePreferences: () => void;
    importAppearancePreferences: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    appearanceImportInputRef: React.MutableRefObject<HTMLInputElement | null>;
    // Shortcut props
    shortcutPreset: TerminalShortcutPresetId;
    applyShortcutPreset: (presetId: TerminalShortcutPresetId) => void;
    exportShortcutPreferences: () => void;
    importShortcutPreferences: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    shortcutImportInputRef: React.MutableRefObject<HTMLInputElement | null>;
    shareShortcutPreferences: () => Promise<void>;
    importShortcutShareCode: () => void;
}

export const TerminalPanelToolbarConnector: React.FC<TerminalPanelToolbarConnectorProps> = (props) => {
    const themeCategoryLabel = (preset: { category: string }) =>
        preset.category === 'community' ? props.t('terminal.communityTheme') : props.t('terminal.defaultTheme');

    return (
        <TerminalToolbar
            tabs={props.displayTabs}
            activeTabId={props.activeTabId}
            draggingTabId={props.draggingTabId}
            dragOverTabId={props.dragOverTabId}
            handleTabSelect={props.handleTabSelect}
            closeTab={props.closeTab}
            handleTabDragStart={props.handleTabDragStart}
            handleTabDragOver={props.handleTabDragOver}
            handleTabDrop={props.handleTabDrop}
            resetTabDragState={props.resetTabDragState}
            isNewTerminalMenuOpen={props.isNewTerminalMenuOpen}
            setIsNewTerminalMenuOpen={props.setIsNewTerminalMenuOpen}
            isLoadingLaunchOptions={props.isLoadingLaunchOptions}
            availableShells={props.availableShells}
            selectableBackends={props.selectableBackends}
            integratedBackend={props.integratedBackend}
            launchableExternalBackends={props.launchableExternalBackends}
            defaultBackendName={props.defaultBackendName}
            resolvedDefaultBackendId={props.resolvedDefaultBackendId}
            persistPreferredBackendId={props.persistPreferredBackendId}
            createTerminal={props.createTerminal}
            resolvePreferredShellId={props.resolvePreferredShellId}
            t={props.t}
            isLoadingRemoteConnections={props.isLoadingRemoteConnections}
            remoteSshProfiles={props.remoteSshProfiles}
            remoteDockerContainers={props.remoteDockerContainers}
            hasRemoteConnections={props.hasRemoteConnections}
            createRemoteTerminal={props.createRemoteTerminal}
            isSplitPresetMenuOpen={props.isSplitPresetMenuOpen}
            setIsSplitPresetMenuOpen={props.setIsSplitPresetMenuOpen}
            splitView={props.splitView}
            splitPresetOptions={props.splitPresetOptions}
            splitAnalytics={props.splitAnalytics}
            isSynchronizedInputEnabled={props.isSynchronizedInputEnabled}
            saveCurrentSplitAsPreset={props.saveCurrentSplitAsPreset}
            applySplitPreset={props.applySplitPreset}
            renameSplitPreset={props.renameSplitPreset}
            deleteSplitPreset={props.deleteSplitPreset}
            resetSplitAnalytics={() => {
                props.setSplitAnalytics(() => DEFAULT_SPLIT_ANALYTICS);
            }}
            toggleSynchronizedInput={props.toggleSynchronizedInput}
            toggleSplitOrientation={props.toggleSplitOrientation}
            closeSplitView={props.closeSplitView}
            isGalleryView={props.isGalleryView}
            toggleGalleryView={props.toggleGalleryView}
            toggleSemanticPanel={props.toggleSemanticPanel}
            hasActiveSession={props.hasActiveSession}
            activeSemanticIssuesLength={props.activeSemanticIssuesLength}
            activeSemanticErrorCount={props.activeSemanticErrorCount}
            openMultiplexerPanel={props.openMultiplexerPanel}
            isMultiplexerOpen={props.isMultiplexerOpen}
            toggleRecording={props.toggleRecording}
            activeRecordingTabId={props.activeRecordingTabId}
            isMaximized={props.isMaximized}
            setIsMaximized={props.setIsMaximized}
            onToggle={props.onToggle}
            appearanceProps={{
                inputRef: props.appearanceImportInputRef,
                onImport: (event: React.ChangeEvent<HTMLInputElement>) => {
                    void props.importAppearancePreferences(event);
                },
                isAppearanceMenuOpen: props.isAppearanceMenuOpen,
                setIsAppearanceMenuOpen: props.setIsAppearanceMenuOpen,
                title: props.t('terminal.appearance'),
                t: props.t,
                terminalAppearance: props.terminalAppearance,
                resolvedTerminalAppearance: props.resolvedTerminalAppearance,
                themePresets: TERMINAL_THEME_PRESETS,
                fontPresets: TERMINAL_FONT_PRESETS,
                cursorStyles: TERMINAL_CURSOR_STYLES,
                themeCategoryLabel,
                applyAppearancePatch: props.applyAppearancePatch,
                exportAppearancePreferences: props.exportAppearancePreferences,
                openAppearanceImportDialog: () => {
                    props.appearanceImportInputRef.current?.click();
                },
                shortcutInputRef: props.shortcutImportInputRef,
                onShortcutImport: (event: React.ChangeEvent<HTMLInputElement>) => {
                    void props.importShortcutPreferences(event);
                },
                shortcutPreset: props.shortcutPreset,
                applyShortcutPreset: props.applyShortcutPreset,
                exportShortcutPreferences: props.exportShortcutPreferences,
                openShortcutImportDialog: () => {
                    props.shortcutImportInputRef.current?.click();
                },
                shareShortcutPreferences: props.shareShortcutPreferences,
                importShortcutShareCode: props.importShortcutShareCode,
            }}
        />
    );
};
