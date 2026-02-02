import { BaseService } from '@main/services/base.service';
import { appLogger } from '@main/logging/logger';
import { AgentProfile } from '@shared/types/project-agent';
import { PROJECT_AGENT_SYSTEM_PROMPT } from '../project-agent.prompts';

export class AgentRegistryService extends BaseService {
    private profiles: Map<string, AgentProfile> = new Map();

    constructor() {
        super('AgentRegistryService');
        this.registerDefaultProfiles();
    }

    async initialize(): Promise<void> {
        appLogger.info('AgentRegistryService', 'Initializing...');
    }

    private registerDefaultProfiles(): void {
        const defaultProfile: AgentProfile = {
            id: 'default',
            name: 'Standard Agent',
            role: 'Senior Full-Stack Engineer',
            persona: 'Professional, focused, relentless.',
            systemPrompt: PROJECT_AGENT_SYSTEM_PROMPT,
            skills: ['full-stack', 'problem-solving']
        };

        const architectProfile: AgentProfile = {
            id: 'architect',
            name: 'System Architect',
            role: 'Chief Software Architect',
            persona: 'Visionary, structured, detail-oriented.',
            systemPrompt: `${PROJECT_AGENT_SYSTEM_PROMPT}\n\nAdditional Directive: Prioritize long-term maintainability and system architecture.`,
            skills: ['architecture', 'design-patterns', 'scalability']
        };

        this.profiles.set(defaultProfile.id, defaultProfile);
        this.profiles.set(architectProfile.id, architectProfile);
    }

    public getProfile(id?: string): AgentProfile {
        return this.profiles.get(id || 'default') || this.profiles.get('default')!;
    }

    public registerProfile(profile: AgentProfile): void {
        this.profiles.set(profile.id, profile);
        appLogger.info('AgentRegistryService', `Registered agent profile: ${profile.name} (${profile.id})`);
    }

    public getAllProfiles(): AgentProfile[] {
        return Array.from(this.profiles.values());
    }
}
