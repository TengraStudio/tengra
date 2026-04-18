/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { EventBusService } from '@main/services/system/event-bus.service';
import {
    SessionMode,
    SessionState,
    SessionStatus,
} from '@shared/types/session-engine';

import { SessionRuntimeModule } from '../base-session-engine.service';

export class RecoverySessionModule implements SessionRuntimeModule {
    readonly id = 'recovery' as const;

    constructor(private readonly eventBus: EventBusService) {}

    supportsMode(_mode: SessionMode): boolean {
        return true;
    }

    async onAttach(state: SessionState): Promise<void> {
        this.eventBus.emitCustom('session:capability:recovery', {
            phase: 'attached',
            sessionId: state.id,
            mode: state.mode,
            lastError: state.lastError ?? null,
            recovery: state.recovery,
        });
    }

    async onStatusChange(state: SessionState, previousStatus: SessionStatus): Promise<void> {
        if (!['interrupted', 'failed', 'completed'].includes(state.status)) {
            return;
        }

        this.eventBus.emitCustom('session:capability:recovery', {
            phase: 'status',
            sessionId: state.id,
            mode: state.mode,
            previousStatus,
            nextStatus: state.status,
            recoveryHint: state.lastError ?? null,
            recovery: state.recovery,
        });
    }
}
