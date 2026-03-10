import { EventBusService } from '@main/services/system/event-bus.service';
import {
    SessionCapability,
    SessionMode,
    SessionState,
    SessionStatus,
} from '@shared/types/session-engine';

import { SessionRuntimeModule } from '../base-session-engine.service';

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
