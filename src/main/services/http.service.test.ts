import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpService } from './http.service';

// Mock global fetch
const globalFetch = vi.fn();
global.fetch = globalFetch;

describe('HttpService', () => {
    let httpService: HttpService;

    beforeEach(() => {
        httpService = new HttpService();
        globalFetch.mockReset();
    });

    it('should return successful response without retries', async () => {
        globalFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ data: 'success' })
        });

        const response = await httpService.fetch('https://api.example.com/data');
        expect(response.ok).toBe(true);
        expect(globalFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network error and succeed', async () => {
        // First attempt fails (network error)
        globalFetch.mockRejectedValueOnce(new Error('Network error'));
        // Second attempt succeeds
        globalFetch.mockResolvedValueOnce({
            ok: true,
            status: 200
        });

        const response = await httpService.fetch('https://api.example.com/retry', {
            retryCount: 2
        });

        expect(response.ok).toBe(true);
        expect(globalFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 5xx status and succeed', async () => {
        // First attempt fails (503 Service Unavailable)
        globalFetch.mockResolvedValueOnce({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable'
        });
        // Second attempt succeeds
        globalFetch.mockResolvedValueOnce({
            ok: true,
            status: 200
        });

        const response = await httpService.fetch('https://api.example.com/status', {
            retryCount: 2
        });

        expect(response.ok).toBe(true);
        expect(globalFetch).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
        globalFetch.mockRejectedValue(new Error('Persistent failure'));

        await expect(httpService.fetch('https://example.com/fail', {
            retryCount: 3
        })).rejects.toThrow('Persistent failure');

        expect(globalFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
});
