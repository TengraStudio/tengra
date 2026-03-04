import { AgentRegistryService } from '@main/services/project/agent/agent-registry.service';
import { AgentProfile } from '@shared/types/project-agent';

interface ProjectAgentProfileManagerDeps {
    registryService: AgentRegistryService;
}

export class ProjectAgentProfileManager {
    constructor(private readonly deps: ProjectAgentProfileManagerDeps) {}

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
