import { ContentService } from '@main/services/external/content.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ContentService', () => {
    let service: ContentService;
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() => {
        service = new ContentService();
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock as never as typeof fetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('fetches and sanitizes page content', async () => {
        fetchMock.mockResolvedValue(
            new Response(
                '<html><head><title>Example Page</title></head><body><script>secretValue()</script><p>Visible text</p></body></html>',
                { status: 200 }
            )
        );

        const result = await service.fetchWebPage('https://example.com');

        expect(result.success).toBe(true);
        expect(result.title).toBe('Example Page');
        expect(result.content).toContain('Visible text');
        expect(result.content).not.toContain('secretValue');
    });

    it('returns HTTP error details when scrape request is not successful', async () => {
        fetchMock.mockResolvedValue(new Response('Server error', { status: 503 }));

        const result = await service.fetchWebPage('https://example.com/outage');

        expect(result).toEqual({ success: false, error: 'HTTP 503' });
    });

    it('parses DuckDuckGo-lite search results', async () => {
        fetchMock.mockResolvedValue(
            new Response(
                '<a rel="nofollow" href="https://one.test"> Result One </a><a rel="nofollow" href="https://two.test">Result Two</a>',
                { status: 200 }
            )
        );

        const result = await service.searchWeb('automation tools');

        expect(result).toEqual({
            success: true,
            results: [
                { title: 'Result One', url: 'https://one.test' },
                { title: 'Result Two', url: 'https://two.test' },
            ],
        });
    });

    it('returns a failure response when search throws', async () => {
        fetchMock.mockRejectedValue(new Error('Network offline'));

        const result = await service.searchWeb('resilience test');

        expect(result).toEqual({ success: false });
    });
});
