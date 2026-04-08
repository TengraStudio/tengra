import {
    buildAiPresentationMetadata,
    calculateToolCallSignature,
    classifyAiIntent,
    composeDeterministicAnswer,
    getAiToolLoopBudget,
    isLowSignalProgressContent,
} from '@shared/utils/ai-runtime.util';
import { describe, expect, it } from 'vitest';

import { Message, ToolCall, ToolResult } from '@/types';

function createUserMessage(content: string): Message {
    return {
        id: 'user-1',
        role: 'user',
        content,
        timestamp: new Date(),
    };
}

function createToolCall(id: string, name: string, args: string): ToolCall {
    return {
        id,
        type: 'function',
        function: {
            name,
            arguments: args,
        },
    };
}

describe('ai-runtime.util', () => {
    it('classifies simple desktop count requests as single lookup', () => {
        const classification = classifyAiIntent(
            createUserMessage('masaüstümde kaç adet dosya var'),
            'fast'
        );

        expect(classification.intent).toBe('single_lookup');
        expect(classification.requiresTooling).toBe(true);
        expect(getAiToolLoopBudget(classification)).toMatchObject({
            maxExecutedToolTurns: 2,
            maxModelTurns: 4,
        });
    });

    it('normalizes repeated tool signatures across equivalent Windows paths', () => {
        const left = calculateToolCallSignature([
            createToolCall('call-1', 'list_directory', '{"path":"%USERPROFILE%\\\\Desktop"}'),
        ]);
        const right = calculateToolCallSignature([
            createToolCall('call-2', 'list_directory', '{"path":"%USERPROFILE%/Desktop"}'),
        ]);

        expect(left).toBe(right);
    });

    it('normalizes repeated execute_command signatures across Windows env-var variants', () => {
        const left = calculateToolCallSignature([
            createToolCall('call-1', 'execute_command', '{"command":"if (!(Test-Path \\"$env:USERPROFILE\\\\Desktop\\\\projects\\")) { New-Item -ItemType Directory -Path \\"$env:USERPROFILE\\\\Desktop\\\\projects\\" }"}'),
        ]);
        const right = calculateToolCallSignature([
            createToolCall('call-2', 'execute_command', '{"command":"if (-not (Test-Path \\"%USERPROFILE%/Desktop/projects\\")) { New-Item -ItemType Directory -Path \\"%USERPROFILE%/Desktop/projects\\" }"}'),
        ]);

        expect(left).toBe(right);
    });

    it('marks low-signal in-progress text as recoverable', () => {
        expect(isLowSignalProgressContent('masaüstünüzdeki dosyaları kontrol ediyorum')).toBe(true);
        expect(isLowSignalProgressContent('Masaüstünüzde 12 dosya var.')).toBe(false);
    });

    it('classifies local project creation requests as agentic work outside agent mode', () => {
        const classification = classifyAiIntent(
            createUserMessage('projects klasörüne bir NextJS todo app oluştur'),
            'fast'
        );

        expect(classification.intent).toBe('agentic_workflow');
        expect(classification.requiresTooling).toBe(true);
        expect(getAiToolLoopBudget(classification)).toMatchObject({
            maxExecutedToolTurns: 16,
            maxModelTurns: 24,
        });
    });

    it('composes deterministic answers from structured directory and file write evidence', () => {
        const directoryAnswer = composeDeterministicAnswer({
            intent: 'single_lookup',
            content: '',
            language: 'tr',
            toolResults: [{
                toolCallId: 'call-1',
                name: 'list_directory',
                result: {
                    path: '%USERPROFILE%/Desktop/projects',
                    entryCount: 4,
                    fileCount: 1,
                    directoryCount: 3,
                },
                success: true,
            }],
        });
        const writeAnswer = composeDeterministicAnswer({
            intent: 'agentic_workflow',
            content: '',
            language: 'en',
            toolResults: [{
                toolCallId: 'call-2',
                name: 'write_file',
                result: {
                    displaySummary: 'Wrote 47 bytes to C:/repo/app/page.tsx',
                },
                success: true,
            }],
        });

        expect(directoryAnswer).toContain('1 dosya ve 3 klasor');
        expect(writeAnswer).toBe('Completed tool work: Wrote 47 bytes to C:/repo/app/page.tsx');
    });

    it('builds consistent presentation metadata from tool evidence', () => {
        const toolResults: ToolResult[] = [{
            toolCallId: 'call-1',
            name: 'list_directory',
            result: {
                entryCount: 8,
                _reused: true,
            },
            success: true,
        }];

        const metadata = buildAiPresentationMetadata({
            intent: 'single_lookup',
            content: 'Masaüstünüzde 8 dosya var.',
            reasoning: 'Desktop dizini okundu ve dosya sayisi hesaplandi.',
            toolCalls: [createToolCall('call-1', 'list_directory', '{"path":"%USERPROFILE%/Desktop"}')],
            toolResults,
            sources: [],
            images: [],
        });

        expect(metadata.intent).toBe('single_lookup');
        expect(metadata.stage).toBe('answer_ready');
        expect(metadata.toolCallCount).toBe(1);
        expect(metadata.toolResultCount).toBe(1);
        expect(metadata.reusedToolResultCount).toBe(1);
        expect(metadata.hasReasoning).toBe(true);
    });

    it('caps excessive tool-loop budgets to avoid runaway iterations', () => {
        const classification = classifyAiIntent(
            createUserMessage('masaustumu organize et'),
            'agent'
        );
        const budget = getAiToolLoopBudget(classification);
        expect(budget.maxModelTurns).toBe(96);
        expect(budget.maxExecutedToolTurns).toBe(64);
        expect(budget.noProgressThreshold).toBe(5);
    });
});
