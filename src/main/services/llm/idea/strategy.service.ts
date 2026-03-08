import { LLMService } from '@main/services/llm/llm.service';
import {
    BusinessModel,
    IdeaSession,
    JourneyStep,
    MarketingPlan,
    SWOTAnalysis,
    UserPersona,
    WorkspaceIdea,
} from '@shared/types/ideas';
import { v4 as uuidv4 } from 'uuid';

import { IdeaBaseService } from './base.service';
import { IDEA_PROMPTS } from './idea.prompts';

export class IdeaStrategyService extends IdeaBaseService {
    constructor(llmService: LLMService) {
        super('IdeaStrategyService', llmService);
    }

    /**
     * Stage 9: User personas & journey maps
     */
    async stageGeneratePersonas(session: IdeaSession, idea: WorkspaceIdea): Promise<{ personas: UserPersona[]; journey: JourneyStep[] }> {
        const prompt = IDEA_PROMPTS.PERSONAS(idea.title, idea.description, idea.longDescription?.slice(0, 1000));

        const response = await this.retryLLMCall(
            async () => await this.llmService.chat([
                { id: uuidv4(), role: 'system', content: 'You are a senior UX researcher. Always respond in valid JSON.', timestamp: new Date() },
                { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
            ], session.model, undefined, session.provider),
            'Generate personas'
        );
        return this.parseJsonResponse(response.content, { personas: [], journey: [] });
    }

    /**
     * Stage 10: SWOT & monetization
     */
    async stageGenerateBusinessStrategy(session: IdeaSession, idea: WorkspaceIdea): Promise<{ swot: SWOTAnalysis; businessModel: BusinessModel }> {
        const prompt = IDEA_PROMPTS.BUSINESS_STRATEGY(idea.title, idea.marketResearch?.targetAudience ?? idea.category);

        const response = await this.retryLLMCall(
            async () => await this.llmService.chat([
                { id: uuidv4(), role: 'system', content: 'You are a senior business strategist. Always respond in valid JSON.', timestamp: new Date() },
                { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
            ], session.model, undefined, session.provider),
            'Generate business model'
        );
        return this.parseJsonResponse(response.content, {
            swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
            businessModel: { monetizationType: '', revenueStreams: [], costStructure: [], breakEvenStrategy: '' }
        });
    }

    /**
     * Stage 11: GTM & first 100 users
     */
    async stageGenerateGTMPlan(session: IdeaSession, idea: WorkspaceIdea): Promise<MarketingPlan> {
        const prompt = IDEA_PROMPTS.GTM_PLAN(idea.title, idea.valueProposition);

        const response = await this.retryLLMCall(
            async () => await this.llmService.chat([
                { id: uuidv4(), role: 'system', content: 'You are a growth marketing expert. Always respond in valid JSON.', timestamp: new Date() },
                { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
            ], session.model, undefined, session.provider),
            'Generate marketing plan'
        );
        return this.parseJsonResponse(response.content, {
            channels: [],
            first100UsersActionableSteps: [],
            contentStrategy: '',
            launchChecklist: []
        });
    }
}
