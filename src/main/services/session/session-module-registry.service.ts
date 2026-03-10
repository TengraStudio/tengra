import { BaseService } from '@main/services/base.service';
import { CouncilCapabilityService } from '@main/services/session/capabilities/council-capability.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { AgentCollaborationService } from '@main/services/workspace/automation-workflow/agent-collaboration.service';
import { SESSION_CAPABILITY_DESCRIPTORS } from '@shared/constants/session-capabilities';
import {
    SessionCapability,
    SessionCapabilityDescriptor,
    SessionMode,
} from '@shared/types/session-engine';

import { CouncilSessionModule } from './modules/council-session.module';
import { PassiveSessionModule } from './modules/passive-session.module';
import { RecoverySessionModule } from './modules/recovery-session.module';
import { TaskExecutionSessionModule } from './modules/task-execution-session.module';
import { TaskPlanningSessionModule } from './modules/task-planning-session.module';
import { WorkspaceContextSessionModule } from './modules/workspace-context-session.module';
import { SessionRuntimeModule } from './base-session-engine.service';

export class SessionModuleRegistryService extends BaseService {
    private readonly modules = new Map<SessionCapability, SessionRuntimeModule>();

    constructor(
        eventBus: EventBusService,
        collaborationService: AgentCollaborationService,
        councilCapabilityService: CouncilCapabilityService
    ) {
        super('SessionModuleRegistryService');

        this.registerModule(
            new CouncilSessionModule(
                eventBus,
                collaborationService,
                councilCapabilityService
            )
        );
        this.registerModule(new RecoverySessionModule(eventBus));
        this.registerModule(new WorkspaceContextSessionModule(eventBus));
        this.registerModule(new TaskPlanningSessionModule(eventBus));
        this.registerModule(new TaskExecutionSessionModule(eventBus));
        this.registerModule(
            new PassiveSessionModule('tools', eventBus, ['chat', 'workspace', 'automation'], 'session:capability:tools')
        );
        this.registerModule(
            new PassiveSessionModule('rag', eventBus, ['chat', 'workspace', 'automation'], 'session:capability:rag')
        );
        this.registerModule(
            new PassiveSessionModule('image_generation', eventBus, ['chat', 'workspace'], 'session:capability:image-generation')
        );
        this.registerModule(
            new PassiveSessionModule('checkpoints', eventBus, ['automation'], 'session:capability:checkpoints')
        );
    }

    getModules(): SessionRuntimeModule[] {
        return Array.from(this.modules.values());
    }

    getModulesForCapabilities(capabilities: SessionCapability[]): SessionRuntimeModule[] {
        return capabilities
            .map(capability => this.modules.get(capability))
            .filter((module): module is SessionRuntimeModule => Boolean(module));
    }

    getModulesForMode(mode: SessionMode): SessionRuntimeModule[] {
        return this.getModules().filter(module => module.supportsMode(mode));
    }

    listCapabilityDescriptors(): SessionCapabilityDescriptor[] {
        return SESSION_CAPABILITY_DESCRIPTORS.filter(descriptor => this.modules.has(descriptor.id));
    }

    hasModule(capability: SessionCapability): boolean {
        return this.modules.has(capability);
    }

    private registerModule(module: SessionRuntimeModule): void {
        this.modules.set(module.id, module);
    }
}
