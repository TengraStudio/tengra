/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export type PromptSuggestionType =
    | 'clarity'
    | 'specificity'
    | 'structure'
    | 'context'
    | 'constraint'
    | 'format';

export type PromptSuggestionSeverity = 'info' | 'warning' | 'improvement';

export interface PromptSuggestion {
    type: PromptSuggestionType;
    severity: PromptSuggestionSeverity;
    message: string;
    originalText?: string;
    suggestedText?: string;
    position?: { start: number; end: number };
}

export interface PromptStats {
    wordCount: number;
    sentenceCount: number;
    hasContext: boolean;
    hasConstraints: boolean;
    hasExamples: boolean;
    hasOutputFormat: boolean;
}

export interface PromptAnalysis {
    score: number;
    suggestions: PromptSuggestion[];
    stats: PromptStats;
}

type PromptTranslate = (key: string, options?: Record<string, string | number>) => string;

const VAGUE_WORDS = [
    'good', 'nice', 'better', 'some', 'things', 'stuff',
    'maybe', 'probably', 'kind of', 'sort of', 'a bit',
    'very', 'really', 'pretty much', 'basically',
];

const CONTEXT_INDICATORS = [
    'you are', 'act as', 'role:', 'context:',
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

export class PromptOptimizerService {
    constructor(private readonly translate?: PromptTranslate) {}

    private formatText(template: string, options?: Record<string, string | number>): string {
        if (!options) {
            return template;
        }
        return Object.keys(options).reduce((acc, key) => {
            return acc.replace(new RegExp(`{{${key}}}`, 'g'), String(options[key]));
        }, template);
    }

    private tr(
        key: string,
        fallback: string,
        options?: Record<string, string | number>
    ): string {
        const translated = this.translate?.(key, options);
        if (!translated || translated === key) {
            return this.formatText(fallback, options);
        }
        return translated;
    }

    analyzePrompt(prompt: string): PromptAnalysis {
        const trimmed = prompt.trim();
        if (trimmed.length === 0) {
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

        const lower = trimmed.toLowerCase();
        const words = trimmed.split(/\s+/).filter(w => w.length > 0);
        const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const stats: PromptStats = {
            wordCount: words.length,
            sentenceCount: sentences.length,
            hasContext: CONTEXT_INDICATORS.some(ind => lower.includes(ind)),
            hasConstraints: CONSTRAINT_INDICATORS.some(ind => lower.includes(ind)),
            hasExamples: EXAMPLE_INDICATORS.some(ind => lower.includes(ind)),
            hasOutputFormat: FORMAT_INDICATORS.some(ind => lower.includes(ind)),
        };

        const suggestions: PromptSuggestion[] = [];
        for (const word of VAGUE_WORDS) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const match = regex.exec(lower);
            if (match) {
                suggestions.push({
                    type: 'clarity',
                    severity: 'improvement',
                    message: this.tr(
                        'chat.promptOptimizer.vagueWordDetected',
                        'Vague word "{{word}}" detected. Consider being more specific.',
                        { word }
                    ),
                    originalText: word,
                    position: { start: match.index, end: match.index + word.length },
                });
            }
        }

        if (!stats.hasContext && stats.wordCount > 10) {
            suggestions.push({
                type: 'context',
                severity: 'improvement',
                message: this.tr(
                    'chat.promptOptimizer.contextSuggestion',
                    'Consider adding a role or context (e.g., "You are a senior developer...").'
                ),
                suggestedText: this.tr(
                    'chat.promptOptimizer.contextSuggestedText',
                    'You are an expert in [domain]. '
                ),
            });
        }
        if (!stats.hasConstraints && stats.wordCount > 15) {
            suggestions.push({
                type: 'constraint',
                severity: 'improvement',
                message: this.tr(
                    'chat.promptOptimizer.constraintSuggestion',
                    'Add constraints like length limits, scope, or what to avoid.'
                ),
                suggestedText: this.tr(
                    'chat.promptOptimizer.constraintSuggestedText',
                    'Constraints: Keep the response under [N] words. Do not include [IconX].'
                ),
            });
        }
        if (!stats.hasOutputFormat && stats.wordCount > 15) {
            suggestions.push({
                type: 'format',
                severity: 'info',
                message: this.tr(
                    'chat.promptOptimizer.formatSuggestion',
                    'Specify the desired output format (e.g., JSON, bullet points, table).'
                ),
                suggestedText: this.tr(
                    'chat.promptOptimizer.formatSuggestedText',
                    'Output format: Respond as a numbered list.'
                ),
            });
        }
        if (stats.wordCount > 0 && stats.wordCount < 20) {
            suggestions.push({
                type: 'specificity',
                severity: 'warning',
                message: this.tr(
                    'chat.promptOptimizer.shortPromptWarning',
                    'Prompt is quite short. Adding more detail typically improves results.'
                ),
            });
        }
        if (stats.wordCount > 500) {
            const hasStructure = STRUCTURE_INDICATORS.some(ind => trimmed.includes(ind));
            if (!hasStructure) {
                suggestions.push({
                    type: 'structure',
                    severity: 'warning',
                    message: this.tr(
                        'chat.promptOptimizer.longPromptStructureWarning',
                        'Long prompt without clear structure. Add headings, numbered steps, or sections.'
                    ),
                });
            }
        }
        if (!stats.hasExamples && stats.wordCount > 40) {
            suggestions.push({
                type: 'specificity',
                severity: 'info',
                message: this.tr(
                    'chat.promptOptimizer.examplesSuggestion',
                    'Consider adding examples to clarify the expected output.'
                ),
                suggestedText: this.tr(
                    'chat.promptOptimizer.examplesSuggestedText',
                    'Example: Input: [sample] → Output: [expected]'
                ),
            });
        }
        const pronounMatch = AMBIGUOUS_PRONOUN_PATTERN.exec(trimmed);
        if (pronounMatch) {
            suggestions.push({
                type: 'clarity',
                severity: 'warning',
                message: this.tr(
                    'chat.promptOptimizer.ambiguousPronounStarts',
                    'Starts with ambiguous pronoun "{{pronoun}}". Specify the subject explicitly.',
                    { pronoun: pronounMatch[0].trim() }
                ),
                originalText: pronounMatch[0].trim(),
                position: { start: 0, end: pronounMatch[0].length },
            });
        }
        const complexKeywords = ['analyze', 'compare', 'evaluate', 'explain why', 'reason'];
        const isComplex = complexKeywords.some(kw => lower.includes(kw));
        const hasSteps = lower.includes('step by step') || lower.includes('step-by-step');
        if (isComplex && !hasSteps && stats.wordCount > 20) {
            suggestions.push({
                type: 'structure',
                severity: 'info',
                message: this.tr(
                    'chat.promptOptimizer.complexTaskSuggestion',
                    'Complex task detected. Consider adding "Think step by step" for better reasoning.'
                ),
                suggestedText: this.tr(
                    'chat.promptOptimizer.complexTaskSuggestedText',
                    'Think step by step.'
                ),
            });
        }

        let score = 100;
        score -= suggestions.filter(s => s.severity === 'warning').length * 15;
        score -= suggestions.filter(s => s.severity === 'improvement').length * 8;
        score -= suggestions.filter(s => s.severity === 'info').length * 3;
        if (stats.hasContext) { score += 5; }
        if (stats.hasConstraints) { score += 5; }
        if (stats.hasOutputFormat) { score += 5; }
        score = Math.max(0, Math.min(100, score));

        return { score, suggestions, stats };
    }
}
