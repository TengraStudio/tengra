import {
    loadReviewRuleConfig,
    ReviewRuleConfig,
    runBugDetectionAnalysis,
    runCodeReviewAnalysis,
    runPerformanceSuggestionAnalysis,
    saveReviewRuleConfig,
} from '@renderer/features/workspace/utils/dev-ai-assistant';
import React from 'react';

import { useTranslation } from '@/i18n';

interface UseEditorAnalysisParams {
    activeTabContent: string | undefined;
    activeTabName: string | undefined;
    workspacePath: string | undefined;
    setSnippetStatus: (status: string) => void;
    updateTabContent: (value: string) => void;
}

/**
 * Manages AI analysis state: code review, bug detection, performance scan, and semantic refactoring.
 */
export function useEditorAnalysis({
    activeTabContent,
    activeTabName,
    workspacePath,
    setSnippetStatus,
    updateTabContent,
}: UseEditorAnalysisParams) {
    const { t } = useTranslation();
    const [reviewRules, setReviewRules] = React.useState<ReviewRuleConfig>(() => loadReviewRuleConfig());
    const [reviewSummary, setReviewSummary] = React.useState('');
    const [bugSummary, setBugSummary] = React.useState('');
    const [performanceSummary, setPerformanceSummary] = React.useState('');
    const [semanticPreview, setSemanticPreview] = React.useState('');

    React.useEffect(() => {
        saveReviewRuleConfig(reviewRules);
    }, [reviewRules]);

    const runAiCodeReview = React.useCallback(async () => {
        if (activeTabContent === undefined || !activeTabName) {
            return;
        }
        const report = await runCodeReviewAnalysis(workspacePath, activeTabName, activeTabContent, reviewRules);
        setReviewSummary(report.reviewComments.join('\n'));
    }, [activeTabContent, activeTabName, workspacePath, reviewRules]);

    const runAiBugScan = React.useCallback(() => {
        if (activeTabContent === undefined) {
            return;
        }
        const report = runBugDetectionAnalysis(activeTabContent);
        const lines = [
            `classification: ${report.classification}`,
            `confidence: ${report.confidenceScore.toFixed(2)}`,
            ...report.fixSuggestions,
            ...report.regressionSuggestions,
        ];
        setBugSummary(lines.join('\n'));
    }, [activeTabContent]);

    const runAiPerformanceScan = React.useCallback(() => {
        if (activeTabContent === undefined) {
            return;
        }
        const report = runPerformanceSuggestionAnalysis(activeTabContent);
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
        setPerformanceSummary(lines.join('\n'));
    }, [activeTabContent]);

    const previewSemanticRefactor = React.useCallback(() => {
        if (activeTabContent === undefined) {
            return;
        }
        const next = activeTabContent.replace(/\bvar\b/g, 'const');
        setSemanticPreview(next.slice(0, 1200));
        setSnippetStatus(t('workspaceDashboard.editor.semanticPreviewReady'));
    }, [activeTabContent, t, setSnippetStatus]);

    const applySemanticRefactor = React.useCallback(() => {
        if (activeTabContent === undefined) {
            return;
        }
        updateTabContent(activeTabContent.replace(/\bvar\b/g, 'const'));
        setSnippetStatus(t('workspaceDashboard.editor.semanticApplied'));
    }, [activeTabContent, t, updateTabContent, setSnippetStatus]);

    return {
        reviewRules,
        setReviewRules,
        reviewSummary,
        bugSummary,
        performanceSummary,
        semanticPreview,
        runAiCodeReview,
        runAiBugScan,
        runAiPerformanceScan,
        previewSemanticRefactor,
        applySemanticRefactor,
    };
}
