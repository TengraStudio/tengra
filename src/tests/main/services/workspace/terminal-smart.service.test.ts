/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

import { appLogger } from '@main/logging/logger';
import type { LLMService } from '@main/services/llm/llm.service';
import type { TerminalService } from '@main/services/workspace/terminal.service';
import {
    type ExplainCommandResult,
    type ExplainErrorResult,
    type FixErrorResult,
    type SuggestionOptions,
    TerminalSmartService,
} from '@main/services/workspace/terminal-smart.service';

function createMockLlm(): { chat: ReturnType<typeof vi.fn> } {
    return {
        chat: vi.fn(async () => ({ content: '[]', role: 'assistant' })),
    };
}

function createMockTerminal(): { getRecentHistory: ReturnType<typeof vi.fn> } {
    return {
        getRecentHistory: vi.fn(() => [
            { command: 'npm install', shell: 'bash', cwd: '/proj', timestamp: 1, sessionId: 's1' },
            { command: 'npm test', shell: 'bash', cwd: '/proj', timestamp: 2, sessionId: 's1' },
        ]),
    };
}

describe('TerminalSmartService', () => {
    let service: TerminalSmartService;
    let mockLlm: ReturnType<typeof createMockLlm>;
    let mockTerminal: ReturnType<typeof createMockTerminal>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockLlm = createMockLlm();
        mockTerminal = createMockTerminal();
        service = new TerminalSmartService(
            mockLlm as never as LLMService,
            mockTerminal as never as TerminalService
        );
    });

    describe('getSuggestions', () => {
        it('should return filtered suggestions from LLM', async () => {
            mockLlm.chat.mockResolvedValue({
                content: '["npm run build", "npm run dev", "npm run test"]',
                role: 'assistant'
            });

            const options: SuggestionOptions = {
                command: 'npm run',
                shell: 'bash',
                cwd: '/proj'
            };
            const results = await service.getSuggestions(options);

            expect(mockLlm.chat).toHaveBeenCalled();
            expect(mockTerminal.getRecentHistory).toHaveBeenCalledWith(10);
            expect(results.every(s => s.startsWith('npm run'))).toBe(true);
        });

        it('should return empty for blank command', async () => {
            const results = await service.getSuggestions({
                command: '',
                shell: 'bash',
                cwd: '/proj'
            });
            expect(results).toEqual([]);
            expect(mockLlm.chat).not.toHaveBeenCalled();
        });

        it('should return empty for whitespace-only command', async () => {
            const results = await service.getSuggestions({
                command: '   ',
                shell: 'bash',
                cwd: '/proj'
            });
            expect(results).toEqual([]);
        });

        it('should filter out suggestions identical to input', async () => {
            mockLlm.chat.mockResolvedValue({
                content: '["npm run", "npm run build"]',
                role: 'assistant'
            });
            const results = await service.getSuggestions({
                command: 'npm run',
                shell: 'bash',
                cwd: '/proj'
            });
            expect(results).not.toContain('npm run');
            expect(results).toContain('npm run build');
        });

        it('should limit results to 3 suggestions', async () => {
            mockLlm.chat.mockResolvedValue({
                content: '["git status", "git stash", "git stash pop", "git stash list", "git stash drop"]',
                role: 'assistant'
            });
            const results = await service.getSuggestions({
                command: 'git st',
                shell: 'bash',
                cwd: '/proj'
            });
            expect(results.length).toBeLessThanOrEqual(3);
        });

        it('should use custom historyLimit', async () => {
            mockLlm.chat.mockResolvedValue({ content: '[]', role: 'assistant' });
            await service.getSuggestions({
                command: 'git',
                shell: 'bash',
                cwd: '/proj',
                historyLimit: 5
            });
            expect(mockTerminal.getRecentHistory).toHaveBeenCalledWith(5);
        });

        it('should handle LLM errors gracefully', async () => {
            mockLlm.chat.mockRejectedValue(new Error('LLM timeout'));
            const results = await service.getSuggestions({
                command: 'npm',
                shell: 'bash',
                cwd: '/proj'
            });
            expect(results).toEqual([]);
            expect(appLogger.error).toHaveBeenCalled();
        });

        it('should handle malformed JSON from LLM', async () => {
            mockLlm.chat.mockResolvedValue({
                content: 'not valid json at all',
                role: 'assistant'
            });
            const results = await service.getSuggestions({
                command: 'npm',
                shell: 'bash',
                cwd: '/proj'
            });
            expect(results).toEqual([]);
        });
    });

    describe('explainCommand', () => {
        it('should return parsed explanation from LLM', async () => {
            const llmResponse: ExplainCommandResult = {
                explanation: 'Lists files in directory',
                breakdown: [{ part: 'ls', description: 'list command' }],
                warnings: ['Shows hidden files with -a'],
                relatedCommands: ['dir']
            };
            mockLlm.chat.mockResolvedValue({
                content: JSON.stringify(llmResponse),
                role: 'assistant'
            });

            const result = await service.explainCommand({
                command: 'ls -la',
                shell: 'bash',
                cwd: '/home'
            });

            expect(result.explanation).toBe('Lists files in directory');
            expect(result.breakdown).toHaveLength(1);
            expect(result.warnings).toContain('Shows hidden files with -a');
        });

        it('should return fallback for empty command', async () => {
            const result = await service.explainCommand({
                command: '',
                shell: 'bash'
            });
            expect(result.explanation).toBe('No command provided');
            expect(result.breakdown).toEqual([]);
            expect(mockLlm.chat).not.toHaveBeenCalled();
        });

        it('should handle LLM error gracefully', async () => {
            mockLlm.chat.mockRejectedValue(new Error('timeout'));
            const result = await service.explainCommand({
                command: 'rm -rf /',
                shell: 'bash'
            });
            expect(result.explanation).toContain('Failed');
            expect(result.breakdown).toEqual([]);
        });

        it('should handle non-JSON LLM response', async () => {
            mockLlm.chat.mockResolvedValue({
                content: 'This command does X',
                role: 'assistant'
            });
            const result = await service.explainCommand({
                command: 'echo hello',
                shell: 'bash'
            });
            expect(result.explanation).toBeTruthy();
        });
    });

    describe('explainError', () => {
        it('should return parsed error explanation', async () => {
            const llmResponse: ExplainErrorResult = {
                summary: 'Module not found',
                cause: 'Missing dependency',
                solution: 'Run npm install',
                steps: ['npm install', 'retry the command']
            };
            mockLlm.chat.mockResolvedValue({
                content: JSON.stringify(llmResponse),
                role: 'assistant'
            });

            const result = await service.explainError({
                errorOutput: "Error: Cannot find module 'express'",
                command: 'node app.js',
                shell: 'bash',
                cwd: '/proj'
            });

            expect(result.summary).toBe('Module not found');
            expect(result.cause).toBe('Missing dependency');
            expect(result.steps).toHaveLength(2);
        });

        it('should return fallback for empty error output', async () => {
            const result = await service.explainError({
                errorOutput: '',
                shell: 'bash'
            });
            expect(result.summary).toBe('No error output provided');
            expect(mockLlm.chat).not.toHaveBeenCalled();
        });

        it('should truncate very long error output', async () => {
            const longError = 'E'.repeat(3000);
            mockLlm.chat.mockResolvedValue({
                content: '{"summary":"error","cause":"unknown","solution":"fix it"}',
                role: 'assistant'
            });
            await service.explainError({
                errorOutput: longError,
                shell: 'bash'
            });

            const callArgs = mockLlm.chat.mock.calls[0] as Array<Array<{ role: string; content: string }>>;
            const userMessage = (callArgs[0] as Array<{ role: string; content: string }>).find(m => m.role === 'user');
            expect(userMessage?.content).toContain('[truncated]');
        });

        it('should handle LLM error gracefully', async () => {
            mockLlm.chat.mockRejectedValue(new Error('service down'));
            const result = await service.explainError({
                errorOutput: 'some error',
                shell: 'bash'
            });
            expect(result.summary).toContain('Failed');
        });
    });

    describe('fixError', () => {
        it('should return suggested fix from LLM', async () => {
            const llmResponse: FixErrorResult = {
                suggestedCommand: 'npm install express',
                explanation: 'Install the missing module',
                confidence: 'high',
                alternativeCommands: ['yarn add express']
            };
            mockLlm.chat.mockResolvedValue({
                content: JSON.stringify(llmResponse),
                role: 'assistant'
            });

            const result = await service.fixError({
                errorOutput: "Cannot find module 'express'",
                command: 'node app.js',
                shell: 'bash',
                cwd: '/proj'
            });

            expect(result.suggestedCommand).toBe('npm install express');
            expect(result.confidence).toBe('high');
            expect(result.alternativeCommands).toContain('yarn add express');
        });

        it('should return fallback for empty command', async () => {
            const result = await service.fixError({
                errorOutput: 'error',
                command: '',
                shell: 'bash'
            });
            expect(result.suggestedCommand).toBe('');
            expect(result.confidence).toBe('low');
            expect(mockLlm.chat).not.toHaveBeenCalled();
        });

        it('should handle LLM error gracefully', async () => {
            mockLlm.chat.mockRejectedValue(new Error('network error'));
            const result = await service.fixError({
                errorOutput: 'error',
                command: 'bad cmd',
                shell: 'bash'
            });
            expect(result.suggestedCommand).toBe('');
            expect(result.confidence).toBe('low');
            expect(appLogger.error).toHaveBeenCalled();
        });

        it('should default unknown confidence to low', async () => {
            mockLlm.chat.mockResolvedValue({
                content: '{"suggestedCommand":"x","explanation":"y","confidence":"unknown"}',
                role: 'assistant'
            });
            const result = await service.fixError({
                errorOutput: 'err',
                command: 'cmd',
                shell: 'bash'
            });
            expect(result.confidence).toBe('low');
        });

        it('should truncate long error output in prompt', async () => {
            const longError = 'X'.repeat(3000);
            mockLlm.chat.mockResolvedValue({
                content: '{"suggestedCommand":"fix","explanation":"fixed","confidence":"medium"}',
                role: 'assistant'
            });
            await service.fixError({
                errorOutput: longError,
                command: 'cmd',
                shell: 'bash'
            });

            const callArgs = mockLlm.chat.mock.calls[0] as Array<Array<{ role: string; content: string }>>;
            const userMessage = (callArgs[0] as Array<{ role: string; content: string }>).find(m => m.role === 'user');
            expect(userMessage?.content).toContain('[truncated]');
        });

        it('should handle malformed JSON from LLM', async () => {
            mockLlm.chat.mockResolvedValue({
                content: 'try running npm install instead',
                role: 'assistant'
            });
            const result = await service.fixError({
                errorOutput: 'err',
                command: 'cmd',
                shell: 'bash'
            });
            expect(result.confidence).toBe('low');
            expect(result.suggestedCommand).toBe('');
        });
    });
});
