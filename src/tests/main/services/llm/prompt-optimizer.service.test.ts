/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { PromptAnalysis } from '@main/services/llm/prompt-optimizer.service';
import { PromptOptimizerService } from '@main/services/llm/prompt-optimizer.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('PromptOptimizerService', () => {
    let service: PromptOptimizerService;

    beforeEach(() => {
        service = new PromptOptimizerService();
    });

    describe('vague language detection', () => {
        it('should detect vague words like "good" and "some"', () => {
            const result = service.analyzePrompt(
                'Write some good content about nice things for me please',
            );

            const clarityHints = result.suggestions.filter(s => s.type === 'clarity');
            expect(clarityHints.length).toBeGreaterThanOrEqual(2);

            const messages = clarityHints.map(s => s.message);
            expect(messages.some(m => m.includes('"good"'))).toBe(true);
            expect(messages.some(m => m.includes('"some"'))).toBe(true);
        });

        it('should not flag specific prompts without vague words', () => {
            const result = service.analyzePrompt(
                'List the top 5 programming languages by TIOBE index for 2024 in a numbered list',
            );

            const clarityHints = result.suggestions.filter(s => s.type === 'clarity');
            expect(clarityHints.length).toBe(0);
        });
    });

    describe('missing context warning', () => {
        it('should warn when no role or context is provided', () => {
            const result = service.analyzePrompt(
                'Write a function that sorts an array of numbers in ascending order',
            );

            const contextHints = result.suggestions.filter(s => s.type === 'context');
            expect(contextHints.length).toBe(1);
            expect(contextHints[0].suggestedText).toBeDefined();
        });

        it('should not warn when context is present', () => {
            const result = service.analyzePrompt(
                'You are a senior TypeScript developer. Write a function that sorts an array.',
            );

            const contextHints = result.suggestions.filter(s => s.type === 'context');
            expect(contextHints.length).toBe(0);
        });
    });

    describe('score calculation', () => {
        it('should return 0 for empty prompt', () => {
            const result = service.analyzePrompt('');
            expect(result.score).toBe(0);
            expect(result.stats.wordCount).toBe(0);
        });

        it('should give a low score for a vague short prompt', () => {
            const result = service.analyzePrompt('Do some good stuff');
            expect(result.score).toBeLessThan(50);
        });

        it('should give a higher score for a well-structured prompt', () => {
            const prompt = [
                'You are an expert data scientist.',
                'Analyze the following dataset and provide insights.',
                'Constraints: Limit the analysis to the top 3 trends.',
                'Output format: Respond as a numbered list with bullet points.',
                'Example: Input: Sales data for Q1 → Output: 1. Revenue trend...',
            ].join('\n');

            const result = service.analyzePrompt(prompt);
            expect(result.score).toBeGreaterThanOrEqual(75);
            expect(result.stats.hasContext).toBe(true);
            expect(result.stats.hasConstraints).toBe(true);
            expect(result.stats.hasOutputFormat).toBe(true);
            expect(result.stats.hasExamples).toBe(true);
        });
    });

    describe('short prompt handling', () => {
        it('should warn when prompt is too short', () => {
            const result = service.analyzePrompt('Write code');
            const shortWarnings = result.suggestions.filter(
                s => s.type === 'specificity' && s.severity === 'warning',
            );
            expect(shortWarnings.length).toBe(1);
        });

        it('should not warn about length for sufficiently long prompts', () => {
            const result = service.analyzePrompt(
                'You are a Python expert. Write a function that takes a list of integers and returns the median value. ' +
                'Handle edge cases like empty lists and single elements. Use type hints.',
            );
            const shortWarnings = result.suggestions.filter(
                s => s.type === 'specificity' && s.severity === 'warning' && s.message.includes('short'),
            );
            expect(shortWarnings.length).toBe(0);
        });
    });

    describe('long prompt without structure', () => {
        it('should warn for long unstructured prompts', () => {
            const longText = Array.from({ length: 120 }, (_, i) =>
                `Word${i} is part of this long prompt text`,
            ).join(' ');

            const result = service.analyzePrompt(longText);
            const structureWarnings = result.suggestions.filter(s => s.type === 'structure');
            expect(structureWarnings.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('ambiguous pronouns', () => {
        it('should detect ambiguous pronoun at start', () => {
            const result = service.analyzePrompt(
                'It should be refactored to use dependency injection pattern in the service layer',
            );
            const clarityHints = result.suggestions.filter(
                s => s.type === 'clarity' && s.message.includes('pronoun'),
            );
            expect(clarityHints.length).toBe(1);
        });
    });

    describe('chain-of-thought suggestion', () => {
        it('should suggest step-by-step for complex reasoning', () => {
            const result = service.analyzePrompt(
                'Analyze the performance characteristics of this sorting algorithm and compare it with merge sort including time and space complexity for large datasets',
            );
            const cotHints = result.suggestions.filter(
                s => s.message.includes('step by step'),
            );
            expect(cotHints.length).toBe(1);
        });
    });

    describe('temperature hint', () => {
        it('should suggest higher temperature for creative tasks', () => {
            const result = service.analyzePrompt(
                'Write a creative story about a robot learning to paint in a futuristic city',
            );
            const tempHints = result.suggestions.filter(
                s => s.message.includes('temperature'),
            );
            expect(tempHints.length).toBe(1);
            expect(tempHints[0].message).toContain('higher');
        });

        it('should suggest lower temperature for factual tasks', () => {
            const result = service.analyzePrompt(
                'Debug this code and calculate the exact output for the given input values',
            );
            const tempHints = result.suggestions.filter(
                s => s.message.includes('temperature'),
            );
            expect(tempHints.length).toBe(1);
            expect(tempHints[0].message).toContain('lower');
        });
    });

    describe('stats computation', () => {
        it('should count words and sentences correctly', () => {
            const result = service.analyzePrompt('Hello world. How are you? Fine thanks!');
            expect(result.stats.wordCount).toBe(7);
            expect(result.stats.sentenceCount).toBe(3);
        });
    });

    describe('structured prompt gets high score', () => {
        it('should score 80+ for a complete well-structured prompt', () => {
            const prompt = [
                'Act as a senior backend engineer specializing in Node.js.',
                'Context: We have a REST API with performance issues under heavy load.',
                'Task: Review the following code and suggest exactly 3 optimizations.',
                'Constraints: Do not suggest rewriting the entire module. Must maintain backward compatibility.',
                'Output format: Respond as a numbered list with code examples.',
                'Example: 1. Use connection pooling — `const pool = new Pool({max: 20})`',
            ].join('\n');

            const result: PromptAnalysis = service.analyzePrompt(prompt);
            expect(result.score).toBeGreaterThanOrEqual(80);
            expect(result.stats.hasContext).toBe(true);
            expect(result.stats.hasConstraints).toBe(true);
            expect(result.stats.hasExamples).toBe(true);
            expect(result.stats.hasOutputFormat).toBe(true);
        });
    });
});
