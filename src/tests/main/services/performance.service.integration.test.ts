import { PerformanceService } from '@main/services/analysis/performance.service';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: {
        getAppMetrics: vi.fn().mockReturnValue([]),
    },
}));

describe('PerformanceService integration', () => {
    it('initializes, reports memory stats, and cleans up', async () => {
        const service = new PerformanceService();
        await service.initialize();

        const mem = service.getMemoryStats();
        expect(mem.success).toBe(true);
        expect(mem.data?.main).toBeDefined();
        expect(typeof mem.data?.timestamp).toBe('number');

        const leak = await service.detectLeak();
        expect(leak.success).toBe(true);

        await service.cleanup();
    });
});
