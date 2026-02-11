import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { LLMService } from '@main/services/llm/llm.service';

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

export class TerminalSmartService extends BaseService {
    constructor(
        private llmService: LLMService,
        private terminalService: TerminalService
    ) {
        super('TerminalSmartService');
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

            const response = await this.llmService.chat([{
                role: 'system',
                content: 'You are a CLI expert. Predict the most likely completion for the given command input. Return ONLY a JSON array of strings, no other text.'
            }, {
                role: 'user',
                content: prompt
            }], 'gpt-4o');

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

            const responsePromise = this.llmService.chat([{
                role: 'system',
                content: 'You are a CLI expert. Provide clear, accurate explanations. Return only valid JSON.'
            }, {
                role: 'user',
                content: prompt
            }], 'gpt-4o');

            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Request timed out')), TIMEOUT_MS);
            });

            const response = await Promise.race([responsePromise, timeoutPromise]);
            const content = response.content || '{}';

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

            const responsePromise = this.llmService.chat([{
                role: 'system',
                content: 'You are a CLI troubleshooting expert. Provide clear, actionable solutions. Return only valid JSON.'
            }, {
                role: 'user',
                content: prompt
            }], 'gpt-4o');

            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Request timed out')), TIMEOUT_MS);
            });

            const response = await Promise.race([responsePromise, timeoutPromise]);
            const content = response.content || '{}';

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

            const responsePromise = this.llmService.chat([{
                role: 'system',
                content: 'You are a CLI expert. Suggest corrected commands based on errors. Return only valid JSON.'
            }, {
                role: 'user',
                content: prompt
            }], 'gpt-4o');

            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Request timed out')), TIMEOUT_MS);
            });

            const response = await Promise.race([responsePromise, timeoutPromise]);
            const content = response.content || '{}';

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
                const parsed = JSON.parse(match[0]) as Record<string, unknown>;
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
                const parsed = JSON.parse(match[0]) as Record<string, unknown>;
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
                const parsed = JSON.parse(match[0]) as Record<string, unknown>;
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
}
