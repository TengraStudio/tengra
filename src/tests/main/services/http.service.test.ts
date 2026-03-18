import { HttpService } from '@main/services/external/http.service';
import { beforeEach,describe, expect, it, vi } from 'vitest';

interface MockHttpResponse {
    ok: boolean;
    status: number;
    statusText: string;
    headers: {
        forEach: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
    };
    json: () => Promise<RuntimeValue>;
    text: () => Promise<string>;
    clone: () => MockHttpResponse;
}

// Mock global fetch
const globalFetch = vi.fn();
global.fetch = globalFetch;

describe('HttpService', () => {
    let httpService: HttpService;

    beforeEach(() => {
        httpService = new HttpService();
        globalFetch.mockReset();
    });

    const createMockResponse = (overrides: Partial<MockHttpResponse> = {}): MockHttpResponse => {
        const response: MockHttpResponse = {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: {
                forEach: vi.fn(),
                get: vi.fn()
            },
            json: async () => ({}),
            text: async () => '',
            clone: () => response,
            ...overrides
        };
        return response;
    };

    it('should return successful response without retries', async () => {
        globalFetch.mockResolvedValueOnce(createMockResponse({
            json: async () => ({ data: 'success' })
        }));

        const response = await httpService.fetch('https://api.example.com/data');
        expect(response.ok).toBe(true);
        expect(globalFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network error and succeed', async () => {
        // First attempt fails (network error)
        globalFetch.mockRejectedValueOnce(new Error('Network error'));
        // Second attempt succeeds
        globalFetch.mockResolvedValueOnce(createMockResponse());

        const response = await httpService.fetch('https://api.example.com/retry', {
            retryCount: 2
        });

        expect(response.ok).toBe(true);
        expect(globalFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 5xx status and succeed', async () => {
        // First attempt fails (503 Service Unavailable)
        globalFetch.mockResolvedValueOnce(createMockResponse({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable'
        }));
        // Second attempt succeeds
        globalFetch.mockResolvedValueOnce(createMockResponse());

        const response = await httpService.fetch('https://api.example.com/status', {
            retryCount: 2
        });

        expect(response.ok).toBe(true);
        expect(globalFetch).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
        globalFetch.mockRejectedValue(new Error('Persistent failure'));

        await expect(httpService.fetch('https://example.com/fail', {
            retryCount: 2
        })).rejects.toThrow('Persistent failure');

        expect(globalFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
});
