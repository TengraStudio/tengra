/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { SessionRuntimeModule } from '@main/services/session/base-session-engine.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import {
    SessionMode,
    SessionState,
    SessionStatus,
} from '@shared/types/session-engine';

export class TaskPlanningSessionModule implements SessionRuntimeModule {
    readonly id = 'task_planning' as const;

    constructor(private readonly eventBus: EventBusService) {}

    supportsMode(mode: SessionMode): boolean {
        return mode === 'automation';
    }

    async onAttach(state: SessionState): Promise<void> {
        this.eventBus.emitCustom('session:capability:task-planning', {
            phase: 'attached',
            sessionId: state.id,
            taskId: state.metadata.taskId ?? null,
        });
    }

    async onStatusChange(state: SessionState, previousStatus: SessionStatus): Promise<void> {
        if (!['preparing', 'waiting_for_input'].includes(state.status)) {
            return;
        }

        this.eventBus.emitCustom('session:capability:task-planning', {
            phase: 'status',
            sessionId: state.id,
            taskId: state.metadata.taskId ?? null,
            previousStatus,
            nextStatus: state.status,
        });
    }
}

