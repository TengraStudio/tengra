import { useCallback, useEffect, useRef, useState } from 'react';

import type { TerminalTab } from '@/types';

/**
 * Terminal semantic issue
 */
export interface TerminalSemanticIssue {
    /** Unique issue identifier */
    id: string;
    /** Associated terminal tab ID */
    tabId: string;
    /** Issue severity level */
    severity: 'error' | 'warning';
    /** Issue message text */
    message: string;
    /** Issue detection timestamp */
    timestamp: number;
}

const TERMINAL_SEMANTIC_MAX_ISSUES_PER_TAB = 80;
const TERMINAL_SEMANTIC_DEDUPE_WINDOW_MS = 1500;
const TERMINAL_SEMANTIC_ERROR_PATTERNS = [
    /\berror\b/i,
    /\bfailed\b/i,
    /\bexception\b/i,
    /\btraceback\b/i,
    /\bpanic\b/i,
    /\bnpm ERR!/i,
    /\berr:?\b/i,
];
const TERMINAL_SEMANTIC_WARNING_PATTERNS = [
    /\bwarning\b/i,
    /\bwarn\b/i,
    /\bdeprecated\b/i,
    /\bcaution\b/i,
];
const ANSI_ESCAPE_SEQUENCE_REGEX = new RegExp(
    String.raw`\x1B(?:\[[0-?]*[ -/]*[@-~]|[@-Z\\-_]|\][^\x07]*(?:\x07|\x1B\\))`,
    'g'
);

/**
 * Strip ANSI control sequences from text
 * 
 * @param value - Text with ANSI codes
 * @returns Clean text
 */
function stripAnsiControlSequences(value: string): string {
    return value.replace(ANSI_ESCAPE_SEQUENCE_REGEX, '').replace(/\r/g, '');
}

/**
 * Detect semantic severity from terminal output line
 * 
 * @param line - Terminal output line
 * @returns Severity level or null if not an issue
 */
function detectSemanticSeverity(line: string): 'error' | 'warning' | null {
    if (TERMINAL_SEMANTIC_ERROR_PATTERNS.some(pattern => pattern.test(line))) {
        return 'error';
    }
    if (TERMINAL_SEMANTIC_WARNING_PATTERNS.some(pattern => pattern.test(line))) {
        return 'warning';
    }
    return null;
}

/**
 * Props for useTerminalSemanticAnalysis hook
 */
interface UseTerminalSemanticAnalysisProps {
    /** Current terminal tabs */
    tabs: TerminalTab[];
}

/**
 * Hook for semantic analysis of terminal output (errors, warnings)
 * 
 * @param props - Hook configuration
 * @returns Semantic analysis state and functions
 */
export function useTerminalSemanticAnalysis({ tabs }: UseTerminalSemanticAnalysisProps) {
    const [semanticIssuesByTab, setSemanticIssuesByTab] = useState<
        Record<string, TerminalSemanticIssue[]>
    >({});

    const semanticCarryByTabRef = useRef<Record<string, string>>({});
    const semanticRecentBySignatureRef = useRef<Record<string, number>>({});

    /**
     * Clean up semantic data for removed tabs
     */
    useEffect(() => {
        const validTabIds = new Set(tabs.map(tab => tab.id));
        Object.keys(semanticCarryByTabRef.current).forEach(tabId => {
            if (!validTabIds.has(tabId)) {
                delete semanticCarryByTabRef.current[tabId];
            }
        });
        Object.keys(semanticRecentBySignatureRef.current).forEach(signature => {
            const [tabId] = signature.split(':');
            if (tabId && !validTabIds.has(tabId)) {
                delete semanticRecentBySignatureRef.current[signature];
            }
        });
        // Wrap state update in setTimeout to avoid cascading render warning in effect
        setTimeout(() => {
            setSemanticIssuesByTab(prev => {
                const entries = Object.entries(prev);
                const nextEntries = entries.filter(([tabId]) => validTabIds.has(tabId));
                if (nextEntries.length === entries.length) {
                    return prev;
                }
                return Object.fromEntries(nextEntries);
            });
        }, 0);
    }, [tabs]);

    /**
     * Add a semantic issue for a tab
     * 
     * @param tabId - Terminal tab ID
     * @param severity - Issue severity
     * @param rawMessage - Raw issue message
     */
    const pushSemanticIssue = useCallback(
        (tabId: string, severity: 'error' | 'warning', rawMessage: string) => {
            const message = rawMessage.replace(/\s+/g, ' ').trim();
            if (!message || message.length < 3) {
                return;
            }

            const signature = `${tabId}:${severity}:${message.toLowerCase()}`;
            const now = Date.now();
            const lastTimestamp = semanticRecentBySignatureRef.current[signature] ?? 0;
            if (now - lastTimestamp < TERMINAL_SEMANTIC_DEDUPE_WINDOW_MS) {
                return;
            }
            semanticRecentBySignatureRef.current[signature] = now;

            const issue: TerminalSemanticIssue = {
                id: `${tabId}-${now}-${Math.random().toString(36).slice(2, 8)}`,
                tabId,
                severity,
                message,
                timestamp: now,
            };

            setSemanticIssuesByTab(prev => {
                const nextForTab = [issue, ...(prev[tabId] ?? [])].slice(
                    0,
                    TERMINAL_SEMANTIC_MAX_ISSUES_PER_TAB
                );
                return {
                    ...prev,
                    [tabId]: nextForTab,
                };
            });
        },
        []
    );

    /**
     * Parse terminal output chunk for semantic issues
     * 
     * @param tabId - Terminal tab ID
     * @param chunk - Output chunk to parse
     * @param flushRemainder - Whether to flush incomplete line
     */
    const analysisBufferByTabRef = useRef<Record<string, string>>({});
    const lastAnalysisTimeRef = useRef<number>(0);
    const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Parse terminal output chunk for semantic issues
     * 
     * @param tabId - Terminal tab ID
     * @param chunk - Output chunk to parse
     * @param flushRemainder - Whether to flush incomplete line
     */
    const parseSemanticChunk = useCallback(
        (tabId: string, chunk: string, flushRemainder = false) => {
            if (chunk) {
                analysisBufferByTabRef.current[tabId] = (analysisBufferByTabRef.current[tabId] ?? '') + chunk;
            }

            const runAnalysis = () => {
                if (analysisTimeoutRef.current) {
                    clearTimeout(analysisTimeoutRef.current);
                    analysisTimeoutRef.current = null;
                }

                Object.entries(analysisBufferByTabRef.current).forEach(([id, buffer]) => {
                    if (!buffer) { return; }

                    const stripped = stripAnsiControlSequences(buffer);
                    const carried = semanticCarryByTabRef.current[id] ?? '';
                    const combined = `${carried}${stripped}`;
                    const lines = combined.split('\n');
                    semanticCarryByTabRef.current[id] = lines.pop() ?? '';

                    for (const line of lines) {
                        const normalized = line.trim();
                        if (!normalized) { continue; }
                        const severity = detectSemanticSeverity(normalized);
                        if (severity) {
                            pushSemanticIssue(id, severity, normalized);
                        }
                    }
                    analysisBufferByTabRef.current[id] = '';
                });
                lastAnalysisTimeRef.current = Date.now();
            };

            if (flushRemainder) {
                runAnalysis();
                const remainder = semanticCarryByTabRef.current[tabId]?.trim();
                if (remainder) {
                    const severity = detectSemanticSeverity(remainder);
                    if (severity) {
                        pushSemanticIssue(tabId, severity, remainder);
                    }
                }
                semanticCarryByTabRef.current[tabId] = '';
                return;
            }

            const now = Date.now();
            if (now - lastAnalysisTimeRef.current > 200) {
                runAnalysis();
            } else if (!analysisTimeoutRef.current) {
                analysisTimeoutRef.current = setTimeout(runAnalysis, 200);
            }
        },
        [pushSemanticIssue]
    );

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (analysisTimeoutRef.current) {
                clearTimeout(analysisTimeoutRef.current);
            }
        };
    }, []);

    /**
     * Clear all semantic issues for a tab
     * 
     * @param tabId - Terminal tab ID
     */
    const clearSemanticIssues = useCallback((tabId: string) => {
        setSemanticIssuesByTab(prev => {
            if (!(tabId in prev)) {
                return prev;
            }
            const next = { ...prev };
            delete next[tabId];
            return next;
        });
        delete semanticCarryByTabRef.current[tabId];
    }, []);

    return {
        semanticIssuesByTab,
        parseSemanticChunk,
        clearSemanticIssues,
    };
}
