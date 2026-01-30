import { BrainService } from '@main/services/llm/brain.service';
import { LLMService } from '@main/services/llm/llm.service';
import {
    IdeaCategory,
    IdeaSession,
    ProjectIdea,
    ProjectRoadmap,
    TechStack,
} from '@shared/types/ideas';
import { getErrorMessage } from '@shared/utils/error.util';
import { v4 as uuidv4 } from 'uuid';

import { IdeaBaseService } from './base.service';
import { IDEA_PROMPTS } from './idea.prompts';

export class IdeaProductService extends IdeaBaseService {
    constructor(
        llmService: LLMService,
        private brainService: BrainService
    ) {
        super('IdeaProductService', llmService);
    }

    /**
     * Stage 2: Generate initial idea seed
     */
    async stageGenerateSeed(params: {
        session: IdeaSession
        category: IdeaCategory
        categoryResearch: string
        previousIdeasContext: string
        ideaIndex: number
        allExisting: ProjectIdea[]
        customPrompt?: string
    }): Promise<ProjectIdea> {
        const { session, category, categoryResearch, previousIdeasContext, ideaIndex, customPrompt } = params;

        // Add brain context about the user
        let brainContext = '';
        try {
            const context = await this.brainService.getBrainContext(session.customPrompt);
            brainContext = this.brainService.formatBrainContext(context);
        } catch (error) {
            this.logWarn(`Could not fetch brain context: ${getErrorMessage(error as Error)}`);
        }

        const categoryNames: Record<IdeaCategory, string> = {
            'website': 'web application',
            'mobile-app': 'mobile application',
            'game': 'video game',
            'cli-tool': 'command-line tool',
            'desktop': 'desktop application',
            'other': 'software application'
        };

        const creativityPrompts = [
            'Focus on an underserved niche or demographic that is often overlooked',
            'Combine two unrelated industries in an innovative way',
            'Address a problem that has emerged or intensified in the last 2 years',
            'Think about daily frustrations professionals face but accept as normal',
            'Consider accessibility, inclusion, or sustainability opportunities'
        ];

        const prompt = IDEA_PROMPTS.SEED_GENERATION({
            category,
            categoryNames,
            categoryResearch,
            previousIdeasContext,
            sessionContext: session.researchData ? `\n\n=== RELEVANT TRENDS ===\n${session.researchData.marketTrends.slice(0, 5).map(t => t.title).join(', ')}` : '',
            ideaIndex,
            attemptGuidance: '',
            creativityHint: creativityPrompts[ideaIndex % creativityPrompts.length],
            customPrompt
        });

        const response = await this.retryLLMCall(
            async () => await this.llmService.chat([
                { id: uuidv4(), role: 'system', content: IDEA_PROMPTS.SEED_SYSTEM(brainContext), timestamp: new Date() },
                { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
            ], session.model, undefined, session.provider),
            'Generate seed idea'
        );

        const parsed = this.parseJsonResponse<{ title?: string, description?: string }>(response.content);
        return {
            id: uuidv4(),
            sessionId: session.id,
            title: parsed.title ?? 'Generated Project Idea',
            category,
            description: parsed.description ?? 'A new project concept.',
            status: 'pending',
            generationStage: 'seed-generation',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    }

    /**
     * Stage 4: Generate project names
     */
    async stageGenerateNames(session: IdeaSession, idea: ProjectIdea, research: string): Promise<string[]> {
        const prompt = `Generate 10 creative, memorable, and available-sounding names for:
Title: ${idea.title}
Description: ${idea.description}
Research: ${research}

Respond in JSON: { "names": ["...", "..."] }`;

        const response = await this.retryLLMCall(
            async () => await this.llmService.chat([
                { id: uuidv4(), role: 'system', content: 'You are a branding expert.', timestamp: new Date() },
                { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
            ], session.model, undefined, session.provider),
            'Generate names'
        );
        const parsed = this.parseJsonResponse<{ names: string[] }>(response.content, { names: [] });
        return parsed.names.length > 0 ? parsed.names : [idea.title];
    }

    /**
     * Stage 5: Long-form description
     */
    async stageLongDescription(session: IdeaSession, idea: ProjectIdea, research: string): Promise<{
        longDescription: string
        valueProposition: string
        explanation: string
    }> {
        const prompt = `Develop a detailed description for:
Title: ${idea.title}
Idea Context: ${research}

Requirements:
1. Long Description (2-3 paragraphs)
2. Value Proposition (1-2 strong sentences)
3. Technical Explanation (How it works fundamentally)

Respond in JSON:
{ "longDescription": "...", "valueProposition": "...", "explanation": "..." }`;

        const response = await this.retryLLMCall(
            async () => await this.llmService.chat([
                { id: uuidv4(), role: 'system', content: 'You are a product owner.', timestamp: new Date() },
                { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
            ], session.model, undefined, session.provider),
            'Generate details'
        );
        return this.parseJsonResponse(response.content, {
            longDescription: idea.description,
            valueProposition: '',
            explanation: ''
        });
    }

    /**
     * Stage 6: Generate project roadmap
     */
    async stageGenerateRoadmap(session: IdeaSession, idea: ProjectIdea): Promise<ProjectRoadmap> {
        const prompt = `Create a 3-phase development roadmap for:
Title: ${idea.title}
Target: MVP in 2-3 months

Respond in JSON:
{
    "mvp": { "name": "MVP", "description": "...", "duration": "...", "deliverables": ["..."], "order": 0 },
    "phases": [
        { "name": "...", "description": "...", "duration": "...", "deliverables": ["..."], "order": 1 }
    ],
    "totalDuration": "6-12 months"
}`;

        const response = await this.retryLLMCall(
            async () => await this.llmService.chat([
                { id: uuidv4(), role: 'system', content: 'You are a project manager.', timestamp: new Date() },
                { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
            ], session.model, undefined, session.provider),
            'Generate roadmap'
        );
        return this.parseJsonResponse(response.content, {
            mvp: { name: 'MVP', description: '', duration: '', deliverables: [], order: 0 },
            phases: [],
            totalDuration: ''
        });
    }

    /**
     * Stage 7: Select technology stack
     */
    async stageSelectTechStack(session: IdeaSession, idea: ProjectIdea): Promise<TechStack> {
        const prompt = `Recommend a modern, scalable tech stack for:
Title: ${idea.title}
Category: ${idea.category}

Respond in JSON:
{
    "frontend": [{ "name": "...", "reason": "...", "alternatives": ["..."] }],
    "backend": [...],
    "database": [...],
    "infrastructure": [...],
    "other": [...]
}`;

        const response = await this.retryLLMCall(
            async () => await this.llmService.chat([
                { id: uuidv4(), role: 'system', content: 'You are a CTO.', timestamp: new Date() },
                { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
            ], session.model, undefined, session.provider),
            'Generate tech stack'
        );
        return this.parseJsonResponse(response.content, {
            frontend: [], backend: [], database: [], infrastructure: [], other: []
        });
    }
}
