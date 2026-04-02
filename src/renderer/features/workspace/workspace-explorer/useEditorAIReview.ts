import { useCallback, useEffect, useReducer } from 'react';

import {
    loadReviewRuleConfig,
    ReviewRuleConfig,
    runBugDetectionAnalysis,
    runCodeReviewAnalysis,
    runPerformanceSuggestionAnalysis,
    saveReviewRuleConfig,
} from '@/features/workspace/utils/dev-ai-assistant';
import { EditorTab } from '@/types';

interface AIReviewState {
    rules: ReviewRuleConfig;
    reviewSummary: string;
    bugSummary: string;
    performanceSummary: string;
}

type AIReviewAction =
    | { type: 'SET_RULES'; rules: ReviewRuleConfig }
    | { type: 'SET_REVIEW_SUMMARY'; summary: string }
    | { type: 'SET_BUG_SUMMARY'; summary: string }
    | { type: 'SET_PERFORMANCE_SUMMARY'; summary: string };

function aiReviewReducer(state: AIReviewState, action: AIReviewAction): AIReviewState {
    switch (action.type) {
        case 'SET_RULES': return { ...state, rules: action.rules };
        case 'SET_REVIEW_SUMMARY': return { ...state, reviewSummary: action.summary };
        case 'SET_BUG_SUMMARY': return { ...state, bugSummary: action.summary };
        case 'SET_PERFORMANCE_SUMMARY': return { ...state, performanceSummary: action.summary };
    }
}

const AI_REVIEW_INITIAL_STATE: AIReviewState = {
    rules: loadReviewRuleConfig(),
    reviewSummary: '',
    bugSummary: '',
    performanceSummary: '',
};

export interface UseEditorAIReviewParams {
    activeTab: EditorTab | null;
    workspacePath?: string;
}

export interface UseEditorAIReviewResult {
    reviewRules: ReviewRuleConfig;
    setReviewRules: (rules: ReviewRuleConfig) => void;
    reviewSummary: string;
    bugSummary: string;
    performanceSummary: string;
    runAiCodeReview: () => Promise<void>;
    runAiBugScan: () => void;
    runAiPerformanceScan: () => void;
}

/**
 * Hook for managing AI-powered code review, bug detection, and performance analysis.
 */
export function useEditorAIReview({
    activeTab,
    workspacePath,
}: UseEditorAIReviewParams): UseEditorAIReviewResult {
    const [state, dispatch] = useReducer(aiReviewReducer, AI_REVIEW_INITIAL_STATE);

    useEffect(() => {
        saveReviewRuleConfig(state.rules);
    }, [state.rules]);

    const setReviewRules = useCallback((rules: ReviewRuleConfig) => {
        dispatch({ type: 'SET_RULES', rules });
    }, []);

    const runAiCodeReview = useCallback(async () => {
        if (!activeTab) {
            return;
        }
        const report = await runCodeReviewAnalysis(workspacePath, activeTab.name, activeTab.content, state.rules);
        dispatch({ type: 'SET_REVIEW_SUMMARY', summary: report.reviewComments.join('\n') });
    }, [activeTab, workspacePath, state.rules]);

    const runAiBugScan = useCallback(() => {
        if (!activeTab) {
            return;
        }
        const report = runBugDetectionAnalysis(activeTab.content);
        const lines = [
            `classification: ${report.classification}`,
            `confidence: ${report.confidenceScore.toFixed(2)}`,
            ...report.fixSuggestions,
            ...report.regressionSuggestions,
        ];
        dispatch({ type: 'SET_BUG_SUMMARY', summary: lines.join('\n') });
    }, [activeTab]);

    const runAiPerformanceScan = useCallback(() => {
        if (!activeTab) {
            return;
        }
        const report = runPerformanceSuggestionAnalysis(activeTab.content);
        const lines = [
            ...report.profilingNotes,
            ...report.databaseNotes,
            ...report.bundleNotes,
            ...report.cachingNotes,
            ...report.lazyLoadingNotes,
            ...report.performanceBudgets,
            ...report.buildTimeNotes,
            ...report.runtimeMonitoringNotes,
        ];
        dispatch({ type: 'SET_PERFORMANCE_SUMMARY', summary: lines.join('\n') });
    }, [activeTab]);

    return {
        reviewRules: state.rules,
        setReviewRules,
        reviewSummary: state.reviewSummary,
        bugSummary: state.bugSummary,
        performanceSummary: state.performanceSummary,
        runAiCodeReview,
        runAiBugScan,
        runAiPerformanceScan,
    };
}
