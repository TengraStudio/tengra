import { BaseService } from '@main/services/base.service';
import { MarketResearchService } from '@main/services/external/market-research.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { IdeaCategory, ResearchData, ResearchProgress } from '@shared/types/ideas';

interface RunResearchPipelineOptions {
    sessionId: string;
    categories: IdeaCategory[];
    persistResearchData: (researchData: ResearchData) => Promise<void>;
    delay: (ms: number) => Promise<void>;
}

export class IdeaResearchOrchestrationService extends BaseService {
    constructor(
        private readonly marketResearchService: MarketResearchService,
        private readonly eventBus: EventBusService
    ) {
        super('IdeaResearchOrchestrationService');
    }

    async runResearchPipeline(options: RunResearchPipelineOptions): Promise<ResearchData> {
        const researchData: ResearchData = {
            categoryAnalysis: '',
            sectors: [],
            marketTrends: [],
            competitors: [],
            opportunities: [],
        };
        this.emitResearchProgress(options.sessionId, 'understanding', 10, 'Analyzing selected categories...');

        for (let i = 0; i < options.categories.length; i++) {
            const category = options.categories[i];
            const marketData = await this.marketResearchService.getDeepMarketData(category, stageMessage => {
                const baseProgress = 10 + Math.floor((i / options.categories.length) * 80);
                this.emitResearchProgress(options.sessionId, 'market-research', baseProgress, stageMessage);
            });
            this.mergeResearchData(researchData, marketData);
            await options.delay(1000);
        }

        await options.persistResearchData(researchData);
        this.emitResearchProgress(options.sessionId, 'complete', 100, 'Research complete!');
        return researchData;
    }

    public buildResearchContext(research: ResearchData): string {
        let context = '';
        if (research.categoryAnalysis) {
            context += `Category Analysis:\n${research.categoryAnalysis}\n\n`;
        }
        if (research.sectors.length > 0) {
            context += `Relevant Sectors: ${Array.from(new Set(research.sectors)).join(', ')}\n\n`;
        }
        if (research.marketTrends.length > 0) {
            context += `Market Trends:\n${research.marketTrends.slice(0, 10).map(t => `- ${t.title}: ${t.description}`).join('\n')}\n\n`;
        }
        if (research.competitors.length > 0) {
            context += `Top Competitors:\n${research.competitors.slice(0, 10).map(c => `- ${c.name}: ${c.description}`).join('\n')}\n\n`;
        }
        if (research.productHuntProducts && research.productHuntProducts.length > 0) {
            context += `Successful Products (Product Hunt):\n${research.productHuntProducts.slice(0, 5).map(p => `- ${p.name}: ${p.tagline} (${p.votesCount} votes)`).join('\n')}\n\n`;
        }
        if (research.crunchbaseCompanies && research.crunchbaseCompanies.length > 0) {
            context += `Funded Companies (Crunchbase):\n${research.crunchbaseCompanies.slice(0, 5).map(c => `- ${c.name}: ${c.description} (Funding: ${c.fundingTotal ?? 'N/A'})`).join('\n')}\n\n`;
        }
        if (research.opportunities.length > 0) {
            context += `Potential Opportunities:\n${research.opportunities.map(o => `- ${o}`).join('\n')}\n\n`;
        }
        return context;
    }

    private mergeResearchData(target: ResearchData, source: ResearchData): void {
        target.categoryAnalysis += source.categoryAnalysis + '\n\n';
        target.sectors.push(...source.sectors);
        target.marketTrends.push(...source.marketTrends);
        target.competitors.push(...source.competitors);
        target.opportunities.push(...source.opportunities);
        if (source.productHuntProducts) {
            target.productHuntProducts = [...(target.productHuntProducts ?? []), ...source.productHuntProducts];
        }
        if (source.crunchbaseCompanies) {
            target.crunchbaseCompanies = [...(target.crunchbaseCompanies ?? []), ...source.crunchbaseCompanies];
        }
    }

    private emitResearchProgress(
        sessionId: string,
        stage: ResearchProgress['stage'],
        progress: number,
        message?: string
    ): void {
        this.eventBus.emit('ideas:research-progress', { sessionId, stage, progress, message });
    }
}
