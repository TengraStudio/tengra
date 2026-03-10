import { randomUUID } from 'crypto';

import { BaseService } from '@main/services/base.service';
import {
    AgentCollaborationIntent,
    AgentCollaborationMessage,
    AgentCollaborationPriority,
} from '@shared/types/automation-workflow';

const MAX_COLLABORATION_PAYLOAD_KEYS = 32;
const MAX_COLLABORATION_STRING_LENGTH = 4000;
const COLLABORATION_LOOP_WINDOW_MS = 5 * 60 * 1000;
const COLLABORATION_LOOP_THRESHOLD = 3;

/**
 * AgentMessagingService
 * Extracted from AgentCollaborationService to handle all agent messaging logic.
 * AI-SYS-14 refactor.
 */
export class AgentMessagingService extends BaseService {
    private messages = new Map<string, AgentCollaborationMessage[]>();

    constructor() {
        super('AgentMessagingService');
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing Agent Messaging Service...');
    }

    createMessage(input: {
        taskId: string;
        stageId: string;
        fromAgentId: string;
        toAgentId?: string;
        intent: AgentCollaborationIntent;
        priority?: AgentCollaborationPriority;
        payload: Record<string, string | number | boolean | null>;
        expiresAt?: number;
    }): AgentCollaborationMessage {
        if (!input.taskId) { throw new Error('taskId is required'); }
        if (!input.stageId) { throw new Error('stageId is required'); }
        if (!input.fromAgentId) { throw new Error('fromAgentId is required'); }

        return {
            id: randomUUID(),
            taskId: input.taskId,
            stageId: input.stageId,
            fromAgentId: input.fromAgentId,
            toAgentId: input.toAgentId,
            channel: input.toAgentId ? 'private' : 'group',
            intent: input.intent,
            priority: input.priority ?? 'normal',
            payload: input.payload,
            createdAt: Date.now(),
            expiresAt: input.expiresAt
        };
    }

    sendMessage(input: {
        taskId: string;
        stageId: string;
        fromAgentId: string;
        toAgentId?: string;
        intent: AgentCollaborationIntent;
        priority?: AgentCollaborationPriority;
        payload: Record<string, string | number | boolean | null>;
        expiresAt?: number;
    }): AgentCollaborationMessage {
        this.validatePayload(input.payload);
        this.enforceAntiLoop(input);

        const message = this.createMessage(input);
        const taskMessages = this.messages.get(message.taskId) ?? [];
        this.messages.set(message.taskId, [...taskMessages, message]);

        return message;
    }

    getMessages(options: {
        taskId: string;
        stageId?: string;
        agentId?: string;
        includeExpired?: boolean;
    }): AgentCollaborationMessage[] {
        const allTaskMessages = this.messages.get(options.taskId) ?? [];
        const now = Date.now();

        return allTaskMessages.filter(message => {
            if (!options.includeExpired && message.expiresAt !== undefined && message.expiresAt <= now) {
                return false;
            }
            if (options.stageId && message.stageId !== options.stageId) {
                return false;
            }
            if (!options.agentId) {
                return true;
            }
            if (message.channel === 'group') {
                return true;
            }
            return message.fromAgentId === options.agentId || message.toAgentId === options.agentId;
        });
    }

    cleanupExpired(taskId?: string): number {
        const now = Date.now();
        let removedCount = 0;
        const targetTaskIds = taskId
            ? [taskId]
            : Array.from(this.messages.keys());

        for (const currentTaskId of targetTaskIds) {
            const currentMessages = this.messages.get(currentTaskId);
            if (!currentMessages || currentMessages.length === 0) {
                continue;
            }
            const filtered = currentMessages.filter(
                message => message.expiresAt === undefined || message.expiresAt > now
            );
            removedCount += currentMessages.length - filtered.length;
            if (filtered.length === 0) {
                this.messages.delete(currentTaskId);
            } else {
                this.messages.set(currentTaskId, filtered);
            }
        }

        return removedCount;
    }

    restoreMessages(taskId: string, messages: AgentCollaborationMessage[]): void {
        this.messages.set(taskId, [...messages]);
    }

    private validatePayload(payload: Record<string, string | number | boolean | null>): void {
        const keys = Object.keys(payload);
        if (keys.length > MAX_COLLABORATION_PAYLOAD_KEYS) {
            throw new Error(`Collaboration payload has too many keys (${keys.length})`);
        }

        for (const [key, value] of Object.entries(payload)) {
            if (key.length > 120) { throw new Error(`Collaboration payload key is too long (${key.length})`); }
            if (typeof value === 'string' && value.length > MAX_COLLABORATION_STRING_LENGTH) {
                throw new Error(`Collaboration payload value for "${key}" is too long (${value.length})`);
            }
        }
    }

    private enforceAntiLoop(input: {
        taskId: string;
        fromAgentId: string;
        toAgentId?: string;
        intent: AgentCollaborationIntent;
        payload: Record<string, string | number | boolean | null>;
    }): void {
        const recent = this.messages.get(input.taskId) ?? [];
        const now = Date.now();
        const signature = this.buildSignature(input);
        let repeatedCount = 0;

        for (let index = recent.length - 1; index >= 0; index -= 1) {
            const message = recent[index];
            if (now - message.createdAt > COLLABORATION_LOOP_WINDOW_MS) {
                break;
            }
            const messageSignature = this.buildSignature({
                taskId: message.taskId,
                fromAgentId: message.fromAgentId,
                toAgentId: message.toAgentId,
                intent: message.intent,
                payload: message.payload
            });
            if (messageSignature === signature) {
                repeatedCount += 1;
            }
            if (repeatedCount >= COLLABORATION_LOOP_THRESHOLD) {
                throw new Error('Collaboration cascade detected. Messaging throttled.');
            }
        }
    }

    private buildSignature(input: {
        taskId: string;
        fromAgentId: string;
        toAgentId?: string;
        intent: AgentCollaborationIntent;
        payload: Record<string, string | number | boolean | null>;
    }): string {
        return `${input.taskId}:${input.fromAgentId}:${input.toAgentId || 'all'}:${input.intent}:${JSON.stringify(input.payload)}`;
    }

    override async cleanup(): Promise<void> {
        this.messages.clear();
    }
}

