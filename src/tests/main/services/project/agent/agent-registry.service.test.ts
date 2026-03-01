import { AgentRegistryService } from '@main/services/project/agent/agent-registry.service';
import { AgentProfile } from '@shared/types/project-agent';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('@main/services/project/project-agent.prompts', () => ({
    PROJECT_AGENT_SYSTEM_PROMPT: 'You are an AI agent.',
}));

interface MockDatabaseService {
    getAgentProfiles: ReturnType<typeof vi.fn>;
    saveAgentProfile: ReturnType<typeof vi.fn>;
    deleteAgentProfile: ReturnType<typeof vi.fn>;
}

function createMockDb(): MockDatabaseService {
    return {
        getAgentProfiles: vi.fn().mockResolvedValue([]),
        saveAgentProfile: vi.fn().mockResolvedValue(undefined),
        deleteAgentProfile: vi.fn().mockResolvedValue(undefined),
    };
}

describe('AgentRegistryService', () => {
    let service: AgentRegistryService;
    let mockDb: MockDatabaseService;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockDb = createMockDb();
        service = new AgentRegistryService(mockDb as never);
        await service.initialize();
    });

    describe('initialize', () => {
        it('should register default profiles', () => {
            const defaultProfile = service.getProfile('default');
            expect(defaultProfile).toBeDefined();
            expect(defaultProfile.name).toBe('Standard Agent');

            const architectProfile = service.getProfile('architect');
            expect(architectProfile).toBeDefined();
            expect(architectProfile.name).toBe('System Architect');
        });

        it('should load custom profiles from database', async () => {
            const customProfile: AgentProfile = {
                id: 'custom-1',
                name: 'Custom Agent',
                role: 'Backend Developer',
                persona: 'Efficient and pragmatic.',
                systemPrompt: 'You are a backend dev.',
                skills: ['backend', 'databases'],
            };
            mockDb.getAgentProfiles.mockResolvedValue([customProfile]);

            const svc = new AgentRegistryService(mockDb as never);
            await svc.initialize();

            expect(svc.getProfile('custom-1')).toEqual(customProfile);
        });

        it('should not overwrite system profiles from database', async () => {
            const fakeDefault: AgentProfile = {
                id: 'default',
                name: 'Hacked Default',
                role: 'Hacker',
                persona: 'Evil',
                systemPrompt: 'Hack everything',
                skills: ['hacking'],
            };
            mockDb.getAgentProfiles.mockResolvedValue([fakeDefault]);

            const svc = new AgentRegistryService(mockDb as never);
            await svc.initialize();

            expect(svc.getProfile('default').name).toBe('Standard Agent');
        });

        it('should handle database load failure gracefully', async () => {
            mockDb.getAgentProfiles.mockRejectedValue(new Error('DB error'));
            const svc = new AgentRegistryService(mockDb as never);
            await svc.initialize(); // should not throw
        });
    });

    describe('getProfile', () => {
        it('should return default profile when id is undefined', () => {
            const profile = service.getProfile(undefined);
            expect(profile.id).toBe('default');
        });

        it('should return default profile for unknown id', () => {
            const profile = service.getProfile('nonexistent');
            expect(profile.id).toBe('default');
        });

        it('should return specific profile by id', () => {
            const profile = service.getProfile('architect');
            expect(profile.id).toBe('architect');
        });
    });

    describe('registerProfile', () => {
        it('should register and save a custom profile', async () => {
            const profile: AgentProfile = {
                id: 'custom-agent',
                name: 'Custom Agent',
                role: 'Frontend Developer',
                persona: 'Creative and thorough.',
                systemPrompt: 'You build UIs.',
                skills: ['react', 'css'],
            };

            await service.registerProfile(profile);

            expect(service.getProfile('custom-agent')).toEqual(profile);
            expect(mockDb.saveAgentProfile).toHaveBeenCalledWith(profile);
        });

        it('should reject overwriting system profiles', async () => {
            const profile: AgentProfile = {
                id: 'default',
                name: 'Hacked Default',
                role: 'Hacker Role',
                persona: 'Evil persona.',
                systemPrompt: 'Evil prompt',
                skills: ['evil'],
            };

            await expect(service.registerProfile(profile)).rejects.toThrow(
                'Cannot overwrite system profile: default'
            );
        });

        it('should validate name length', async () => {
            const profile: AgentProfile = {
                id: 'bad-name',
                name: 'AB',
                role: 'Some Role Here',
                persona: 'Some persona.',
                systemPrompt: 'Prompt',
                skills: ['skill'],
            };

            await expect(service.registerProfile(profile)).rejects.toThrow(
                'Agent name must be between 3 and 50 characters'
            );
        });

        it('should validate system prompt length', async () => {
            const profile: AgentProfile = {
                id: 'long-prompt',
                name: 'Long Prompt Agent',
                role: 'Some Role Here',
                persona: 'Some persona.',
                systemPrompt: 'x'.repeat(5001),
                skills: ['skill'],
            };

            await expect(service.registerProfile(profile)).rejects.toThrow(
                'System prompt exceeds 5000 characters'
            );
        });
    });

    describe('deleteProfile', () => {
        it('should delete a custom profile', async () => {
            const profile: AgentProfile = {
                id: 'to-delete',
                name: 'Deletable Agent',
                role: 'Temp Role Here',
                persona: 'Temporary.',
                systemPrompt: 'Temp prompt',
                skills: ['temp'],
            };

            await service.registerProfile(profile);
            await service.deleteProfile('to-delete');

            // Should fall back to default
            expect(service.getProfile('to-delete').id).toBe('default');
            expect(mockDb.deleteAgentProfile).toHaveBeenCalledWith('to-delete');
        });

        it('should reject deleting system profiles', async () => {
            await expect(service.deleteProfile('default')).rejects.toThrow(
                'Cannot overwrite system profile: default'
            );
        });
    });

    describe('getAllProfiles', () => {
        it('should return all registered profiles', () => {
            const profiles = service.getAllProfiles();
            expect(profiles.length).toBeGreaterThanOrEqual(2);
            expect(profiles.some(p => p.id === 'default')).toBe(true);
            expect(profiles.some(p => p.id === 'architect')).toBe(true);
        });
    });
});
