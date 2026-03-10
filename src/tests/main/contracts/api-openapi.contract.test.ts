import { describe, expect, it, vi } from 'vitest';

describe('API Contract', () => {
    it('has valid high-level OpenAPI structure in source file', async () => {
        const fs = await vi.importActual<typeof import('node:fs')>('node:fs');
        const path = await vi.importActual<typeof import('node:path')>('node:path');
        const ROOT = process.cwd();
        const OPENAPI_FILE = path.join(ROOT, 'tengra-api.openapi.yaml');
        expect(fs.existsSync(OPENAPI_FILE)).toBe(true);
        const content = fs.readFileSync(OPENAPI_FILE, 'utf8');
        expect(content).toContain('openapi:');
        expect(content).toContain('paths:');
        expect(content).toContain('components:');
    });
});


