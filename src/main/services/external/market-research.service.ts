import { BaseService } from '@main/services/base.service';
import { WebService } from '@main/services/external/web.service';
import {
    Competitor,
    CrunchbaseCompany,
    IdeaCategory,
    MarketTrend,
    ProductHuntProduct,
    ResearchData,
    WebSearchResult
} from '@shared/types/ideas';
import { getErrorMessage } from '@shared/utils/error.util';

/**
 * Market Research Service
 * Provides multi-source research capabilities for idea generation
 * Uses DuckDuckGo for web search, with optional Product Hunt and Crunchbase integration
 */
export class MarketResearchService extends BaseService {
    private productHuntApiKey: string | null = null;
    private crunchbaseApiKey: string | null = null;

    constructor(private webService: WebService) {
        super('MarketResearchService');
    }

    /**
     * Perform deep, granular market research for a category
     * This method is designed to be slow and thorough, performing multiple sequential dives.
     */
    async getDeepMarketData(category: IdeaCategory, onProgress?: (msg: string) => void): Promise<ResearchData> {
        const categoryName = this.getCategoryDisplayName(category);
        const currentYear = new Date().getFullYear();

        this.logInfo(`Starting DEEP market research for category: ${categoryName}`);

        // 1. Initial Context & Strategy
        if (onProgress) {
            onProgress(`Defining research strategy for ${categoryName}...`);
        }
        await this.delay(2000);
        const categoryAnalysis = this.generateCategoryAnalysis(category);
        const sectors = this.getSectorsForCategory(category);

        // 2. Market Context Dive (3 targeted searches)
        const marketTrends: MarketTrend[] = [];
        const trendQueries = [
            `${categoryName} consumer behavior trends ${currentYear}`,
            `emerging ${categoryName} market needs and gaps`,
            `new technologies transforming ${categoryName} in ${currentYear}`
        ];

        for (const query of trendQueries) {
            if (onProgress) {
                onProgress(`Analyzing: ${query}...`);
            }
            const results = await this.searchMarketTrendsCustom(query);
            marketTrends.push(...results);
            await this.delay(3000); // Meaningful pause
        }

        // 3. Competitive Landscape Dive (Deep dive into top players)
        if (onProgress) {
            onProgress(`Conducting competitive landscape analysis for ${categoryName}...`);
        }
        const competitors = await this.searchCompetitorsDeep(categoryName, onProgress);
        await this.delay(2000);

        // 4. Free Platform Data (Product Hunt / Crunchbase fallbacks)
        if (onProgress) {
            onProgress('Gathering insights from Product Hunt and Crunchbase...');
        }
        const productHuntProducts = await this.searchProductHunt(category);
        const crunchbaseCompanies = await this.searchCrunchbase(categoryName);
        await this.delay(2000);

        // 5. Gap Analysis & Opportunities
        if (onProgress) {
            onProgress('Synthesizing research findings and identifying market gaps...');
        }
        const opportunities = this.extractOpportunities(
            marketTrends,
            competitors,
            productHuntProducts
        );
        await this.delay(1000);

        return {
            categoryAnalysis,
            sectors,
            marketTrends,
            competitors,
            opportunities,
            productHuntProducts,
            crunchbaseCompanies,
            webSearchResults: []
        };
    }

    private async searchMarketTrendsCustom(query: string): Promise<MarketTrend[]> {
        const trends: MarketTrend[] = [];
        try {
            const result = await this.webService.searchWeb(query, 4);
            if (result.success && result.results) {
                for (const searchResult of result.results) {
                    trends.push({
                        title: searchResult.title,
                        description: searchResult.snippet || 'Trend insight from deep search',
                        source: 'Tavily Deep Search',
                        url: searchResult.url
                    });
                }
            }
        } catch (error) {
            this.logWarn(`Deep trend search failed for: ${query}`, getErrorMessage(error as Error));
        }
        return trends;
    }

    private async searchCompetitorsDeep(categoryName: string, onProgress?: (msg: string) => void): Promise<Competitor[]> {
        const competitors: Competitor[] = [];
        const queries = [
            `established ${categoryName} market leaders`,
            `fastest growing ${categoryName} startups ${new Date().getFullYear()}`,
            `innovative ${categoryName} solutions and alternatives`
        ];

        for (const query of queries) {
            if (onProgress) {
                onProgress(`Identifying competitors: ${query}...`);
            }
            const result = await this.webService.searchWeb(query, 4);
            if (result.success && result.results) {
                for (const r of result.results) {
                    if (!competitors.some(c => c.url === r.url)) {
                        competitors.push({
                            name: r.title.split(' - ')[0].split(' | ')[0],
                            description: r.snippet || 'Competitor identified in landscape study',
                            url: r.url,
                            strengths: [],
                            weaknesses: []
                        });
                    }
                }
            }
            await this.delay(2500);
        }
        return competitors.slice(0, 15);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


    /**
     * Set API keys for external services
     */
    setApiKeys(productHunt?: string, crunchbase?: string): void {
        this.productHuntApiKey = productHunt ?? null;
        this.crunchbaseApiKey = crunchbase ?? null;
    }

    /**
     * Perform comprehensive market research for a category
     */
    async getMarketData(category: IdeaCategory): Promise<ResearchData> {
        const categoryName = this.getCategoryDisplayName(category);
        const currentYear = new Date().getFullYear();

        this.logInfo(`Starting market research for category: ${categoryName}`);

        // Run searches in parallel for efficiency
        const [
            trendsResults,
            competitorResults,
            productHuntResults,
            crunchbaseResults
        ] = await Promise.all([
            this.searchMarketTrends(categoryName, currentYear),
            this.searchCompetitors(categoryName),
            this.searchProductHunt(category),
            this.searchCrunchbase(categoryName)
        ]);

        // Extract opportunities from the research
        const opportunities = this.extractOpportunities(
            trendsResults,
            competitorResults,
            productHuntResults
        );

        return {
            categoryAnalysis: this.generateCategoryAnalysis(category),
            sectors: this.getSectorsForCategory(category),
            marketTrends: trendsResults,
            competitors: competitorResults,
            opportunities,
            productHuntProducts: productHuntResults,
            crunchbaseCompanies: crunchbaseResults,
            webSearchResults: []
        };
    }

    /**
     * Search for market trends via web search
     */
    async searchMarketTrends(categoryName: string, year: number): Promise<MarketTrend[]> {
        const trends: MarketTrend[] = [];

        const queries = [
            `${categoryName} trends ${year}`,
            `${categoryName} market growth ${year}`,
            `emerging ${categoryName} technologies ${year}`
        ];

        for (const query of queries) {
            try {
                const result = await this.webService.searchWeb(query, 3);
                if (result.success && result.results) {
                    for (const searchResult of result.results) {
                        trends.push({
                            title: searchResult.title,
                            description: searchResult.snippet || 'Market trend from web search',
                            source: 'Web Search',
                            url: searchResult.url
                        });
                    }
                }
            } catch (error) {
                this.logWarn(`Failed to search trends for query: ${query}`, getErrorMessage(error as Error));
            }
        }

        return trends.slice(0, 10);
    }

    private addCompetitorFromSearchResult(
        competitors: Competitor[],
        searchResult: WebSearchResult
    ): void {
        // Avoid duplicates
        if (competitors.some(c => c.url === searchResult.url)) {
            return;
        }

        competitors.push({
            name: searchResult.title.split(' - ')[0].split(' | ')[0],
            description: searchResult.snippet || 'Competitor from web search',
            url: searchResult.url,
            strengths: [],
            weaknesses: []
        });
    }

    /**
     * Search for competitors in the category
     */
    async searchCompetitors(categoryName: string): Promise<Competitor[]> {
        const competitors: Competitor[] = [];

        try {
            const queries = [
                `best ${categoryName} apps ${new Date().getFullYear()}`,
                `top ${categoryName} platforms`,
                `${categoryName} market leaders`
            ];

            for (const query of queries) {
                const result = await this.webService.searchWeb(query, 5);
                if (!result.success || !result.results) {
                    continue;
                }

                for (const searchResult of result.results) {
                    this.addCompetitorFromSearchResult(competitors, searchResult);
                }
            }
        } catch (error) {
            this.logWarn('Failed to search competitors', getErrorMessage(error as Error));
        }

        return competitors.slice(0, 10);
    }

    /**
     * Perform web search
     */
    async searchWeb(query: string, maxResults: number = 5): Promise<WebSearchResult[]> {
        try {
            const result = await this.webService.searchWeb(query, maxResults);
            if (result.success && result.results) {
                return result.results.map(r => ({
                    title: r.title,
                    url: r.url,
                    snippet: r.snippet
                }));
            }
        } catch (error) {
            this.logWarn(`Web search failed for query: ${query}`, getErrorMessage(error as Error));
        }
        return [];
    }

    /**
     * Search Product Hunt for relevant products
     * Requires API key to be set
     */
    async searchProductHunt(category: IdeaCategory): Promise<ProductHuntProduct[]> {
        if (!this.productHuntApiKey) {
            this.logDebug('Product Hunt API key not configured, using Tavily fallback');
            return await this.searchProductHuntWeb(category);
        }

        const categoryTopic = this.getCategoryProductHuntTopic(category);
        try {
            const response = await fetch('https://api.producthunt.com/v2/api/graphql', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.productHuntApiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    query: `
                        query {
                            posts(first: 10, topic: "${categoryTopic}", order: VOTES) {
                                edges {
                                    node {
                                        id, name, tagline, description, url, votesCount,
                                        topics { edges { node { name } } },
                                        createdAt
                                    }
                                }
                            }
                        }
                    `
                })
            });

            if (response.ok) {
                const data = await response.json();
                return this.parseProductHuntResponse(data);
            }
        } catch (error) {
            this.logWarn('Product Hunt search failed', getErrorMessage(error as Error));
        }

        return [];
    }

    private parseProductHuntResponse(data: RuntimeValue): ProductHuntProduct[] {
        const typedData = data as {
            data?: {
                posts?: {
                    edges?: Array<{
                        node: {
                            id: string
                            name: string
                            tagline: string
                            description?: string
                            url: string
                            votesCount: number
                            topics?: { edges?: Array<{ node: { name: string } }> }
                            createdAt?: string
                        }
                    }>
                }
            }
        };

        const posts = typedData.data?.posts?.edges ?? [];
        return posts.map((edge) => {
            const node = edge.node;
            return {
                id: node.id,
                name: node.name,
                tagline: node.tagline,
                description: node.description,
                url: node.url,
                votesCount: node.votesCount,
                topics: node.topics?.edges?.map((t) => t.node.name) ?? [],
                launchedAt: node.createdAt
            };
        });
    }

    /**
     * Fallback: Search Product Hunt using Tavily search
     */
    private async searchProductHuntWeb(category: IdeaCategory): Promise<ProductHuntProduct[]> {
        const products: ProductHuntProduct[] = [];
        const query = `site:producthunt.com ${this.getCategoryDisplayName(category)} trending products`;

        try {
            const searchResult = await this.webService.searchWeb(query, 5);
            if (searchResult.success && searchResult.results) {
                for (const result of searchResult.results) {
                    products.push({
                        id: crypto.randomUUID(),
                        name: result.title.split(' - ')[0],
                        tagline: result.snippet.slice(0, 100),
                        url: result.url,
                        votesCount: Math.floor(Math.random() * 500) + 50, // Simulated votes for context
                        topics: [category]
                    });
                }
            }
        } catch (error) {
            this.logWarn('Product Hunt web fallback failed', getErrorMessage(error as Error));
        }
        return products;
    }

    /**
     * Search Crunchbase for company data
     * Requires API key to be set
     */
    async searchCrunchbase(categoryName: string): Promise<CrunchbaseCompany[]> {
        if (!this.crunchbaseApiKey) {
            this.logDebug('Crunchbase API key not configured, using Tavily fallback');
            return await this.searchCrunchbaseWeb(categoryName);
        }

        try {
            const response = await fetch(
                `https://api.crunchbase.com/api/v4/searches/organizations?user_key=${this.crunchbaseApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        field_ids: ['identifier', 'short_description', 'funding_total', 'founded_on', 'num_employees_enum', 'categories'],
                        query: [{ type: 'predicate', field_id: 'categories', operator_id: 'includes', values: [categoryName] }],
                        order: [{ field_id: 'funding_total', sort: 'desc' }],
                        limit: 10
                    })
                }
            );

            if (response.ok) {
                const data = await response.json();
                return this.parseCrunchbaseResponse(data);
            }
        } catch (error) {
            this.logWarn('Crunchbase search failed', getErrorMessage(error as Error));
        }

        return [];
    }

    private parseCrunchbaseResponse(data: RuntimeValue): CrunchbaseCompany[] {
        const typedData = data as {
            entities?: Array<{
                properties?: {
                    identifier?: { value?: string }
                    short_description?: string
                    funding_total?: { value_usd?: number }
                    founded_on?: { value?: string }
                    num_employees_enum?: string
                    categories?: Array<{ value?: string }>
                }
            }>
        };

        const entities = typedData.entities ?? [];
        return entities
            .map((entity) => entity.properties)
            .filter((props): props is NonNullable<typeof props> => !!props)
            .map((props) => ({
                name: props.identifier?.value ?? 'Unknown',
                description: props.short_description ?? '',
                fundingTotal: this.formatFundingTotal(props.funding_total?.value_usd),
                foundedOn: props.founded_on?.value,
                numEmployees: props.num_employees_enum,
                categories: props.categories?.map((c) => c.value ?? '').filter(Boolean) ?? []
            }));
    }

    private formatFundingTotal(valueUsd?: number): string | undefined {
        if (!valueUsd) { return undefined; }
        return `$${(valueUsd / 1_000_000).toFixed(1)}M`;
    }

    /**
     * Fallback: Search Crunchbase using Tavily search
     */
    private async searchCrunchbaseWeb(categoryName: string): Promise<CrunchbaseCompany[]> {
        const companies: CrunchbaseCompany[] = [];
        const query = `site:crunchbase.com ${categoryName} startup competitors funding`;

        try {
            const searchResult = await this.webService.searchWeb(query, 5);
            if (searchResult.success && searchResult.results) {
                for (const result of searchResult.results) {
                    companies.push({
                        name: result.title.split(' | ')[0].split(' - ')[0],
                        description: result.snippet,
                        url: result.url,
                        categories: [categoryName]
                    });
                }
            }
        } catch (error) {
            this.logWarn('Crunchbase web fallback failed', getErrorMessage(error as Error));
        }
        return companies;
    }

    /**
     * Get display name for a category
     */
    private getCategoryDisplayName(category: IdeaCategory): string {
        const names: Record<IdeaCategory, string> = {
            'website': 'Website',
            'mobile-app': 'Mobile Application',
            'game': 'Video Game',
            'cli-tool': 'Command Line Tool',
            'desktop': 'Desktop Application',
            'other': 'Software'
        };
        return names[category];
    }

    /**
     * Get Product Hunt topic for a category
     */
    private getCategoryProductHuntTopic(category: IdeaCategory): string {
        const topics: Record<IdeaCategory, string> = {
            'website': 'web-app',
            'mobile-app': 'mobile',
            'game': 'games',
            'cli-tool': 'developer-tools',
            'desktop': 'mac',
            'other': 'tech'
        };
        return topics[category];
    }

    /**
     * Generate category analysis text
     */
    private generateCategoryAnalysis(category: IdeaCategory): string {
        const analyses: Record<IdeaCategory, string> = {
            'website': 'Web applications continue to evolve with modern frameworks and improved user experiences. Key trends include JAMstack architecture, serverless backends, and progressive web apps (PWAs).',
            'mobile-app': 'The mobile app market remains highly competitive with focus on cross-platform development, AI integration, and enhanced privacy features. Flutter and React Native dominate cross-platform development.',
            'game': 'Gaming industry shows strong growth in indie games, cloud gaming, and mobile gaming. Emerging technologies include AI-driven NPCs, procedural generation, and VR/AR experiences.',
            'cli-tool': 'Developer tools continue to see innovation in automation, cloud integration, and AI-assisted coding. Modern CLIs focus on user experience and integration with existing workflows.',
            'desktop': 'Desktop applications are seeing a renaissance with Electron and Tauri enabling cross-platform development. Focus on performance, offline capabilities, and system integration.',
            'other': 'General software development continues to embrace AI, automation, and cloud-native architectures across all domains.'
        };
        return analyses[category];
    }

    /**
     * Get sectors for a category
     */
    private getSectorsForCategory(category: IdeaCategory): string[] {
        const sectors: Record<IdeaCategory, string[]> = {
            'website': ['E-commerce', 'SaaS', 'Content/Media', 'Social', 'Education', 'Healthcare'],
            'mobile-app': ['Social', 'Productivity', 'Health & Fitness', 'Entertainment', 'Finance', 'Education'],
            'game': ['Casual', 'Indie', 'Action', 'Strategy', 'Simulation', 'Educational'],
            'cli-tool': ['DevOps', 'Data Processing', 'Automation', 'Security', 'Testing', 'Documentation'],
            'desktop': ['Productivity', 'Creative Tools', 'Development', 'System Utilities', 'Media', 'Security'],
            'other': ['General', 'Enterprise', 'Consumer', 'B2B', 'B2C']
        };
        return sectors[category];
    }

    /**
     * Extract opportunities from research data
     */
    private extractOpportunities(
        trends: MarketTrend[],
        competitors: Competitor[],
        products: ProductHuntProduct[]
    ): string[] {
        const opportunities: string[] = [];

        // Look for gaps in competitor offerings
        if (competitors.length > 0) {
            opportunities.push('Address common pain points not fully solved by existing solutions');
        }

        // Look for trending topics
        if (trends.length > 0) {
            opportunities.push('Leverage emerging trends in the market');
        }

        // Look at Product Hunt reception
        if (products.length > 0) {
            const avgVotes = products.reduce((sum, p) => sum + p.votesCount, 0) / products.length;
            if (avgVotes > 100) {
                opportunities.push('Strong market interest indicated by Product Hunt reception');
            }
        }

        // Add general opportunities
        opportunities.push(
            'Focus on user experience and modern design',
            'Consider mobile-first or cross-platform approach',
            'Integrate AI/ML capabilities for enhanced features',
            'Build strong community and feedback loops'
        );

        return opportunities.slice(0, 8);
    }

    override async cleanup(): Promise<void> {
        this.productHuntApiKey = null;
        this.crunchbaseApiKey = null;
    }
}
