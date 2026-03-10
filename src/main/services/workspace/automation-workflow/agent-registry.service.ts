import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { AgentProfile } from '@shared/types/automation-workflow';

import { AUTOMATION_WORKFLOW_SYSTEM_PROMPT } from '../automation-workflow.prompts';

export class AgentRegistryService extends BaseService {
    private profiles: Map<string, AgentProfile> = new Map();

    constructor(private db: DatabaseService) {
        super('AgentRegistryService');
    }

    async initialize(): Promise<void> {
        appLogger.info('AgentRegistryService', 'Initializing and loading profiles...');
        this.registerDefaultProfiles();
        await this.loadProfilesFromDb();
    }

    private registerDefaultProfiles(): void {
        const defaultProfile: AgentProfile = {
            id: 'default',
            name: 'Standard Agent',
            role: 'Senior Full-Stack Engineer',
            persona: 'Professional, focused, relentless.',
            systemPrompt: AUTOMATION_WORKFLOW_SYSTEM_PROMPT,
            skills: ['full-stack', 'problem-solving']
        };

        const architectProfile: AgentProfile = {
            id: 'architect',
            name: 'System Architect',
            role: 'Chief Software Architect',
            persona: 'Visionary, structured, detail-oriented.',
            systemPrompt: `${AUTOMATION_WORKFLOW_SYSTEM_PROMPT}\n\nAdditional Directive: Prioritize long-term maintainability and system architecture.`,
            skills: ['architecture', 'design-patterns', 'scalability']
        };

        this.profiles.set(defaultProfile.id, defaultProfile);
        this.profiles.set(architectProfile.id, architectProfile);
    }

    private async loadProfilesFromDb(): Promise<void> {
        try {
            const dbProfiles = await this.db.getAgentProfiles();
            for (const profile of dbProfiles) {
                // System profiles cannot be overwritten by DB profiles (security measure)
                if (!['default', 'architect'].includes(profile.id)) {
                    this.profiles.set(profile.id, profile);
                }
            }
            appLogger.info('AgentRegistryService', `Loaded ${dbProfiles.length} custom profiles from database`);
        } catch (error) {
            appLogger.error('AgentRegistryService', 'Failed to load profiles from database', error as Error);
        }
    }

    public getProfile(id?: string): AgentProfile {
        const profile = this.profiles.get(id ?? 'default');
        if (profile) {
            return profile;
        }

        const defaultProfile = this.profiles.get('default');
        if (!defaultProfile) {
            throw new Error('Default agent profile not found');
        }
        return defaultProfile;
    }

    public async registerProfile(profile: AgentProfile): Promise<void> {
        this.validateProfile(profile);
        this.profiles.set(profile.id, profile);
        await this.db.saveAgentProfile(profile);
        appLogger.info('AgentRegistryService', `Registered and saved agent profile: ${profile.name} (${profile.id})`);
    }

    public async deleteProfile(id: string): Promise<void> {
        this.validatePermissions(id);
        if (this.profiles.has(id)) {
            this.profiles.delete(id);
            await this.db.deleteAgentProfile(id);
            appLogger.info('AgentRegistryService', `Deleted agent profile: ${id}`);
        }
    }

    private validateProfile(profile: AgentProfile): void {
        this.validatePermissions(profile.id);
        this.validateFields(profile);
    }

    private validatePermissions(id: string): void {
        // AGENT-001-3: Permission validation
        if (['default', 'architect'].includes(id)) {
            appLogger.warn('AgentRegistryService', `Attempt to overwrite system profile prevented: ${id}`);
            throw new Error(`Cannot overwrite system profile: ${id}`);
        }
    }

    private validateFields(profile: AgentProfile): void {
        this.validateString(profile.name, 3, 50, 'Agent name');
        this.validateString(profile.role, 3, 50, 'Agent role');
        this.validateString(profile.persona, 0, 500, 'Agent persona');

        if (profile.systemPrompt && profile.systemPrompt.length > 5000) {
            throw new Error('System prompt exceeds 5000 characters');
        }

        if (!Array.isArray(profile.skills as unknown)) {
            throw new Error('Skills must be an array');
        }
    }

    private validateString(value: string | undefined, min: number, max: number, fieldName: string): void {
        if (!value) {
            if (min > 0) {
                throw new Error(`${fieldName} is required`);
            }
            return;
        }
        if (value.length < min || value.length > max) {
            throw new Error(`${fieldName} must be between ${min} and ${max} characters`);
        }
    }

    public getAllProfiles(): AgentProfile[] {
        return Array.from(this.profiles.values());
    }
}

