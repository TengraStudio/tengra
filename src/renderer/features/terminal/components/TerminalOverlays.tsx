/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Bot, Loader2, Play, X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { createPortal } from 'react-dom';

import { type AiPanelMode, type AiResult } from '../hooks/useTerminalAI';

import { TerminalCommandPanels } from './TerminalCommandPanels';
import { TerminalContextMenu } from './TerminalContextMenu'; 
import { TerminalRecordingPanel } from './TerminalRecordingPanel';
import { TerminalSearchOverlay } from './TerminalSearchOverlay';
import { TerminalSemanticPanel } from './TerminalSemanticPanel';

/* Batch-02: Extracted Long Classes */
const C_TERMINALOVERLAYS_1 = "shrink-0 px-2 py-1.5 typo-caption bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors flex items-center gap-1";


interface TerminalOverlaysProps {
    terminalContextMenu: { x: number; y: number } | null;
    canUseGallery: boolean;
    isGalleryView: boolean;
    contextMenuProps: Omit<ComponentProps<typeof TerminalContextMenu>, 'position' | 'canUseGallery' | 'isGalleryView'>;
    semanticPanelProps: ComponentProps<typeof TerminalSemanticPanel> | null;
    isAiPanelOpen: boolean;
    aiPanelMode: AiPanelMode;
    aiSelectedIssue: { severity: string; message: string } | null;
    aiIsLoading: boolean;
    aiResult: AiResult | null;
    closeAiPanel: () => void;
    t: (key: string, options?: Record<string, string | number>) => string;
    handleAiApplyFix: (command: string) => Promise<void>;
    recordingPanelProps: ComponentProps<typeof TerminalRecordingPanel> | null;
    searchOverlayProps: ComponentProps<typeof TerminalSearchOverlay> | null;
    commandPanelsProps: ComponentProps<typeof TerminalCommandPanels>;
}

export function TerminalOverlays({
    terminalContextMenu,
    canUseGallery,
    isGalleryView,
    contextMenuProps,
    semanticPanelProps,
    isAiPanelOpen,
    aiPanelMode,
    aiSelectedIssue,
    aiIsLoading,
    aiResult,
    closeAiPanel,
    t,
    handleAiApplyFix,
    recordingPanelProps,
    searchOverlayProps,
    commandPanelsProps,
}: TerminalOverlaysProps) {
    return (
        <>
            {terminalContextMenu &&
                createPortal(
                    <TerminalContextMenu
                        position={terminalContextMenu}
                        canUseGallery={canUseGallery}
                        isGalleryView={isGalleryView}
                        {...contextMenuProps}
                    />,
                    document.body
                )}
            {semanticPanelProps && <TerminalSemanticPanel {...semanticPanelProps} />}
            {isAiPanelOpen && (
                <div className="absolute top-2 right-2 z-30 rounded-md border border-border/70 bg-popover/95 backdrop-blur px-3 py-3 min-w-96 max-w-lg">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 typo-caption font-semibold">
                            <Bot className="w-4 h-4 text-primary" />
                            {aiPanelMode === 'explain-error' && t('terminal.aiExplainError')}
                            {aiPanelMode === 'fix-error' && t('terminal.aiFixError')}
                            {aiPanelMode === 'explain-command' && t('terminal.aiExplainCommand')}
                        </div>
                        <button
                            onClick={closeAiPanel}
                            className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={t('common.close')}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    {aiSelectedIssue && (
                        <div className="mb-3 p-2 rounded bg-destructive/10 border border-destructive/30">
                            <div className="text-xxxs text-destructive font-semibold mb-1">
                                {aiSelectedIssue.severity}
                            </div>
                            <div className="typo-caption text-foreground/90 line-clamp-3">
                                {aiSelectedIssue.message}
                            </div>
                        </div>
                    )}
                    {aiIsLoading ? (
                        <div className="flex items-center justify-center gap-2 py-6">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <span className="typo-caption text-muted-foreground">
                                {t('terminal.aiAnalyzing')}
                            </span>
                        </div>
                    ) : aiResult ? (
                        <div className="space-y-3">
                            {aiResult.type === 'explain-error' && (
                                <>
                                    <div>
                                        <div className="text-xxxs text-muted-foreground mb-1">
                                            {t('terminal.aiSummary')}
                                        </div>
                                        <div className="typo-caption text-foreground">
                                            {String(aiResult.data.summary ?? '')}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xxxs text-muted-foreground mb-1">
                                            {t('terminal.aiCause')}
                                        </div>
                                        <div className="typo-caption text-foreground">
                                            {String(aiResult.data.cause ?? '')}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xxxs text-muted-foreground mb-1">
                                            {t('terminal.aiSolution')}
                                        </div>
                                        <div className="typo-caption text-foreground">
                                            {String(aiResult.data.solution ?? '')}
                                        </div>
                                    </div>
                                    {Array.isArray(aiResult.data.steps) && aiResult.data.steps.length > 0 && (
                                        <div>
                                            <div className="text-xxxs text-muted-foreground mb-1">
                                                {t('terminal.aiSteps')}
                                            </div>
                                            <ol className="list-decimal list-inside typo-caption text-foreground space-y-1">
                                                {(aiResult.data.steps as string[]).map((step, idx) => (
                                                    <li key={idx}>{step}</li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}
                                </>
                            )}
                            {aiResult.type === 'fix-error' && (
                                <>
                                    {aiResult.data.suggestedCommand && (
                                        <div>
                                            <div className="text-xxxs text-muted-foreground mb-1">
                                                {t('terminal.aiSuggestedCommand')}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <code className="flex-1 typo-caption bg-muted/50 px-2 py-1.5 rounded font-mono break-all">
                                                    {String(aiResult.data.suggestedCommand)}
                                                </code>
                                                <button
                                                    onClick={() => {
                                                        void handleAiApplyFix(String(aiResult.data.suggestedCommand));
                                                    }}
                                                    className={C_TERMINALOVERLAYS_1}
                                                >
                                                    <Play className="w-3 h-3" />
                                                    {t('terminal.aiRunCommand')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ) : null}
                </div>
            )} 
            {recordingPanelProps && <TerminalRecordingPanel {...recordingPanelProps} />}
            {searchOverlayProps && <TerminalSearchOverlay {...searchOverlayProps} />}
            <TerminalCommandPanels {...commandPanelsProps} />
        </>
    );
}
