import { IdeaGeneratorService } from '@main/services/llm/idea-generator.service';
import type { IdeaCategory } from '@shared/types/ideas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('uuid', () => ({ v4: () => 'test-uuid' }));

const mockRun = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn().mockResolvedValue(null);
const mockAll = vi.fn().mockResolvedValue([]);
const mockPrepare = vi.fn().mockReturnValue({
    run: mockRun,
    get: mockGet,
    all: mockAll,
});

const mockDb = { prepare: mockPrepare };

const mockDatabaseService = {
    getDatabase: vi.fn().mockResolvedValue(mockDb),
};

const mockLlmService = {
    chat: vi.fn().mockResolvedValue({ content: '{}' }),
};

const mockMarketResearchService = {
    getDeepMarketData: vi.fn(),
};

const mockProjectScaffoldService = {};

const mockAuthService = {};

const mockEventBus = {
    emit: vi.fn(),
};

const mockLocalImageService = {};

const mockBrainService = {};

type IdeaGenDeps = ConstructorParameters<typeof IdeaGeneratorService>[0];

function createService(): IdeaGeneratorService {
    return new IdeaGeneratorService({
        databaseService: mockDatabaseService as unknown as IdeaGenDeps['databaseService'],
        llmService: mockLlmService as unknown as IdeaGenDeps['llmService'],
        marketResearchService: mockMarketResearchService as unknown as IdeaGenDeps['marketResearchService'],
        projectScaffoldService: mockProjectScaffoldService as unknown as IdeaGenDeps['projectScaffoldService'],
        authService: mockAuthService as unknown as IdeaGenDeps['authService'],
        eventBus: mockEventBus as unknown as IdeaGenDeps['eventBus'],
        localImageService: mockLocalImageService as unknown as IdeaGenDeps['localImageService'],
        brainService: mockBrainService as unknown as IdeaGenDeps['brainService'],
    });
}

describe('IdeaGeneratorService', () => {
    let service: IdeaGeneratorService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrepare.mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
        mockDatabaseService.getDatabase.mockResolvedValue(mockDb);
        mockGet.mockResolvedValue({ name: 'idea_sessions' });
        service = createService();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('initialize', () => {
        it('should initialize and ensure tables exist', async () => {
            await service.initialize();

            expect(mockDatabaseService.getDatabase).toHaveBeenCalled();
            expect(mockPrepare).toHaveBeenCalled();
        });

        it('should throw if database fails', async () => {
            mockDatabaseService.getDatabase.mockRejectedValueOnce(new Error('DB error'));

            await expect(service.initialize()).rejects.toThrow('DB error');
        });
    });

    describe('cleanup', () => {
        it('should cleanup without error', async () => {
            await expect(service.cleanup()).resolves.toBeUndefined();
        });
    });

    describe('createSession', () => {
        it('should create a session and return it', async () => {
            const config = {
                model: 'gpt-4o',
                provider: 'openai',
                categories: ['website' as IdeaCategory],
                maxIdeas: 5,
            };

            const session = await service.createSession(config);

            expect(session.id).toBe('test-uuid');
            expect(session.model).toBe('gpt-4o');
            expect(session.categories).toEqual(['saas']);
            expect(session.status).toBe('active');
            expect(mockRun).toHaveBeenCalled();
        });
    });

    describe('getSession', () => {
        it('should return null when session not found', async () => {
            mockGet.mockResolvedValueOnce(null);

            const session = await service.getSession('nonexistent');

            expect(session).toBeNull();
        });
    });

    describe('getSessions', () => {
        it('should return empty array when no sessions exist', async () => {
            mockAll.mockResolvedValueOnce([]);

            const sessions = await service.getSessions();

            expect(sessions).toEqual([]);
        });
    });

    describe('updateSessionStatus', () => {
        it('should update session status in database', async () => {
            await service.updateSessionStatus('session-1', 'completed');

            expect(mockRun).toHaveBeenCalled();
        });
    });

    describe('cancelSession', () => {
        it('should set session status to cancelled', async () => {
            await service.cancelSession('session-1');

            expect(mockRun).toHaveBeenCalled();
        });
    });

    describe('generateMarketPreview', () => {
        it('should generate market previews for categories', async () => {
            mockLlmService.chat.mockResolvedValue({
                content: JSON.stringify({
                    summary: 'Growing market',
                    keyTrends: ['AI', 'Cloud'],
                    marketSize: '$10B',
                    competition: 'High',
                }),
            });

            const previews = await service.generateMarketPreview(['website']);

            expect(previews).toHaveLength(1);
            expect(previews[0].category).toBe('website');
            expect(previews[0].summary).toBe('Growing market');
        });

        it('should handle LLM returning non-JSON', async () => {
            mockLlmService.chat.mockResolvedValue({ content: 'not json' });

            const previews = await service.generateMarketPreview(['website']);

            expect(previews).toHaveLength(1);
            expect(previews[0].summary).toBeDefined();
        });
    });

    describe('runResearchPipeline', () => {
        it('should throw if session not found', async () => {
            // getSession calls prepare().get() which needs to return null
            mockGet.mockResolvedValue(null);

            await expect(service.runResearchPipeline('bad-id')).rejects.toThrow('Session not found');
        });
    });
});
