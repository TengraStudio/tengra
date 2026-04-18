/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
