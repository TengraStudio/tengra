/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { motion } from '@/lib/framer-motion-compat';

import {
    TERMINAL_MANAGER_MODULE_VERSION,
    TERMINAL_WORKSPACE_ISSUES_TAB_ID,
} from '../constants/terminal-panel-constants';
import { useTerminalPanelBehavior } from '../hooks/useTerminalPanelBehavior';
import { useTerminalPanelCore } from '../hooks/useTerminalPanelCore';
import { useTerminalPanelEffects } from '../hooks/useTerminalPanelEffects';

import type { TerminalPanelProps } from './TerminalPanel';
import { TerminalPanelOverlaysConnector } from './TerminalPanelOverlaysConnector';
import { TerminalPanelToolbarConnector } from './TerminalPanelToolbarConnector';
import { TerminalSplitView } from './TerminalSplitView';
import { TerminalWorkspaceIssuesTab } from './TerminalWorkspaceIssuesTab';

/**
 * Terminal panel content orchestrator.
 * Delegates state management to useTerminalPanelCore,
 * side-effects to useTerminalPanelEffects,
 * and tab interactions / derived state to useTerminalPanelBehavior.
 */
 
export function TerminalPanelContentImpl(props: TerminalPanelProps) {
    const core = useTerminalPanelCore(props);
    const behavior = useTerminalPanelBehavior(core);
    useTerminalPanelEffects(core);

    return (
        <motion.div
            className="flex flex-col h-full w-full overflow-hidden border border-border/60"
            style={behavior.terminalChromeStyle}
            data-terminal-module="terminal-manager"
            data-terminal-module-version={TERMINAL_MANAGER_MODULE_VERSION}
        >
            <TerminalPanelToolbarConnector
                t={core.t}
                displayTabs={core.displayTabs}
                activeTabId={core.activeTabId}
                draggingTabId={core.draggingTabId}
                dragOverTabId={core.dragOverTabId}
                handleTabSelect={behavior.handleTabSelect}
                closeTab={core.tabActions.closeTab}
                handleTabDragStart={behavior.handleTabDragStart}
                handleTabDragOver={behavior.handleTabDragOver}
                handleTabDrop={behavior.handleTabDrop}
                resetTabDragState={behavior.resetTabDragState}
                isNewTerminalMenuOpen={core.isNewTerminalMenuOpen}
                setIsNewTerminalMenuOpen={core.setIsNewTerminalMenuOpen}
                isLoadingLaunchOptions={behavior.isLoadingLaunchOptions}
                availableShells={core.backends.availableShells}
                selectableBackends={behavior.selectableBackends}
                integratedBackend={behavior.integratedBackend}
                launchableExternalBackends={behavior.launchableExternalBackends}
                defaultBackendName={behavior.defaultBackendName}
                resolvedDefaultBackendId={behavior.resolvedDefaultBackendId}
                persistPreferredBackendId={core.backends.persistPreferredBackendId}
                createTerminal={core.tabActions.createTerminal}
                resolvePreferredShellId={core.tabActions.resolvePreferredShellId}
                isLoadingRemoteConnections={core.backends.isLoadingRemoteConnections}
                remoteSshProfiles={core.backends.remoteSshProfiles}
                remoteDockerContainers={core.backends.remoteDockerContainers}
                hasRemoteConnections={behavior.hasRemoteConnections}
                createRemoteTerminal={core.tabActions.createRemoteTerminal}
                isSplitPresetMenuOpen={core.splitLayout.isSplitPresetMenuOpen}
                setIsSplitPresetMenuOpen={core.splitLayout.setIsSplitPresetMenuOpen}
                splitView={core.splitLayout.splitView}
                splitPresetOptions={behavior.splitPresetOptions}
                splitAnalytics={core.splitLayout.splitAnalytics}
                isSynchronizedInputEnabled={core.splitLayout.isSynchronizedInputEnabled}
                saveCurrentSplitAsPreset={core.splitActions.saveCurrentSplitAsPreset}
                applySplitPreset={core.splitActions.applySplitPreset}
                renameSplitPreset={core.splitActions.renameSplitPreset}
                deleteSplitPreset={core.splitActions.deleteSplitPreset}
                setSplitAnalytics={core.splitLayout.setSplitAnalytics}
                toggleSynchronizedInput={core.splitActions.toggleSynchronizedInput}
                toggleSplitOrientation={core.splitActions.toggleSplitOrientation}
                closeSplitView={core.splitActions.closeSplitView}
                isGalleryView={core.isGalleryView}
                toggleGalleryView={core.panelToggles.toggleGalleryView}
                toggleSemanticPanel={core.panelToggles.toggleSemanticPanel}
                hasActiveSession={core.hasActiveSession}
                activeSemanticIssuesLength={behavior.activeSemanticIssues.length}
                activeSemanticErrorCount={behavior.activeSemanticErrorCount} 
                toggleRecording={core.recording.toggleRecording}
                activeRecordingTabId={core.recording.activeRecordingTabId}
                isMaximized={core.isMaximized}
                setIsMaximized={core.setIsMaximized}
                onToggle={core.onToggle}
                isAppearanceMenuOpen={core.isAppearanceMenuOpen}
                setIsAppearanceMenuOpen={core.setIsAppearanceMenuOpen}
                terminalAppearance={core.terminalAppearance}
                resolvedTerminalAppearance={core.preferences.resolvedTerminalAppearance}
                applyAppearancePatch={core.preferences.applyAppearancePatch}
                exportAppearancePreferences={core.preferences.exportAppearancePreferences}
                importAppearancePreferences={core.preferences.importAppearancePreferences}
                appearanceImportInputRef={core.appearanceImportInputRef}
                shortcutPreset={core.shortcuts.shortcutPreset}
                applyShortcutPreset={core.preferences.applyShortcutPreset}
                exportShortcutPreferences={core.preferences.exportShortcutPreferences}
                importShortcutPreferences={core.preferences.importShortcutPreferences}
                shortcutImportInputRef={core.shortcutImportInputRef}
                shareShortcutPreferences={core.preferences.shareShortcutPreferences}
                importShortcutShareCode={core.preferences.importShortcutShareCode}
            />
            <TerminalSplitView
                onContextMenu={core.panelToggles.openTerminalContextMenu}
                isGalleryView={core.isGalleryView}
                tabs={core.displayTabs}
                activeTabId={core.activeTabId}
                splitView={core.splitLayout.splitView}
                getTabLayoutClass={behavior.getTabLayoutClass}
                handlePaneActivate={behavior.handlePaneActivate}
                closeTab={core.tabActions.closeTab}
                handleTabSelect={behavior.handleTabSelect}
                setIsGalleryView={core.setIsGalleryView}
                workspacePath={core.workspacePath}
                terminalAppearance={core.terminalAppearance}
                resolvedTerminalAppearance={core.preferences.resolvedTerminalAppearance}
                setTerminalInstance={core.setTerminalInstance}
                emptyTitle={core.t('terminal.noActiveSessions')}
                emptyActionLabel={core.t('terminal.startNewSession')}
                createDefaultTerminal={core.tabActions.createDefaultTerminal}
                renderTabContent={tab =>
                    tab.id === TERMINAL_WORKSPACE_ISSUES_TAB_ID ? (
                        <TerminalWorkspaceIssuesTab
                            workspaceId={core.workspaceId}
                            workspacePath={core.workspacePath}
                            onOpenFile={core.onOpenFile}
                        />
                    ) : null
                }
            />
            <TerminalPanelOverlaysConnector
                t={core.t}
                terminalContextMenu={core.terminalContextMenu}
                displayTabs={core.displayTabs}
                isGalleryView={core.isGalleryView}
                hasActiveSession={core.hasActiveSession}
                workspacePath={core.workspacePath}
                splitView={core.splitLayout.splitView}
                isSynchronizedInputEnabled={core.splitLayout.isSynchronizedInputEnabled}
                activeRecordingTabId={core.recording.activeRecordingTabId}
                activeRecordingLabel={behavior.activeRecordingLabel}
                pasteHistory={core.pasteHistory}
                isSemanticPanelOpen={core.isSemanticPanelOpen}
                activeSemanticIssues={behavior.activeSemanticIssues}
                activeSemanticErrorCount={behavior.activeSemanticErrorCount}
                activeSemanticWarningCount={behavior.activeSemanticWarningCount}
                clearActiveSemanticIssues={core.panelToggles.clearActiveSemanticIssues}
                revealSemanticIssue={core.searchActions.revealSemanticIssue}
                isAiPanelOpen={core.isAiPanelOpen}
                aiPanelMode={core.ai.aiPanelMode}
                aiSelectedIssue={core.ai.aiSelectedIssue}
                aiIsLoading={core.ai.aiIsLoading}
                aiResult={core.ai.aiResult}
                closeAiPanel={core.aiActions.closeAiPanel}
                handleAiApplyFix={core.aiActions.handleAiApplyFix}
                handleAiExplainError={core.aiActions.handleAiExplainError}
                handleAiFixError={core.aiActions.handleAiFixError}
                handleCopySelection={() => core.clipboard.handleCopySelection()}
                handleCopyWithFormatting={() => core.clipboard.handleCopyWithFormatting()}
                handleCopyStripAnsi={() => core.clipboard.handleCopyStripAnsi()}
                handlePasteClipboard={() => core.clipboard.handlePasteClipboard()}
                handleTestPaste={() => core.clipboard.handleTestPaste()}
                handleSelectAll={core.clipboard.handleSelectAll}
                handleClearOutput={core.clipboard.handleClearOutput}
                handlePasteFromHistory={(entry: string) => core.clipboard.handlePasteFromHistory(entry)}
                openTerminalSearch={core.searchActions.openTerminalSearch}
                toggleSemanticPanel={core.panelToggles.toggleSemanticPanel}
                toggleGalleryView={core.panelToggles.toggleGalleryView}
                openCommandHistory={core.commandTools.openCommandHistory}
                openTaskRunner={core.commandTools.openTaskRunner} 
                toggleRecording={core.recording.toggleRecording}
                createDefaultTerminal={core.tabActions.createDefaultTerminal}
                hideTerminalPanel={core.panelToggles.hideTerminalPanel}
                handleSplitTerminal={core.splitActions.handleSplitTerminal}
                handleDetachTerminal={core.splitActions.handleDetachTerminal}
                toggleSynchronizedInput={core.splitActions.toggleSynchronizedInput}
                closeSplitView={core.splitActions.closeSplitView}
                toggleSplitOrientation={core.splitActions.toggleSplitOrientation}
                setTerminalContextMenu={core.setTerminalContextMenu}
                setIsSearchOpen={core.setIsSearchOpen}
                setIsGalleryView={core.setIsGalleryView}
                setIsSemanticPanelOpen={core.setIsSemanticPanelOpen}
                setIsCommandHistoryOpen={core.commandTools.setIsCommandHistoryOpen}
                setIsTaskRunnerOpen={core.commandTools.setIsTaskRunnerOpen} 
                setIsRecordingPanelOpen={core.setIsRecordingPanelOpen}
                isRecordingPanelOpen={core.isRecordingPanelOpen}
                recordings={core.recording.recordings}
                selectedRecordingId={core.recording.selectedRecordingId}
                selectedRecording={core.recording.selectedRecording}
                selectedRecordingText={behavior.selectedRecordingText}
                replayText={core.recording.replayText}
                isReplayRunning={core.recording.isReplayRunning}
                toggleRecordingForPanel={core.recording.toggleRecording}
                startReplay={core.recording.startReplay}
                stopReplay={core.recording.stopReplay}
                exportRecording={core.recording.exportRecording}
                setSelectedRecordingId={core.recording.setSelectedRecordingId}
                setReplayText={core.recording.setReplayText}
                isSearchOpen={core.isSearchOpen}
                searchInputRef={core.search.searchInputRef}
                searchQuery={core.search.searchQuery}
                searchUseRegex={core.search.searchUseRegex}
                searchStatus={core.search.searchStatus}
                searchMatches={core.search.searchMatches}
                searchActiveMatchIndex={core.search.searchActiveMatchIndex}
                searchHistory={core.search.searchHistory}
                setSearchQuery={core.search.setSearchQuery}
                setSearchUseRegex={core.search.setSearchUseRegex}
                setSearchStatus={core.search.setSearchStatus}
                setSearchMatches={core.search.setSearchMatches}
                setSearchActiveMatchIndex={core.search.setSearchActiveMatchIndex}
                setSearchHistoryIndex={core.search.setSearchHistoryIndex}
                resetActiveSearchCursor={core.searchActions.resetActiveSearchCursor}
                runTerminalSearch={core.searchActions.runTerminalSearch}
                closeTerminalSearch={core.searchActions.closeTerminalSearch}
                stepSearchHistory={core.searchActions.stepSearchHistory}
                jumpToSearchMatch={core.searchActions.jumpToSearchMatch}
                getSearchMatchLabel={core.searchActions.getSearchMatchLabel}
                isCommandHistoryOpen={core.commandTools.isCommandHistoryOpen}
                isCommandHistoryLoading={core.commandTools.isCommandHistoryLoading}
                commandHistoryQuery={core.commandTools.commandHistoryQuery}
                commandHistoryItems={core.commandTools.commandHistoryItems}
                setCommandHistoryQuery={core.commandTools.setCommandHistoryQuery}
                closeCommandHistory={core.commandTools.closeCommandHistory}
                clearCommandHistory={core.commandTools.clearCommandHistory}
                executeHistoryCommand={core.commandTools.executeHistoryCommand}
                isTaskRunnerOpen={core.commandTools.isTaskRunnerOpen}
                isTaskRunnerLoading={core.commandTools.isTaskRunnerLoading}
                taskRunnerQuery={core.commandTools.taskRunnerQuery}
                taskRunnerItems={core.commandTools.taskRunnerItems}
                setTaskRunnerQuery={core.commandTools.setTaskRunnerQuery}
                closeTaskRunner={core.commandTools.closeTaskRunner}
                executeTaskRunnerEntry={core.commandTools.executeTaskRunnerEntry}
            />
        </motion.div>
    );
}
