/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BaseService } from '@main/services/base.service';

/** Type of prompt improvement suggestion */
export type PromptSuggestionType = 'clarity' | 'specificity' | 'structure' | 'context' | 'constraint' | 'format';

/** Severity level for a suggestion */
export type PromptSuggestionSeverity = 'info' | 'warning' | 'improvement';

/** A single actionable suggestion for improving a prompt */
export interface PromptSuggestion {
    type: PromptSuggestionType;
    severity: PromptSuggestionSeverity;
    message: string;
    originalText?: string;
    suggestedText?: string;
    position?: { start: number; end: number };
}

/** Statistics extracted from the prompt text */
export interface PromptStats {
    wordCount: number;
    sentenceCount: number;
    hasContext: boolean;
    hasConstraints: boolean;
    hasExamples: boolean;
    hasOutputFormat: boolean;
}

/** Complete analysis result for a prompt */
export interface PromptAnalysis {
    score: number;
    suggestions: PromptSuggestion[];
    stats: PromptStats;
}

const VAGUE_WORDS = [
    'good', 'nice', 'better', 'some', 'things', 'stuff',
    'maybe', 'probably', 'kind of', 'sort of', 'a bit',
    'very', 'really', 'pretty much', 'basically',
];

const CONTEXT_INDICATORS = [
    'you are', 'act as', 'role:', 'persona:', 'context:',
    'background:', 'as a', 'imagine you',
];

const CONSTRAINT_INDICATORS = [
    'must', 'should', 'limit', 'maximum', 'minimum',
    'no more than', 'at least', 'within', 'constraint',
    'do not', 'avoid', 'only', 'exactly',
];

const EXAMPLE_INDICATORS = [
    'example:', 'for example', 'e.g.', 'such as',
    'here is an example', 'like this:', 'sample:',
];

const FORMAT_INDICATORS = [
    'format:', 'output:', 'respond in', 'json', 'markdown',
    'bullet points', 'numbered list', 'table', 'csv',
    'structured as', 'template:',
];

const STRUCTURE_INDICATORS = [
    '##', '###', '**', 'step 1', 'step 2',
    '1.', '2.', '3.', '- ', '* ',
];

const AMBIGUOUS_PRONOUN_PATTERN = /^(it|they|this|that|these|those)\s/i;

/**
 * Service that analyzes prompts locally and suggests improvements.
 * All analysis is performed without LLM calls using heuristic rules.
 */
export class PromptOptimizerService extends BaseService {
    constructor() {
        super('PromptOptimizerService');
    }

    /**
     * Analyze a prompt and return a scored analysis with suggestions.
     * @param prompt - The user's prompt text to analyze.
     * @returns Analysis result including score, suggestions, and stats.
     */
    analyzePrompt(prompt: string): PromptAnalysis {
        const trimmed = prompt.trim();
        if (trimmed.length === 0) {
            return this.buildEmptyAnalysis();
        }

        const stats = this.computeStats(trimmed);
        const suggestions: PromptSuggestion[] = [];

        this.checkVagueLanguage(trimmed, suggestions);
        this.checkMissingContext(stats, suggestions);
        this.checkMissingConstraints(stats, suggestions);
        this.checkMissingOutputFormat(stats, suggestions);
        this.checkTooShort(stats, suggestions);
        this.checkTooLongWithoutStructure(trimmed, stats, suggestions);
        this.checkMissingExamples(stats, suggestions);
        this.checkAmbiguousPronouns(trimmed, suggestions);
        this.checkChainOfThought(trimmed, stats, suggestions);
        this.checkTemperatureHint(trimmed, suggestions);

        const score = this.calculateScore(stats, suggestions);

        return { score, suggestions, stats };
    }

    /** Build an analysis result for an empty prompt. */
    private buildEmptyAnalysis(): PromptAnalysis {
        return {
            score: 0,
            suggestions: [],
            stats: {
                wordCount: 0,
                sentenceCount: 0,
                hasContext: false,
                hasConstraints: false,
                hasExamples: false,
                hasOutputFormat: false,
            },
        };
    }

    /**
     * Compute basic statistics about the prompt text.
     * @param text - The trimmed prompt text.
     */
    private computeStats(text: string): PromptStats {
        const lower = text.toLowerCase();
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

        return {
            wordCount: words.length,
            sentenceCount: sentences.length,
            hasContext: CONTEXT_INDICATORS.some(ind => lower.includes(ind)),
            hasConstraints: CONSTRAINT_INDICATORS.some(ind => lower.includes(ind)),
            hasExamples: EXAMPLE_INDICATORS.some(ind => lower.includes(ind)),
            hasOutputFormat: FORMAT_INDICATORS.some(ind => lower.includes(ind)),
        };
    }

    /**
     * Detect vague or imprecise language in the prompt.
     * @param text - The prompt text.
     * @param suggestions - Array to push suggestions into.
     */
    private checkVagueLanguage(text: string, suggestions: PromptSuggestion[]): void {
        const lower = text.toLowerCase();

        for (const word of VAGUE_WORDS) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const match = regex.exec(lower);
            if (match) {
                suggestions.push({
                    type: 'clarity',
                    severity: 'improvement',
                    message: `Vague word "${word}" detected. Consider being more specific.`,
                    originalText: word,
                    position: { start: match.index, end: match.index + word.length },
                });
            }
        }
    }

    /**
     * Check if the prompt lacks context or role definition.
     * @param stats - Computed prompt statistics.
     * @param suggestions - Array to push suggestions into.
     */
    private checkMissingContext(stats: PromptStats, suggestions: PromptSuggestion[]): void {
        if (!stats.hasContext && stats.wordCount > 10) {
            suggestions.push({
                type: 'context',
                severity: 'improvement',
                message: 'Consider adding a role or context (e.g., "You are a senior developer...").',
                suggestedText: 'You are an expert in [domain]. ',
            });
        }
    }

    /**
     * Check if the prompt lacks constraints or boundaries.
     * @param stats - Computed prompt statistics.
     * @param suggestions - Array to push suggestions into.
     */
    private checkMissingConstraints(stats: PromptStats, suggestions: PromptSuggestion[]): void {
        if (!stats.hasConstraints && stats.wordCount > 15) {
            suggestions.push({
                type: 'constraint',
                severity: 'improvement',
                message: 'Add constraints like length limits, scope, or what to avoid.',
                suggestedText: 'Constraints: Keep the response under [N] words. Do not include [X].',
            });
        }
    }

    /**
     * Check if the prompt lacks output format specification.
     * @param stats - Computed prompt statistics.
     * @param suggestions - Array to push suggestions into.
     */
    private checkMissingOutputFormat(stats: PromptStats, suggestions: PromptSuggestion[]): void {
        if (!stats.hasOutputFormat && stats.wordCount > 15) {
            suggestions.push({
                type: 'format',
                severity: 'info',
                message: 'Specify the desired output format (e.g., JSON, bullet points, table).',
                suggestedText: 'Output format: Respond as a numbered list.',
            });
        }
    }

    /**
     * Warn about prompts that are too short to be effective.
     * @param stats - Computed prompt statistics.
     * @param suggestions - Array to push suggestions into.
     */
    private checkTooShort(stats: PromptStats, suggestions: PromptSuggestion[]): void {
        if (stats.wordCount > 0 && stats.wordCount < 20) {
            suggestions.push({
                type: 'specificity',
                severity: 'warning',
                message: 'Prompt is quite short. Adding more detail typically improves results.',
            });
        }
    }

    /**
     * Warn about long prompts without structural organization.
     * @param text - The prompt text.
     * @param stats - Computed prompt statistics.
     * @param suggestions - Array to push suggestions into.
     */
    private checkTooLongWithoutStructure(
        text: string,
        stats: PromptStats,
        suggestions: PromptSuggestion[],
    ): void {
        if (stats.wordCount <= 500) {
            return;
        }
        const hasStructure = STRUCTURE_INDICATORS.some(ind => text.includes(ind));
        if (!hasStructure) {
            suggestions.push({
                type: 'structure',
                severity: 'warning',
                message: 'Long prompt without clear structure. Add headings, numbered steps, or sections.',
            });
        }
    }

    /**
     * Suggest adding examples for complex tasks.
     * @param stats - Computed prompt statistics.
     * @param suggestions - Array to push suggestions into.
     */
    private checkMissingExamples(stats: PromptStats, suggestions: PromptSuggestion[]): void {
        if (!stats.hasExamples && stats.wordCount > 40) {
            suggestions.push({
                type: 'specificity',
                severity: 'info',
                message: 'Consider adding examples to clarify the expected output.',
                suggestedText: 'Example: Input: [sample] → Output: [expected]',
            });
        }
    }

    /**
     * Detect ambiguous pronouns at the start of the prompt.
     * @param text - The prompt text.
     * @param suggestions - Array to push suggestions into.
     */
    private checkAmbiguousPronouns(text: string, suggestions: PromptSuggestion[]): void {
        const match = AMBIGUOUS_PRONOUN_PATTERN.exec(text);
        if (match) {
            suggestions.push({
                type: 'clarity',
                severity: 'warning',
                message: `Starts with ambiguous pronoun "${match[0].trim()}". Specify the subject explicitly.`,
                originalText: match[0].trim(),
                position: { start: 0, end: match[0].length },
            });
        }
    }

    /**
     * Suggest chain-of-thought for complex reasoning tasks.
     * @param text - The prompt text.
     * @param stats - Computed prompt statistics.
     * @param suggestions - Array to push suggestions into.
     */
    private checkChainOfThought(
        text: string,
        stats: PromptStats,
        suggestions: PromptSuggestion[],
    ): void {
        const lower = text.toLowerCase();
        const complexKeywords = ['analyze', 'compare', 'evaluate', 'explain why', 'reason'];
        const isComplex = complexKeywords.some(kw => lower.includes(kw));
        const hasSteps = lower.includes('step by step') || lower.includes('step-by-step');

        if (isComplex && !hasSteps && stats.wordCount > 20) {
            suggestions.push({
                type: 'structure',
                severity: 'info',
                message: 'Complex task detected. Consider adding "Think step by step" for better reasoning.',
                suggestedText: 'Think step by step.',
            });
        }
    }

    /**
     * Suggest temperature settings based on task type.
     * @param text - The prompt text.
     * @param suggestions - Array to push suggestions into.
     */
    private checkTemperatureHint(text: string, suggestions: PromptSuggestion[]): void {
        const lower = text.toLowerCase();
        const creativeKeywords = ['creative', 'brainstorm', 'imagine', 'story', 'poem', 'generate ideas'];
        const factualKeywords = ['factual', 'accurate', 'precise', 'exact', 'calculate', 'code', 'debug'];

        const isCreative = creativeKeywords.some(kw => lower.includes(kw));
        const isFactual = factualKeywords.some(kw => lower.includes(kw));

        if (isCreative && !isFactual) {
            suggestions.push({
                type: 'format',
                severity: 'info',
                message: 'Creative task detected. Consider using a higher temperature (0.7–1.0).',
            });
        } else if (isFactual && !isCreative) {
            suggestions.push({
                type: 'format',
                severity: 'info',
                message: 'Factual task detected. Consider using a lower temperature (0.1–0.3).',
            });
        }
    }

    /**
     * Calculate a score from 0-100 based on prompt quality.
     * @param stats - Computed prompt statistics.
     * @param suggestions - List of generated suggestions.
     */
    private calculateScore(stats: PromptStats, suggestions: PromptSuggestion[]): number {
        let score = 50;

        if (stats.hasContext) {score += 15;}
        if (stats.hasConstraints) {score += 10;}
        if (stats.hasExamples) {score += 10;}
        if (stats.hasOutputFormat) {score += 10;}
        if (stats.wordCount >= 20 && stats.wordCount <= 500) {score += 5;}

        const warningCount = suggestions.filter(s => s.severity === 'warning').length;
        const improvementCount = suggestions.filter(s => s.severity === 'improvement').length;

        score -= warningCount * 8;
        score -= improvementCount * 4;

        return Math.max(0, Math.min(100, score));
    }
}
