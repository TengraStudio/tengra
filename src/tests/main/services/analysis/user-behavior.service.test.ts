import { UserBehaviorService } from '@main/services/analysis/user-behavior.service';
import { DatabaseService } from '@main/services/data/database.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

describe('UserBehaviorService', () => {
    let service: UserBehaviorService;
    let mockDatabase: {
        userBehavior: {
            trackInteraction: ReturnType<typeof vi.fn>;
            getTopInteractions: ReturnType<typeof vi.fn>;
            getRecentInteractions: ReturnType<typeof vi.fn>;
        };
    };
    let mockEventBus: {
        on: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockDatabase = {
            userBehavior: {
                trackInteraction: vi.fn().mockResolvedValue(undefined),
                getTopInteractions: vi.fn().mockResolvedValue([]),
                getRecentInteractions: vi.fn().mockResolvedValue([])
            }
        };
        mockEventBus = {
            on: vi.fn().mockReturnValue(() => { /* unsubscribe */ })
        };
        service = new UserBehaviorService(
            mockDatabase as unknown as DatabaseService,
            mockEventBus as unknown as EventBusService
        );
    });

    describe('initialize', () => {
        it('should subscribe to user events', async () => {
            await service.initialize();
            expect(mockEventBus.on).toHaveBeenCalledWith('user:feature-used', expect.any(Function));
            expect(mockEventBus.on).toHaveBeenCalledWith('user:model-selected', expect.any(Function));
            expect(mockEventBus.on).toHaveBeenCalledWith('user:chat-sent', expect.any(Function));
            expect(mockEventBus.on).toHaveBeenCalledWith('user:shortcut-used', expect.any(Function));
        });
    });

    describe('dispose', () => {
        it('should unsubscribe from all events', async () => {
            const unsub = vi.fn();
            mockEventBus.on.mockReturnValue(unsub);
            await service.initialize();
            await service.dispose();
            expect(unsub).toHaveBeenCalledTimes(4);
        });
    });

    describe('getModelRecommendations', () => {
        it('should return top model selections', async () => {
            mockDatabase.userBehavior.getTopInteractions.mockResolvedValue([
                { eventKey: 'openai:gpt-4' },
                { eventKey: 'anthropic:claude-3' }
            ]);

            const result = await service.getModelRecommendations(2);
            expect(result).toEqual(['openai:gpt-4', 'anthropic:claude-3']);
            expect(mockDatabase.userBehavior.getTopInteractions).toHaveBeenCalledWith('model_selection', 2);
        });

        it('should default to limit 3', async () => {
            mockDatabase.userBehavior.getTopInteractions.mockResolvedValue([]);
            await service.getModelRecommendations();
            expect(mockDatabase.userBehavior.getTopInteractions).toHaveBeenCalledWith('model_selection', 3);
        });
    });

    describe('getFrequentFeatures', () => {
        it('should return top features', async () => {
            mockDatabase.userBehavior.getTopInteractions.mockResolvedValue([
                { eventKey: 'chat' },
                { eventKey: 'terminal' }
            ]);

            const result = await service.getFrequentFeatures(2);
            expect(result).toEqual(['chat', 'terminal']);
        });
    });

    describe('getRecentActivity', () => {
        it('should return recent interactions', async () => {
            const records = [{ id: '1', eventType: 'feature_usage' }];
            mockDatabase.userBehavior.getRecentInteractions.mockResolvedValue(records);

            const result = await service.getRecentActivity(10);
            expect(result).toEqual(records);
            expect(mockDatabase.userBehavior.getRecentInteractions).toHaveBeenCalledWith(10);
        });
    });

    describe('event handlers', () => {
        it('should track feature usage on event', async () => {
            await service.initialize();
            const handler = mockEventBus.on.mock.calls.find(
                (c: unknown[]) => c[0] === 'user:feature-used'
            )?.[1] as (payload: { featureId: string; metadata?: Record<string, unknown> }) => Promise<void>;

            await handler({ featureId: 'chat', metadata: {} });
            expect(mockDatabase.userBehavior.trackInteraction).toHaveBeenCalledWith(
                'feature_usage', 'chat', {}
            );
        });

        it('should track model selection on event', async () => {
            await service.initialize();
            const handler = mockEventBus.on.mock.calls.find(
                (c: unknown[]) => c[0] === 'user:model-selected'
            )?.[1] as (payload: { provider: string; modelId: string }) => Promise<void>;

            await handler({ provider: 'openai', modelId: 'gpt-4' });
            expect(mockDatabase.userBehavior.trackInteraction).toHaveBeenCalledWith(
                'model_selection', 'openai:gpt-4', { provider: 'openai', modelId: 'gpt-4' }
            );
        });

        it('should track chat sent on event', async () => {
            await service.initialize();
            const handler = mockEventBus.on.mock.calls.find(
                (c: unknown[]) => c[0] === 'user:chat-sent'
            )?.[1] as (payload: { modelId: string; messageLength: number }) => Promise<void>;

            await handler({ modelId: 'gpt-4', messageLength: 100 });
            expect(mockDatabase.userBehavior.trackInteraction).toHaveBeenCalledWith(
                'chat_activity', 'gpt-4', { messageLength: 100 }
            );
        });

        it('should track shortcut usage on event', async () => {
            await service.initialize();
            const handler = mockEventBus.on.mock.calls.find(
                (c: unknown[]) => c[0] === 'user:shortcut-used'
            )?.[1] as (payload: { shortcut: string }) => Promise<void>;

            await handler({ shortcut: 'ctrl+k' });
            expect(mockDatabase.userBehavior.trackInteraction).toHaveBeenCalledWith(
                'shortcut_usage', 'ctrl+k'
            );
        });
    });
});
