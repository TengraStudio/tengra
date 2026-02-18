import { MarketResearchService } from '@main/services/external/market-research.service';
import { WebService } from '@main/services/external/web.service';
import { WebSearchResult } from '@shared/types/ideas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface SearchWebResponse {
    success: boolean;
    results?: WebSearchResult[];
    error?: string;
}

const createSearchResult = (title: string, url: string, snippet: string): WebSearchResult => ({
    title,
    url,
    snippet,
});

describe('MarketResearchService', () => {
    let service: MarketResearchService;
    const searchWebMock = vi.fn<
        (query: string, numResults?: number) => Promise<SearchWebResponse>
    >();

    beforeEach(() => {
        searchWebMock.mockReset();
        const webService = { searchWeb: searchWebMock } as unknown as WebService;
        service = new MarketResearchService(webService);
        vi.spyOn(
            service as unknown as {
                delay: (ms: number) => Promise<void>;
            },
            'delay'
        ).mockResolvedValue(undefined);
        vi.spyOn(Math, 'random').mockReturnValue(0.2);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns deep analysis output with trends, competitors, and opportunities', async () => {
        searchWebMock.mockImplementation(async (query: string) => {
            if (
                query.includes('established') ||
                query.includes('fastest growing') ||
                query.includes('innovative')
            ) {
                return {
                    success: true,
                    results: [
                        createSearchResult(
                            'Rival One - Platform',
                            'https://rival-one.example',
                            'Strong API-first developer workflow'
                        ),
                        createSearchResult(
                            'Rival One Duplicate',
                            'https://rival-one.example',
                            'Duplicate URL to validate de-duplication'
                        ),
                    ],
                };
            }
            if (query.includes('site:producthunt.com')) {
                return {
                    success: true,
                    results: [
                        createSearchResult(
                            'Launch Helper - Product Hunt',
                            'https://www.producthunt.com/posts/launch-helper',
                            'Popular launch assistant for makers'
                        ),
                    ],
                };
            }
            if (query.includes('site:crunchbase.com')) {
                return {
                    success: true,
                    results: [
                        createSearchResult(
                            'Launch Helper | Crunchbase',
                            'https://www.crunchbase.com/organization/launch-helper',
                            'Funded startup focused on GTM workflows'
                        ),
                    ],
                };
            }
            return {
                success: true,
                results: [
                    createSearchResult(
                        `Trend: ${query}`,
                        `https://trends.example/${encodeURIComponent(query)}`,
                        `Insight for ${query}`
                    ),
                ],
            };
        });

        const progressMessages: string[] = [];
        const result = await service.getDeepMarketData('cli-tool', (message: string) => {
            progressMessages.push(message);
        });

        expect(result.categoryAnalysis).toContain('Developer tools');
        expect(result.sectors).toContain('DevOps');
        expect(result.marketTrends).toHaveLength(3);
        expect(result.competitors).toHaveLength(1);
        expect(result.productHuntProducts).toHaveLength(1);
        expect(result.crunchbaseCompanies).toHaveLength(1);
        expect(result.opportunities).toEqual(
            expect.arrayContaining([
                'Address common pain points not fully solved by existing solutions',
                'Leverage emerging trends in the market',
                'Strong market interest indicated by Product Hunt reception',
            ])
        );
        expect(result.webSearchResults).toEqual([]);
        expect(progressMessages.some((message) => message.includes('Defining research strategy'))).toBe(
            true
        );
        expect(searchWebMock).toHaveBeenCalledTimes(8);
    });

    it('continues deep analysis when one trend search fails', async () => {
        searchWebMock.mockImplementation(async (query: string) => {
            if (query.includes('consumer behavior trends')) {
                throw new Error('Temporary search outage');
            }
            return {
                success: true,
                results: [
                    createSearchResult(
                        'Generic Market Signal',
                        'https://generic.example',
                        'General insight'
                    ),
                ],
            };
        });

        const result = await service.getDeepMarketData('website');

        expect(result.marketTrends).toHaveLength(2);
        expect(result.competitors).toHaveLength(1);
        expect(result.productHuntProducts).toHaveLength(1);
        expect(result.crunchbaseCompanies).toHaveLength(1);
        expect(result.opportunities).toContain('Leverage emerging trends in the market');
    });
});
