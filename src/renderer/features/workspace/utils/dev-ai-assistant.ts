/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export interface ReviewRuleConfig {
    detectConsoleLog: boolean;
    detectAnyType: boolean;
    detectUnsafeEval: boolean;
}

export interface DevReviewReport {
    preCommit: string[];
    styleViolations: string[];
    securityWarnings: string[];
    performanceWarnings: string[];
    architectureSuggestions: string[];
    reviewComments: string[];
}

export interface BugDetectionReport {
    staticPatterns: string[];
    runtimeRisks: string[];
    fixSuggestions: string[];
    suggestedTests: string[];
    confidenceScore: number;
    classification: string;
    regressionSuggestions: string[];
    debugWorkflow: string[];
}

export interface PerformanceSuggestionReport {
    profilingNotes: string[];
    databaseNotes: string[];
    bundleNotes: string[];
    cachingNotes: string[];
    lazyLoadingNotes: string[];
    performanceBudgets: string[];
    buildTimeNotes: string[];
    runtimeMonitoringNotes: string[];
}

const REVIEW_RULES_STORAGE_KEY = 'workspace.dev-ai.review-rules:v1';

export function loadReviewRuleConfig(): ReviewRuleConfig {
    try {
        const raw = localStorage.getItem(REVIEW_RULES_STORAGE_KEY);
        if (!raw) {
            return {
                detectConsoleLog: true,
                detectAnyType: true,
                detectUnsafeEval: true,
            };
        }
        const parsed = JSON.parse(raw) as Partial<ReviewRuleConfig>;
        return {
            detectConsoleLog: parsed.detectConsoleLog !== false,
            detectAnyType: parsed.detectAnyType !== false,
            detectUnsafeEval: parsed.detectUnsafeEval !== false,
        };
    } catch {
        return {
            detectConsoleLog: true,
            detectAnyType: true,
            detectUnsafeEval: true,
        };
    }
}

export function saveReviewRuleConfig(config: ReviewRuleConfig): void {
    localStorage.setItem(REVIEW_RULES_STORAGE_KEY, JSON.stringify(config));
}

function findMatches(content: string, checks: Array<{ rule: RegExp; message: string }>): string[] {
    return checks
        .filter(check => check.rule.test(content))
        .map(check => check.message);
}

export async function runCodeReviewAnalysis(
    workspacePath: string | undefined,
    fileName: string,
    content: string,
    rules: ReviewRuleConfig
): Promise<DevReviewReport> {
    const styleChecks: Array<{ rule: RegExp; message: string }> = [];
    if (rules.detectConsoleLog) {
        styleChecks.push({ rule: /\bconsole\.(log|info|debug)\(/, message: 'Replace console.* with structured logger.' });
    }
    if (rules.detectAnyType) {
        styleChecks.push({ rule: /:\s*any\b|<any>/, message: 'Avoid any; use explicit interfaces or generics.' });
    }

    const securityChecks: Array<{ rule: RegExp; message: string }> = [];
    if (rules.detectUnsafeEval) {
        securityChecks.push({ rule: /\beval\s*\(/, message: 'Avoid eval(); use explicit parser/executor.' });
    }
    securityChecks.push({ rule: /\binnerHTML\s*=/, message: 'Review direct innerHTML usage for injection risk.' });
    securityChecks.push({ rule: /api[_-]?key\s*[:=]/i, message: 'Potential secret literal detected.' });

    const performanceChecks: Array<{ rule: RegExp; message: string }> = [
        { rule: /for\s*\(.*\)\s*\{[\s\S]{0,180}for\s*\(/, message: 'Nested loops detected; review complexity hotspots.' },
        { rule: /JSON\.parse\(/, message: 'Repeated JSON.parse may impact hot-path performance.' },
    ];
    if (content.length > 40_000) {
        performanceChecks.push({ rule: /.*/, message: 'Large file size may impact editor/runtime performance.' });
    }

    const architectureSuggestions: string[] = [];
    if ((content.match(/\n/g)?.length ?? 0) > 500) {
        architectureSuggestions.push('Consider extracting this file into smaller modules.');
    }
    if (/useEffect\([\s\S]{250,}\)/.test(content)) {
        architectureSuggestions.push('Large useEffect detected; split side effects by responsibility.');
    }

    const preCommit: string[] = [];
    if (workspacePath) {
        try {
            const staged = await window.electron.runCommand('git', ['diff', '--cached', '--name-only'], workspacePath);
            const stagedFiles = `${staged.stdout}\n${staged.stderr}`
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean);
            if (stagedFiles.length > 0) {
                preCommit.push(`Staged files: ${stagedFiles.slice(0, 8).join(', ')}`);
            } else {
                preCommit.push('No staged files found for pre-commit review.');
            }
        } catch {
            preCommit.push('Failed to inspect git staged files.');
        }
    }

    const styleViolations = findMatches(content, styleChecks);
    const securityWarnings = findMatches(content, securityChecks);
    const performanceWarnings = findMatches(content, performanceChecks);
    const reviewComments = [
        ...styleViolations.map(item => `[style] ${item}`),
        ...securityWarnings.map(item => `[security] ${item}`),
        ...performanceWarnings.map(item => `[performance] ${item}`),
        ...architectureSuggestions.map(item => `[architecture] ${item}`),
    ];
    if (reviewComments.length === 0) {
        reviewComments.push(`No high-priority issues detected in ${fileName}.`);
    }

    return {
        preCommit,
        styleViolations,
        securityWarnings,
        performanceWarnings,
        architectureSuggestions,
        reviewComments,
    };
}

export function runBugDetectionAnalysis(content: string): BugDetectionReport {
    const staticPatterns = findMatches(content, [
        { rule: /catch\s*\(\)\s*=>\s*\{\s*\}/, message: 'Silent catch block can hide runtime errors.' },
        { rule: /\bsetTimeout\([^,]+,\s*0\)/, message: 'Immediate timers can create timing race behavior.' },
        { rule: /\bPromise\.all\(/, message: 'Promise.all can fail-fast; verify partial failure handling.' },
    ]);
    const runtimeRisks = findMatches(content, [
        { rule: /\bJSON\.parse\(/, message: 'Untrusted JSON parse may throw at runtime.' },
        { rule: /\.\w+!\./, message: 'Non-null assertion chain may fail in edge cases.' },
    ]);
    const fixSuggestions = [
        ...staticPatterns.map(item => `Fix: ${item}`),
        ...runtimeRisks.map(item => `Guard: ${item}`),
    ];
    const suggestedTests = [
        'Add a failing-path test for rejected promises.',
        'Add edge-case test for null/undefined input.',
        'Add regression test covering error boundary flow.',
    ];
    const regressionSuggestions = [
        'Run targeted unit tests for modified module.',
        'Run integration test for the affected workflow.',
    ];
    const debugWorkflow = [
        'Reproduce with minimal input.',
        'Capture structured logs and error code.',
        'Apply fix and verify with regression tests.',
    ];
    const issueCount = staticPatterns.length + runtimeRisks.length;
    const confidenceScore = Math.max(0.2, Math.min(0.95, 0.35 + issueCount * 0.15));
    const classification = issueCount === 0 ? 'low-risk' : issueCount > 3 ? 'high-risk' : 'medium-risk';

    return {
        staticPatterns,
        runtimeRisks,
        fixSuggestions,
        suggestedTests,
        confidenceScore,
        classification,
        regressionSuggestions,
        debugWorkflow,
    };
}

export function runPerformanceSuggestionAnalysis(content: string): PerformanceSuggestionReport {
    const profilingNotes = findMatches(content, [
        { rule: /while\s*\(/, message: 'Review loops for CPU-heavy execution paths.' },
        { rule: /map\([^)]*\)\.map\(/, message: 'Chained maps may create avoidable allocations.' },
    ]);
    const databaseNotes = findMatches(content, [
        { rule: /\bSELECT\s+\*/i, message: 'Avoid SELECT * in data queries.' },
        { rule: /\bORDER\s+BY\b[\s\S]{0,80}\bLIMIT\b/i, message: 'Ensure indexes support ORDER BY/LIMIT usage.' },
    ]);
    const bundleNotes = findMatches(content, [
        { rule: /import\s+\*\s+as\s+\w+\s+from/, message: 'Prefer selective imports to reduce bundle size.' },
    ]);
    const cachingNotes = ['Cache stable expensive computations where applicable.'];
    const lazyLoadingNotes = ['Lazy-load heavy modules/components outside critical render path.'];
    const performanceBudgets = ['Target <200ms interaction latency for editor actions.'];
    const buildTimeNotes = ['Track build duration regressions and flag >10% deltas.'];
    const runtimeMonitoringNotes = ['Capture runtime telemetry for errors and long tasks.'];

    return {
        profilingNotes,
        databaseNotes,
        bundleNotes,
        cachingNotes,
        lazyLoadingNotes,
        performanceBudgets,
        buildTimeNotes,
        runtimeMonitoringNotes,
    };
}
