/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { LLMService } from '@main/services/llm/llm.service';
import { MemoryContextService } from '@main/services/llm/memory-context.service';
import { Message } from '@shared/types/chat';

import { TerminalService } from './terminal.service';

export interface SuggestionOptions {
    command: string;
    shell: string;
    cwd: string;
    historyLimit?: number;
}

export interface ExplainCommandOptions {
    command: string;
    shell: string;
    cwd?: string;
}

export interface ExplainCommandResult {
    explanation: string;
    breakdown: Array<{ part: string; description: string }>;
    warnings?: string[];
    relatedCommands?: string[];
}

export interface ExplainErrorOptions {
    errorOutput: string;
    command?: string;
    shell: string;
    cwd?: string;
}

export interface ExplainErrorResult {
    summary: string;
    cause: string;
    solution: string;
    steps?: string[];
}

export interface FixErrorOptions {
    errorOutput: string;
    command: string;
    shell: string;
    cwd?: string;
}

export interface FixErrorResult {
    suggestedCommand: string;
    explanation: string;
    confidence: 'high' | 'medium' | 'low';
    alternativeCommands?: string[];
}

const TERMINAL_SMART_MODEL = 'gpt-4o';
const TERMINAL_SMART_PROVIDER = 'openai';
const TERMINAL_MEMORY_LOOKUP_TIMEOUT_MS = 450;
const TERMINAL_MEMORY_MATCH_LIMIT = 3;

export class TerminalSmartService extends BaseService {
    private readonly memoryContext: MemoryContextService;

    constructor(
        private llmService: LLMService,
        private terminalService: TerminalService,
        private readonly advancedMemoryService?: AdvancedMemoryService
    ) {
        super('TerminalSmartService');
        this.memoryContext = new MemoryContextService(this.advancedMemoryService);
    }

    private async raceWithTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
            if (timer?.unref) { timer.unref(); }
        });

        try {
            return await Promise.race([operation, timeoutPromise]);
        } finally {
            if (timer !== null) {
                clearTimeout(timer);
            }
        }
    }

    /**
     * Get AI-powered command suggestions based on current input and history
     */
    async getSuggestions(options: SuggestionOptions): Promise<string[]> {
        try {
            const { command, shell, cwd, historyLimit = 10 } = options;

            if (!command || command.trim().length === 0) {
                return [];
            }

            const history = this.terminalService.getRecentHistory(historyLimit)
                .map(h => h.command);

            const prompt = this.buildPrompt(command, shell, cwd, history);
            const memoryContext = await this.memoryContext.getResolutionContext(`${command}\n${history.join('\n')}`, {
                timeoutMs: TERMINAL_MEMORY_LOOKUP_TIMEOUT_MS,
                limit: TERMINAL_MEMORY_MATCH_LIMIT
            });

            const response = await this.llmService.chat([{
                role: 'system',
                content: this.memoryContext.buildMemoryAwareSystemPrompt(
                    'You are a CLI expert. Predict the most likely completion for the given command input. Return ONLY a JSON array of strings, no other text.',
                    memoryContext
                )
            }, {
                role: 'user',
                content: prompt
            }], TERMINAL_SMART_MODEL);

            const content = response.content || '[]';
            const suggestions = this.parseSuggestions(content);

            // Filter out suggestions that don't start with the current command
            // or are identical to the current command
            return suggestions
                .filter(s => s.startsWith(command) && s !== command)
                .slice(0, 3);

        } catch (error) {
            appLogger.error('TerminalSmartService', 'Failed to get suggestions', error as Error);
            return [];
        }
    }

    private buildPrompt(command: string, shell: string, cwd: string, history: string[]): string {
        return `
Context:
- Shell: ${shell}
- Directory: ${cwd}
- Recent History:
${history.map(h => `  - ${h}`).join('\n')}

Current Partial Command: "${command}"

Predict the 5 most likely full commands starting with "${command}". 
Consider the directory context and recent history.
Return as a JSON array of strings.
`;
    }

    private parseSuggestions(content: string): string[] {
        try {
            // Find JSON array in content
            const match = content.match(/\[.*\]/s);
            if (match) {
                return JSON.parse(match[0]) as string[];
            }
            return [];
        } catch {
            return [];
        }
    }

    /**
     * Explain what a command does in plain language
     */
    async explainCommand(options: ExplainCommandOptions): Promise<ExplainCommandResult> {
        const { command, shell, cwd } = options;
        const TIMEOUT_MS = 30000;

        try {
            if (!command || command.trim().length === 0) {
                return {
                    explanation: 'No command provided',
                    breakdown: []
                };
            }

            const history = this.terminalService.getRecentHistory(5)
                .map(h => h.command);

            const prompt = `
You are a CLI expert. Explain the following command in plain language.

Context:
- Shell: ${shell}
- Directory: ${cwd || 'unknown'}
- Recent commands for context: ${history.join(', ') || 'none'}

Command to explain: ${command}

Respond with a JSON object containing:
{
  "explanation": "A clear, concise explanation of what this command does (1-2 sentences)",
  "breakdown": [
    { "part": "command-part", "description": "what this part does" }
  ],
  "warnings": ["any potential risks or warnings about this command"],
  "relatedCommands": ["similar useful commands"]
}

Return ONLY valid JSON, no markdown or other text.
`;
            const memoryContext = await this.memoryContext.getResolutionContext(command, {
                timeoutMs: TERMINAL_MEMORY_LOOKUP_TIMEOUT_MS,
                limit: TERMINAL_MEMORY_MATCH_LIMIT
            });

            const responsePromise = this.llmService.chat([{
                role: 'system',
                content: this.memoryContext.buildMemoryAwareSystemPrompt(
                    'You are a CLI expert. Provide clear, accurate explanations. Return only valid JSON.',
                    memoryContext
                )
            }, {
                role: 'user',
                content: prompt
            }], TERMINAL_SMART_MODEL);

            const response = await this.raceWithTimeout(responsePromise, TIMEOUT_MS);
            const content = response.content || '{}';
            this.captureConversationMemory({
                userInput: `Explain command: ${command}\nShell: ${shell}\nDirectory: ${cwd ?? 'unknown'}`,
                assistantContent: content,
                cwd
            });

            return this.parseExplainCommandResult(content);
        } catch (error) {
            appLogger.error('TerminalSmartService', 'Failed to explain command', error as Error);
            return {
                explanation: 'Failed to explain command. Please try again.',
                breakdown: []
            };
        }
    }

    /**
     * Explain an error message and provide troubleshooting guidance
     */
    async explainError(options: ExplainErrorOptions): Promise<ExplainErrorResult> {
        const { errorOutput, command, shell, cwd } = options;
        const TIMEOUT_MS = 30000;

        try {
            if (!errorOutput || errorOutput.trim().length === 0) {
                return {
                    summary: 'No error output provided',
                    cause: 'Unknown',
                    solution: 'Please provide the error message'
                };
            }

            // Truncate very long error outputs
            const truncatedError = errorOutput.length > 2000
                ? errorOutput.substring(0, 2000) + '...[truncated]'
                : errorOutput;

            const prompt = `
You are a CLI expert and troubleshooter. Analyze this error and provide guidance.

Context:
- Shell: ${shell}
- Directory: ${cwd || 'unknown'}
- Command that caused the error: ${command || 'unknown'}

Error output:
\`\`\`
${truncatedError}
\`\`\`

Respond with a JSON object containing:
{
  "summary": "Brief one-sentence summary of what went wrong",
  "cause": "The root cause of this error",
  "solution": "How to fix this error",
  "steps": ["Step 1 to fix", "Step 2 to fix"]
}

Return ONLY valid JSON, no markdown or other text.
`;
            const memoryContext = await this.memoryContext.getResolutionContext(
                `${command ?? ''}\n${truncatedError}`.trim(),
                {
                    timeoutMs: TERMINAL_MEMORY_LOOKUP_TIMEOUT_MS,
                    limit: TERMINAL_MEMORY_MATCH_LIMIT
                }
            );

            const responsePromise = this.llmService.chat([{
                role: 'system',
                content: this.memoryContext.buildMemoryAwareSystemPrompt(
                    'You are a CLI troubleshooting expert. Provide clear, actionable solutions. Return only valid JSON.',
                    memoryContext
                )
            }, {
                role: 'user',
                content: prompt
            }], TERMINAL_SMART_MODEL);

            const response = await this.raceWithTimeout(responsePromise, TIMEOUT_MS);
            const content = response.content || '{}';
            this.captureConversationMemory({
                userInput: `Explain terminal error for command: ${command ?? 'unknown'}\nShell: ${shell}\nError:\n${truncatedError}`,
                assistantContent: content,
                cwd
            });

            return this.parseExplainErrorResult(content);
        } catch (error) {
            appLogger.error('TerminalSmartService', 'Failed to explain error', error as Error);
            return {
                summary: 'Failed to analyze error. Please try again.',
                cause: 'Unknown',
                solution: 'Unable to provide solution at this time'
            };
        }
    }

    /**
     * Suggest a fix for a failed command based on the error
     */
    async fixError(options: FixErrorOptions): Promise<FixErrorResult> {
        const { errorOutput, command, shell, cwd } = options;
        const TIMEOUT_MS = 30000;

        try {
            if (!command || command.trim().length === 0) {
                return {
                    suggestedCommand: '',
                    explanation: 'No command provided',
                    confidence: 'low'
                };
            }

            // Truncate very long error outputs
            const truncatedError = errorOutput.length > 2000
                ? errorOutput.substring(0, 2000) + '...[truncated]'
                : errorOutput;

            const history = this.terminalService.getRecentHistory(10)
                .map(h => h.command);

            const prompt = `
You are a CLI expert. A command failed and you need to suggest a corrected version.

Context:
- Shell: ${shell}
- Directory: ${cwd || 'unknown'}
- Recent successful commands: ${history.join(', ') || 'none'}

Failed command: ${command}

Error output:
\`\`\`
${truncatedError}
\`\`\`

Analyze the error and suggest a corrected command.

Respond with a JSON object containing:
{
  "suggestedCommand": "the corrected command that should work",
  "explanation": "brief explanation of what was changed and why",
  "confidence": "high" | "medium" | "low",
  "alternativeCommands": ["other possible solutions if any"]
}

Return ONLY valid JSON, no markdown or other text.
`;
            const memoryContext = await this.memoryContext.getResolutionContext(
                `${command}\n${truncatedError}`,
                {
                    timeoutMs: TERMINAL_MEMORY_LOOKUP_TIMEOUT_MS,
                    limit: TERMINAL_MEMORY_MATCH_LIMIT
                }
            );

            const responsePromise = this.llmService.chat([{
                role: 'system',
                content: this.memoryContext.buildMemoryAwareSystemPrompt(
                    'You are a CLI expert. Suggest corrected commands based on errors. Return only valid JSON.',
                    memoryContext
                )
            }, {
                role: 'user',
                content: prompt
            }], TERMINAL_SMART_MODEL);

            const response = await this.raceWithTimeout(responsePromise, TIMEOUT_MS);
            const content = response.content || '{}';
            this.captureConversationMemory({
                userInput: `Fix failed terminal command: ${command}\nShell: ${shell}\nDirectory: ${cwd ?? 'unknown'}\nError:\n${truncatedError}`,
                assistantContent: content,
                cwd
            });

            return this.parseFixErrorResult(content);
        } catch (error) {
            appLogger.error('TerminalSmartService', 'Failed to suggest fix', error as Error);
            return {
                suggestedCommand: '',
                explanation: 'Failed to suggest fix. Please try again.',
                confidence: 'low'
            };
        }
    }

    private parseExplainCommandResult(content: string): ExplainCommandResult {
        try {
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]) as Record<string, RuntimeValue>;
                return {
                    explanation: typeof parsed.explanation === 'string' ? parsed.explanation : 'Unable to parse explanation',
                    breakdown: Array.isArray(parsed.breakdown) ? parsed.breakdown as ExplainCommandResult['breakdown'] : [],
                    warnings: Array.isArray(parsed.warnings) ? parsed.warnings as string[] : undefined,
                    relatedCommands: Array.isArray(parsed.relatedCommands) ? parsed.relatedCommands as string[] : undefined
                };
            }
            return {
                explanation: content,
                breakdown: []
            };
        } catch {
            return {
                explanation: content || 'Unable to parse response',
                breakdown: []
            };
        }
    }

    private parseExplainErrorResult(content: string): ExplainErrorResult {
        try {
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]) as Record<string, RuntimeValue>;
                return {
                    summary: typeof parsed.summary === 'string' ? parsed.summary : 'Unable to parse summary',
                    cause: typeof parsed.cause === 'string' ? parsed.cause : 'Unknown',
                    solution: typeof parsed.solution === 'string' ? parsed.solution : 'Unable to provide solution',
                    steps: Array.isArray(parsed.steps) ? parsed.steps as string[] : undefined
                };
            }
            return {
                summary: content,
                cause: 'Unknown',
                solution: 'Unable to parse solution'
            };
        } catch {
            return {
                summary: content || 'Unable to parse response',
                cause: 'Unknown',
                solution: 'Unable to provide solution'
            };
        }
    }

    private parseFixErrorResult(content: string): FixErrorResult {
        try {
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]) as Record<string, RuntimeValue>;
                const confidence = parsed.confidence;
                return {
                    suggestedCommand: typeof parsed.suggestedCommand === 'string' ? parsed.suggestedCommand : '',
                    explanation: typeof parsed.explanation === 'string' ? parsed.explanation : 'Unable to parse explanation',
                    confidence: confidence === 'high' || confidence === 'medium' || confidence === 'low' ? confidence : 'low',
                    alternativeCommands: Array.isArray(parsed.alternativeCommands) ? parsed.alternativeCommands as string[] : undefined
                };
            }
            return {
                suggestedCommand: '',
                explanation: content,
                confidence: 'low'
            };
        } catch {
            return {
                suggestedCommand: '',
                explanation: content || 'Unable to parse response',
                confidence: 'low'
            };
        }
    }

    private captureConversationMemory(params: {
        userInput: string;
        assistantContent: string;
        cwd?: string;
    }): void {
        const assistantContent = params.assistantContent.trim();
        const userInput = params.userInput.trim();
        if (!assistantContent || !userInput) {
            return;
        }
        const now = Date.now();
        const messages: Message[] = [{
            id: `terminal-smart-${now}`,
            role: 'user',
            content: userInput,
            timestamp: new Date(now)
        }];
        this.memoryContext.captureConversation({
            provider: TERMINAL_SMART_PROVIDER,
            model: TERMINAL_SMART_MODEL,
            messages,
            assistantContent
        });
    }
}
