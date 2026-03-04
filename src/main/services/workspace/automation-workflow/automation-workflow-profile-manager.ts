import { AgentRegistryService } from '@main/services/workspace/automation-workflow/agent-registry.service';
import { AgentProfile } from '@shared/types/automation-workflow';

interface AutomationWorkflowProfileManagerDeps {
    registryService: AgentRegistryService;
}

export class AutomationWorkflowProfileManager {
    constructor(private readonly deps: AutomationWorkflowProfileManagerDeps) { }

    async getProfiles(): Promise<AgentProfile[]> {
        return this.deps.registryService.getAllProfiles();
    }

    async registerProfile(profile: AgentProfile): Promise<AgentProfile> {
        await this.deps.registryService.registerProfile(profile);
        return profile;
    }

    async deleteProfile(id: string): Promise<boolean> {
        await this.deps.registryService.deleteProfile(id);
        return true;
    }
}
