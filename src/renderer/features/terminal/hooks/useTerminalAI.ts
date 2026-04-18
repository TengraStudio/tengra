/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useState } from 'react';

import type { ExplainErrorResult, FixErrorResult } from '../utils/terminal-ipc';
import type { TerminalSemanticIssue } from '../utils/terminal-panel-types';

/**
 * AI panel mode
 */
export type AiPanelMode = 'explain-error' | 'fix-error' | 'explain-command';

/**
 * AI result data as a discriminated union for better type narrowing
 */
export type AiResult =
    | { type: 'explain-error'; data: ExplainErrorResult }
    | { type: 'fix-error'; data: FixErrorResult }
    | { type: 'explain-command'; data: Record<string, RendererDataValue> };

/**
 * Hook for terminal AI assistant state management
 * 
 * @returns AI assistant state and control functions
 */
export function useTerminalAI() {
    const [aiPanelMode, setAiPanelMode] = useState<AiPanelMode>('explain-error');
    const [aiSelectedIssue, setAiSelectedIssue] = useState<TerminalSemanticIssue | null>(null);
    const [aiIsLoading, setAiIsLoading] = useState(false);
    const [aiResult, setAiResult] = useState<AiResult | null>(null);

    return {
        aiPanelMode,
        setAiPanelMode,
        aiSelectedIssue,
        setAiSelectedIssue,
        aiIsLoading,
        setAiIsLoading,
        aiResult,
        setAiResult,
    };
}
