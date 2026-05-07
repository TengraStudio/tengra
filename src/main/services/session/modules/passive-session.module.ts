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
    SessionCapability,
    SessionMode,
    SessionState,
    SessionStatus,
} from '@shared/types/session-engine';

export class PassiveSessionModule implements SessionRuntimeModule {
    constructor(
        readonly id: SessionCapability,
        private readonly eventBus: EventBusService,
        private readonly supportedModes: SessionMode[],
        private readonly eventName: string
    ) {}

    supportsMode(mode: SessionMode): boolean {
        return this.supportedModes.includes(mode);
    }

    async onAttach(state: SessionState): Promise<void> {
        this.eventBus.emitCustom(this.eventName, {
            phase: 'attached',
            sessionId: state.id,
            mode: state.mode,
        });
    }

    async onStatusChange(state: SessionState, previousStatus: SessionStatus): Promise<void> {
        this.eventBus.emitCustom(this.eventName, {
            phase: 'status',
            sessionId: state.id,
            mode: state.mode,
            previousStatus,
            nextStatus: state.status,
        });
    }
}

