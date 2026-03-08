import { MarketResearchService } from '@main/services/external/market-research.service';
import { LLMService } from '@main/services/llm/llm.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import {
    IdeaCategory,
    IdeaCompetitor,
    ResearchData,
    ResearchProgress,
    ResearchStage,
    WorkspaceIdea,
} from '@shared/types/ideas';
import { getErrorMessage } from '@shared/utils/error.util';
import { v4 as uuidv4 } from 'uuid';

import { IdeaBaseService } from './base.service';
import { IDEA_PROMPTS } from './idea.prompts';

export class IdeaResearchService extends IdeaBaseService {
    constructor(
        llmService: LLMService,
        private marketResearchService: MarketResearchService,
        private eventBus: EventBusService
    ) {
        super('IdeaResearchService', llmService);
    }

    /**
     * Generate a quick market preview (lightweight, fast)
     */
    async generateMarketPreview(categories: IdeaCategory[]): Promise<Record<string, unknown>[]> {
        this.logInfo(`Generating market preview for: ${categories.join(', ')}`);

        return await Promise.all(
            categories.map(async (category) => {
                const prompt = IDEA_PROMPTS.MARKET_PREVIEW(category);

                const response = await this.retryLLMCall(
                    async () => await this.llmService.chat([
                        { id: uuidv4(), role: 'system', content: 'You are a market analyst.', timestamp: new Date() },
                        { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
                    ], 'gpt-4o-mini', undefined, 'openai'),
                    'Generate market preview'
                );

                const parsed = this.parseJsonResponse<Record<string, unknown>>(response.content);
                return {
                    category,
                    summary: (parsed.summary as string | undefined) ?? 'Market data unavailable',
                    keyTrends: (parsed.keyTrends as string[] | undefined) ?? [],
                    marketSize: (parsed.marketSize as string | undefined) ?? 'Unknown',
                    competition: (parsed.competition as string | undefined) ?? 'Unknown'
                };
            })
        );
    }

    /**
     * Run the full research pipeline for a session
     */
    async runResearchPipeline(sessionId: string, category: IdeaCategory): Promise<ResearchData> {
        this.emitResearchProgress(sessionId, 'understanding', 0, 'Initializing deep market research...');

        try {
            const data = await this.marketResearchService.getDeepMarketData(category, (msg) => {
                this.emitResearchProgress(sessionId, 'market-research', 50, msg);
            });

            this.emitResearchProgress(sessionId, 'complete', 100, 'Market research completed.');
            return data;
        } catch (error) {
            this.logError('Research pipeline failed', error);
            this.emitResearchProgress(sessionId, 'complete', 0, `Search failed: ${getErrorMessage(error as Error)}`);
            throw error;
        }
    }

    /**
     * Stage 3: Targeted idea-specific research
     */
    async stageIdeaResearch(model: string, provider: string, idea: WorkspaceIdea): Promise<string> {
        const prompt = IDEA_PROMPTS.IDEA_RESEARCH({
            title: idea.title,
            description: idea.description,
            category: idea.category
        });

        const response = await this.retryLLMCall(
            async () => await this.llmService.chat([
                { id: uuidv4(), role: 'system', content: 'You are a technical researcher.', timestamp: new Date() },
                { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
            ], model, undefined, provider),
            'Perform idea research'
        );

        return response.content;
    }

    /**
     * Stage 8: Idea-specific competitor analysis
     */
    async stageCompetitorAnalysis(model: string, provider: string, idea: WorkspaceIdea, research: string): Promise<{
        competitors: IdeaCompetitor[],
        advantages: string[]
    }> {
        const prompt = IDEA_PROMPTS.COMPETITOR_ANALYSIS({
            title: idea.title,
            description: idea.description,
            research
        });

        const response = await this.retryLLMCall(
            async () => await this.llmService.chat([
                { id: uuidv4(), role: 'system', content: 'You are a competitive strategist.', timestamp: new Date() },
                { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
            ], model, undefined, provider),
            'Analyze competitors'
        );

        const parsed = this.parseJsonResponse<Partial<{ competitors: IdeaCompetitor[], advantages: string[] }>>(response.content);
        return {
            competitors: parsed.competitors ?? [],
            advantages: parsed.advantages ?? []
        };
    }

    // ==================== Private Helpers ====================

    private emitResearchProgress(sessionId: string, stage: ResearchStage, progress: number, message: string): void {
        const event: ResearchProgress = { sessionId, stage, progress, message };
        this.eventBus.emit('ideas:research-progress', event);
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
            context += `Top Competitors:\n${research.competitors.slice(0, 5).map(c => `- ${c.name}: ${c.description}`).join('\n')}\n\n`;
        }
        if (research.opportunities.length > 0) {
            context += `Identified Opportunities:\n${research.opportunities.slice(0, 10).map(o => `- ${o}`).join('\n')}\n\n`;
        }
        return context;
    }
}
