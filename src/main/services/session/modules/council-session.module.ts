/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CouncilCapabilityService } from '@main/services/session/capabilities/council-capability.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import {
    SessionMode,
    SessionState,
    SessionStatus,
    SessionSubmitMessageOptions,
} from '@shared/types/session-engine';

import { SessionRuntimeModule } from '../base-session-engine.service';

export class CouncilSessionModule implements SessionRuntimeModule {
    readonly id = 'council' as const;

    constructor(
        private readonly eventBus: EventBusService,
        private readonly councilCapabilityService: CouncilCapabilityService
    ) {}

    supportsMode(mode: SessionMode): boolean {
        return ['chat', 'workspace'].includes(mode);
    }

    async onAttach(state: SessionState): Promise<void> {
        this.eventBus.emitCustom('session:capability:council', {
            phase: 'attached',
            sessionId: state.id,
            mode: state.mode,
            taskId: state.metadata.taskId ?? null,
        });
    }

    async onBeforeMessage(
        state: SessionState,
        options: SessionSubmitMessageOptions
    ): Promise<void> {
        const preview = options.message.content.slice(0, 160);
        const taskId = state.metadata.taskId;



        this.eventBus.emitCustom('session:capability:council', {
            phase: 'message',
            sessionId: state.id,
            mode: state.mode,
            taskId: taskId ?? null,
            preview,
        });
    }

    async onStatusChange(state: SessionState, previousStatus: SessionStatus): Promise<void> {
        this.eventBus.emitCustom('session:capability:council', {
            phase: 'status',
            sessionId: state.id,
            mode: state.mode,
            taskId: state.metadata.taskId ?? null,
            previousStatus,
            nextStatus: state.status,
            councilReady: typeof this.councilCapabilityService.prepareCouncilPlan === 'function',
        });
    }
}
