import { PageSpeedService } from '@main/services/analysis/pagespeed.service';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
    },
}));

const PAGE_SPEED_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

describe('PageSpeedService', () => {
    let service: PageSpeedService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new PageSpeedService();
    });

    it('extracts core metrics and sorted opportunities from Lighthouse data', async () => {
        vi.mocked(axios.get).mockResolvedValue({
            data: {
                lighthouseResult: {
                    categories: {
                        performance: { score: 0.87 },
                    },
                    audits: {
                        'first-contentful-paint': { title: 'FCP', description: '', score: 1, displayValue: '1.1 s' },
                        'largest-contentful-paint': { title: 'LCP', description: '', score: 1, displayValue: '2.4 s' },
                        'total-blocking-time': { title: 'TBT', description: '', score: 1, displayValue: '120 ms' },
                        'cumulative-layout-shift': { title: 'CLS', description: '', score: 1, displayValue: '0.05' },
                        'speed-index': { title: 'Speed Index', description: '', score: 1, displayValue: '2.0 s' },
                        'unused-javascript': {
                            title: 'Reduce unused JavaScript',
                            description: 'Remove dead code',
                            score: 0.2,
                            details: { type: 'opportunity', overallSavingsMs: 1234.4 },
                        },
                        'main-thread-work': {
                            title: 'Minimize main-thread work',
                            description: 'Reduce script execution',
                            score: 0.4,
                            details: { type: 'opportunity', overallSavingsMs: 99.6 },
                        },
                        diagnostics: {
                            title: 'Diagnostics',
                            description: 'No action needed',
                            score: 1,
                            details: { type: 'diagnostic' },
                        },
                    },
                },
            },
        });

        const result = await service.analyze('https://example.com', 'desktop');

        expect(axios.get).toHaveBeenCalledWith(PAGE_SPEED_ENDPOINT, {
            params: { url: 'https://example.com', strategy: 'desktop', category: 'PERFORMANCE' },
        });
        expect(result.performanceScore).toBe(87);
        expect(result.metrics).toEqual({
            fcp: '1.1 s',
            lcp: '2.4 s',
            tbt: '120 ms',
            cls: '0.05',
            speedIndex: '2.0 s',
        });
        expect(result.opportunities).toEqual([
            {
                title: 'Reduce unused JavaScript',
                description: 'Remove dead code',
                savings: '1234ms',
            },
            {
                title: 'Minimize main-thread work',
                description: 'Reduce script execution',
                savings: '100ms',
            },
        ]);
    });

    it('falls back to empty metric values and savings when optional audit fields are missing', async () => {
        service.setApiKey('test-api-key');
        vi.mocked(axios.get).mockResolvedValue({
            data: {
                lighthouseResult: {
                    categories: {
                        performance: { score: 0.5 },
                    },
                    audits: {
                        'first-contentful-paint': { title: 'FCP', description: '', score: 1, displayValue: undefined },
                        'largest-contentful-paint': { title: 'LCP', description: '', score: 1, displayValue: undefined },
                        'total-blocking-time': { title: 'TBT', description: '', score: 1, displayValue: undefined },
                        'cumulative-layout-shift': { title: 'CLS', description: '', score: 1, displayValue: undefined },
                        'speed-index': { title: 'Speed Index', description: '', score: 1, displayValue: undefined },
                        'third-party-code': {
                            title: 'Reduce third-party code',
                            description: 'Limit script execution',
                            score: 0.3,
                            details: { type: 'opportunity' },
                        },
                    },
                },
            },
        });

        const result = await service.analyze('https://fallback.example');

        expect(axios.get).toHaveBeenCalledWith(PAGE_SPEED_ENDPOINT, {
            params: {
                url: 'https://fallback.example',
                strategy: 'mobile',
                category: 'PERFORMANCE',
                key: 'test-api-key',
            },
        });
        expect(result.metrics).toEqual({
            fcp: '',
            lcp: '',
            tbt: '',
            cls: '',
            speedIndex: '',
        });
        expect(result.opportunities).toEqual([
            {
                title: 'Reduce third-party code',
                description: 'Limit script execution',
                savings: '',
            },
        ]);
    });

    it('wraps upstream failures with a stable error message', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('Network down'));

        await expect(service.analyze('https://broken.example')).rejects.toThrow(
            'PageSpeed analysis failed: Network down'
        );
    });
});
