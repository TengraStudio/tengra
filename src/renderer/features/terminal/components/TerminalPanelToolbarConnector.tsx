import React from 'react';

import { TerminalTab } from '@/types';

import {
    TERMINAL_THEME_PRESETS,
    TERMINAL_FONT_PRESETS,
    TERMINAL_CURSOR_STYLES,
} from '../constants/terminal-panel-constants';
import type { TerminalAppearancePreferences, ResolvedTerminalAppearance } from '../types/terminal-appearance';
import type { SplitAnalytics, SplitPreset } from '../utils/split-config';
import { DEFAULT_SPLIT_ANALYTICS } from '../utils/split-config';
import type { TerminalShortcutPresetId } from '../utils/shortcut-config';

import { TerminalToolbar } from './TerminalToolbar';

export interface TerminalPanelToolbarConnectorProps {
    t: (key: string, params?: Record<string, unknown>) => string;
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
    availableShells: { id: string; name: string }[];
    selectableBackends: { id: string; name: string; available: boolean }[];
    integratedBackend: { id: string; name: string; available: boolean } | undefined;
    launchableExternalBackends: { id: string; name: string; available: boolean }[];
    defaultBackendName: string;
    resolvedDefaultBackendId: string | undefined;
    persistPreferredBackendId: (id: string) => void;
    createTerminal: (type: string, backendId?: string) => string;
    resolvePreferredShellId: () => string | undefined;
    isLoadingRemoteConnections: boolean;
    remoteSshProfiles: { id: string; host: string; port: number; username: string }[];
    remoteDockerContainers: { id: string; name: string; status: string }[];
    hasRemoteConnections: boolean;
    createRemoteTerminal: (target: { kind: 'ssh'; profile: { id: string; host: string; port: number; username: string } } | { kind: 'docker'; container: { id: string; name: string; status: string } }) => void;
    isSplitPresetMenuOpen: boolean;
    setIsSplitPresetMenuOpen: (open: boolean) => void;
    splitView: { primaryId: string; secondaryId: string; orientation: string } | null;
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
    onFloatingChange?: (isFloating: boolean) => void;
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
            onFloatingChange={props.onFloatingChange}
            toggleFloatingMode={props.toggleFloatingMode}
            isFloating={props.isFloating}
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
                onImport: event => {
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
                onShortcutImport: event => {
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
