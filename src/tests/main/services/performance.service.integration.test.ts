import { PerformanceService } from '@main/services/analysis/performance.service';
import { describe, expect, it } from 'vitest';

describe('PerformanceService integration', () => {
    it('initializes, reports memory stats, and cleans up', async () => {
        const service = new PerformanceService();
        await service.initialize();

        const mem = service.getMemoryStats();
        expect(mem.success).toBe(true);
        expect(mem.result?.main).toBeDefined();
        expect(typeof mem.result?.timestamp).toBe('number');

        const leak = await service.detectLeak();
        expect(leak.success).toBe(true);

        await service.cleanup();
    });
});

