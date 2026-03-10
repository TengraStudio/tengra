import { AutomationSessionRegistryService } from '@main/services/session/automation-session-registry.service';
import { ChatSessionRegistryService } from '@main/services/session/chat-session-registry.service';
import { SessionDirectoryService } from '@main/services/session/session-directory.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SessionStartOptions } from '@shared/types/session-engine';
import { describe, expect, it } from 'vitest';

const createConversationSessionOptions = (
    sessionId: string,
    mode: SessionStartOptions['mode']
): SessionStartOptions => ({
    sessionId,
    mode,
    capabilities: ['recovery'],
    model: {
        provider: 'ollama',
        model: 'llama3.1:8b',
    },
    metadata: {
        title: `${mode} session`,
        sourceSurface: mode,
    },
    initialMessages: [
        {
            id: `${sessionId}:user`,
            role: 'user',
            content: `hello from ${mode}`,
            createdAt: 1,
        },
    ],
});

describe('session recovery contracts', () => {
    it('returns resumable recovery snapshots for interrupted chat and workspace sessions', async () => {
        const eventBus = new EventBusService();
        const registry = new ChatSessionRegistryService(eventBus);

        await registry.startSession(createConversationSessionOptions('chat-1', 'chat'));
        await registry.markInterrupted('chat-1', 'network dropped');

        await registry.startSession(
            createConversationSessionOptions('workspace-1', 'workspace')
        );
        await registry.markWaitingForInput('workspace-1');

        const snapshots = registry.listRecoverySnapshots();
        const workspaceSnapshot = snapshots.find(snapshot => snapshot.sessionId === 'workspace-1');
        const chatSnapshot = snapshots.find(snapshot => snapshot.sessionId === 'chat-1');

        expect(workspaceSnapshot?.recovery.canResume).toBe(true);
        expect(workspaceSnapshot?.recovery.action).toBe('resume_workspace');
        expect(workspaceSnapshot?.lastMessagePreview).toBe('hello from workspace');

        expect(chatSnapshot?.recovery.canResume).toBe(true);
        expect(chatSnapshot?.recovery.action).toBe('resume_conversation');
        expect(chatSnapshot?.recoveryHint).toBe('network dropped');
    });

    it('marks failed automation sessions as review-required and exposes them through the directory', async () => {
        const eventBus = new EventBusService();
        const automationRegistry = new AutomationSessionRegistryService(eventBus);
        const directory = new SessionDirectoryService();

        directory.registerRegistry('automation', automationRegistry);

        await automationRegistry.startSession({
            sessionId: 'task-1',
            mode: 'automation',
            capabilities: ['checkpoints', 'recovery', 'task_execution'],
            model: {
                provider: 'automation',
                model: 'automation',
            },
            metadata: {
                taskId: 'task-1',
                title: 'automation session',
                sourceSurface: 'automation-workflow',
            },
            initialMessages: [
                {
                    id: 'task-1:user',
                    role: 'user',
                    content: 'run task',
                    createdAt: 1,
                },
            ],
        });

        await automationRegistry.markFailed('task-1', 'quota exhausted');

        const [snapshot] = directory.listRecoverySnapshots();

        expect(snapshot.mode).toBe('automation');
        expect(snapshot.recovery.canResume).toBe(false);
        expect(snapshot.recovery.requiresReview).toBe(true);
        expect(snapshot.recovery.action).toBe('review_before_resume');
        expect(snapshot.recoveryHint).toBe('quota exhausted');
        expect(snapshot.lastMessagePreview).toBe('run task');
    });
});
