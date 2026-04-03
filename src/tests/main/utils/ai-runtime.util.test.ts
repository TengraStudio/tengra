import {
    buildAiPresentationMetadata,
    calculateToolCallSignature,
    classifyAiIntent,
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

    it('marks low-signal in-progress text as recoverable', () => {
        expect(isLowSignalProgressContent('masaüstünüzdeki dosyaları kontrol ediyorum')).toBe(true);
        expect(isLowSignalProgressContent('Masaüstünüzde 12 dosya var.')).toBe(false);
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
});
