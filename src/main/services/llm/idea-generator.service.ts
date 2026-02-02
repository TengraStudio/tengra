import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { MarketResearchService } from '@main/services/external/market-research.service';
import { BrainService } from '@main/services/llm/brain.service';
import { LLMService } from '@main/services/llm/llm.service';
import { LocalImageService } from '@main/services/llm/local-image.service';
import { ProjectScaffoldService } from '@main/services/project/project-scaffold.service';
import { AuthService } from '@main/services/security/auth.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { Message } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { DatabaseAdapter } from '@shared/types/database';
import {
    BusinessModel,
    IdeaCategory,
    IdeaCompetitor,
    IdeaGenerationStage,
    IdeaProgress,
    IdeaSession,
    IdeaSessionConfig,
    IdeaSessionStatus,
    IdeaStatus,
    JourneyStep,
    MarketingPlan,
    ProjectIdea,
    ProjectRoadmap,
    ResearchData,
    ResearchProgress,
    ResearchStage,
    RoadmapPhase,
    SWOTAnalysis,
    TechChoice,
    TechStack,
    UserPersona
} from '@shared/types/ideas';
import { Project } from '@shared/types/project';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { v4 as uuidv4 } from 'uuid';

/** Current year for prompts */
const CURRENT_YEAR = new Date().getFullYear();

/** Artificial delay multiplier for UX pacing (0 = disabled, 1 = full delays) */
const DELAY_MULTIPLIER = Number.parseInt(process.env.IDEA_DELAY_MULTIPLIER ?? '0.1', 10);

/**
 * Idea Generator Service
 * Orchestrates the AI-powered project idea generation pipeline
 */
export class IdeaGeneratorService extends BaseService {
    private initialized = false;

    constructor(
        private deps: {
            databaseService: DatabaseService,
            llmService: LLMService,
            marketResearchService: MarketResearchService,
            projectScaffoldService: ProjectScaffoldService,
            authService: AuthService,
            eventBus: EventBusService,
            localImageService: LocalImageService,
            brainService: BrainService
        }
    ) {
        super('IdeaGeneratorService');
    }

    /**
     * Initialize the IdeaGeneratorService
     */
    async initialize(): Promise<void> {
        appLogger.info(this.name, 'Initializing idea generator service...');

        // Ensure database tables exist
        try {
            const db = await this.getDb();
            await this.ensureTables(db);
            this.initialized = true;
            appLogger.info(this.name, 'Idea generator service initialized');
        } catch (error) {
            appLogger.error(this.name, 'Failed to initialize idea generator service', error as Error);
            throw error;
        }
    }

    /**
     * Cleanup the IdeaGeneratorService
     */
    async cleanup(): Promise<void> {
        appLogger.info(this.name, 'Cleaning up idea generator service...');
        this.initialized = false;
        appLogger.info(this.name, 'Idea generator service cleaned up');
    }

    /**
     * Ensure database tables exist for idea generation
     */
    private async ensureTables(db: DatabaseAdapter): Promise<void> {
        // Check if idea_sessions table exists, create if not
        const tableCheck = await db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='idea_sessions'
        `).get<{ name: string }>();

        if (!tableCheck) {
            this.logInfo('Creating idea_sessions table');
            // Table creation would happen here if needed
        }
    }

    // ==================== Session Management ====================

    /**
     * Create a new idea generation session
     */
    async createSession(config: IdeaSessionConfig): Promise<IdeaSession> {
        this.logInfo(`Creating idea session: model=${config.model}, categories=${config.categories.join(', ')}`);

        const db = await this.getDb();
        const id = uuidv4();
        const now = Date.now();

        await db.prepare(`
            INSERT INTO idea_sessions (id, model, provider, categories, max_ideas, ideas_generated, status, custom_prompt, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            config.model,
            config.provider,
            JSON.stringify(config.categories),
            config.maxIdeas,
            0,
            'active',
            config.customPrompt ?? null,
            now,
            now
        );

        return {
            id,
            model: config.model,
            provider: config.provider,
            categories: config.categories,
            maxIdeas: config.maxIdeas,
            ideasGenerated: 0,
            status: 'active',
            customPrompt: config.customPrompt,
            createdAt: now,
            updatedAt: now
        };
    }

    /**
     * Get a session by ID
     */
    async getSession(id: string): Promise<IdeaSession | null> {
        const db = await this.getDb();
        const row = await db.prepare('SELECT * FROM idea_sessions WHERE id = ?').get<JsonObject>(id);
        return row ? this.mapRowToSession(row) : null;
    }

    /**
     * Get all sessions
     */
    async getSessions(): Promise<IdeaSession[]> {
        const db = await this.getDb();
        const rows = await db.prepare('SELECT * FROM idea_sessions ORDER BY created_at DESC').all<JsonObject>();
        return rows.map(row => this.mapRowToSession(row));
    }

    /**
     * Update session status
     */
    async updateSessionStatus(id: string, status: IdeaSessionStatus): Promise<void> {
        const db = await this.getDb();
        await db.prepare('UPDATE idea_sessions SET status = ?, updated_at = ? WHERE id = ?')
            .run(status, Date.now(), id);
    }

    /**
     * Cancel an active session
     */
    async cancelSession(id: string): Promise<void> {
        await this.updateSessionStatus(id, 'cancelled');
        this.logInfo(`Session ${id} cancelled`);
    }

    /**
     * Generate a quick market research preview (lightweight, fast)
     * Used before full research to validate category choices
     */
    async generateMarketPreview(categories: IdeaCategory[]): Promise<{
        category: IdeaCategory
        summary: string
        keyTrends: string[]
        marketSize: string
        competition: string
    }[]> {
        this.logInfo(`Generating market preview for categories: ${categories.join(', ')}`);

        const previews = await Promise.all(
            categories.map(async (category) => {
                const prompt = `Provide a BRIEF market overview for ${category} development in ${CURRENT_YEAR}.

Include:
1. Market Summary (2-3 sentences)
2. Top 3 Key Trends
3. Market Size/Growth estimate
4. Competition Level (low/medium/high with 1 sentence why)

Keep it concise and actionable. Focus on ${CURRENT_YEAR} conditions.

Respond in JSON:
{
    "summary": "...",
    "keyTrends": ["...", "...", "..."],
    "marketSize": "...",
    "competition": "..."
}`;

                const messages: Message[] = [
                    { id: uuidv4(), role: 'system', content: `You are a market analyst. Provide brief, data-driven insights for ${CURRENT_YEAR}. Always respond in valid JSON.`, timestamp: new Date() },
                    { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
                ];

                const response = await this.retryLLMCall(
                    async () => await this.deps.llmService.chat(
                        messages,
                        'gpt-4o-mini', // Use faster/cheaper model for preview
                        undefined,
                        'openai'
                    ),
                    'Generate market preview'
                );

                const parsed = this.parseJsonResponse<{
                    summary?: string
                    keyTrends?: string[]
                    marketSize?: string
                    competition?: string
                }>(response.content, {
                    summary: 'Market data unavailable',
                    keyTrends: [],
                    marketSize: 'Unknown',
                    competition: 'Unknown'
                });

                return {
                    category,
                    summary: parsed.summary ?? 'Market data unavailable',
                    keyTrends: parsed.keyTrends ?? [],
                    marketSize: parsed.marketSize ?? 'Unknown',
                    competition: parsed.competition ?? 'Unknown'
                };
            })
        );

        return previews;
    }

    // ==================== Research Pipeline ====================

    /**
     * Run the research pipeline for a session
     */
    async runResearchPipeline(sessionId: string): Promise<ResearchData> {
        const session = await this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        this.logInfo(`Starting research pipeline for session ${sessionId}`);
        await this.updateSessionStatus(sessionId, 'researching');

        const researchData: ResearchData = {
            categoryAnalysis: '',
            sectors: [],
            marketTrends: [],
            competitors: [],
            opportunities: []
        };

        try {
            // Stage 1: Initial Analysis
            this.emitResearchProgress(sessionId, 'understanding', 10, 'Analyzing selected categories...');

            for (let i = 0; i < session.categories.length; i++) {
                const category = session.categories[i];

                // Perform DEEP, granular research sequentially
                const marketData = await this.deps.marketResearchService.getDeepMarketData(
                    category,
                    (stageMessage) => {
                        const baseProgress = 10 + Math.floor((i / session.categories.length) * 80);
                        this.emitResearchProgress(sessionId, 'market-research', baseProgress, stageMessage);
                    }
                );

                researchData.categoryAnalysis += marketData.categoryAnalysis + '\n\n';
                researchData.sectors.push(...marketData.sectors);
                researchData.marketTrends.push(...marketData.marketTrends);
                researchData.competitors.push(...marketData.competitors);
                researchData.opportunities.push(...marketData.opportunities);

                if (marketData.productHuntProducts) {
                    researchData.productHuntProducts = [
                        ...(researchData.productHuntProducts ?? []),
                        ...marketData.productHuntProducts
                    ];
                }
                if (marketData.crunchbaseCompanies) {
                    researchData.crunchbaseCompanies = [
                        ...(researchData.crunchbaseCompanies ?? []),
                        ...marketData.crunchbaseCompanies
                    ];
                }

                await this.delay(1000);
            }

            // Save research data to session
            const db = await this.getDb();
            await db.prepare('UPDATE idea_sessions SET research_data = ?, updated_at = ? WHERE id = ?')
                .run(JSON.stringify(researchData), Date.now(), sessionId);

            this.emitResearchProgress(sessionId, 'complete', 100, 'Research complete!');
            this.logInfo(`Research pipeline completed for session ${sessionId}`);

            return researchData;
        } catch (error) {
            this.logError(`Research pipeline failed: ${getErrorMessage(error as Error)}`);
            await this.updateSessionStatus(sessionId, 'active');
            throw error;
        }
    }

    // ==================== Idea Generation ====================

    /**
     * Get all previously generated ideas (for deduplication)
     */
    private async getAllPreviousIdeas(): Promise<ProjectIdea[]> {
        const db = await this.getDb();
        const rows = await db.prepare(
            'SELECT * FROM project_ideas ORDER BY created_at DESC LIMIT 200'
        ).all<JsonObject>();
        return rows.map(row => this.mapRowToIdea(row));
    }

    /**
     * Check if an idea title is too similar to existing ideas
     */
    private isTitleTooSimilar(newTitle: string, existingIdeas: ProjectIdea[]): boolean {
        const normalizedNew = newTitle.toLowerCase().trim();

        for (const existing of existingIdeas) {
            const normalizedExisting = existing.title.toLowerCase().trim();

            // Exact match
            if (normalizedNew === normalizedExisting) {
                return true;
            }

            // Check for high word overlap (>70% similarity)
            const newWords = new Set(normalizedNew.split(/\s+/).filter(w => w.length > 2));
            const existingWords = new Set(normalizedExisting.split(/\s+/).filter(w => w.length > 2));

            if (newWords.size === 0 || existingWords.size === 0) {
                continue;
            }

            let matches = 0;
            for (const word of newWords) {
                if (existingWords.has(word)) {
                    matches++;
                }
            }

            const similarity = matches / Math.max(newWords.size, existingWords.size);
            if (similarity > 0.7) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if an idea is too similar (title OR description) to existing ideas
     */
    private isIdeaTooSimilar(
        newIdea: { title: string; description: string },
        existingIdeas: ProjectIdea[]
    ): boolean {
        // Check title similarity first
        if (this.isTitleTooSimilar(newIdea.title, existingIdeas)) {
            return true;
        }

        // Check description similarity
        const newDescWords = new Set(
            newIdea.description.toLowerCase().split(/\s+/).filter(w => w.length > 3)
        );
        if (newDescWords.size === 0) {
            return false;
        }

        for (const existing of existingIdeas) {
            const existingWords = new Set(
                existing.description.toLowerCase().split(/\s+/).filter(w => w.length > 3)
            );
            if (existingWords.size === 0) {
                continue;
            }

            let matches = 0;
            for (const word of newDescWords) {
                if (existingWords.has(word)) {
                    matches++;
                }
            }

            const similarity = matches / Math.max(newDescWords.size, existingWords.size);
            if (similarity > 0.5) {
                return true;
            }
        }

        return false;
    }

    /**
     * Build context about previously generated ideas to avoid repetition
     */
    private buildPreviousIdeasContext(
        ideas: ProjectIdea[],
        currentCategories: IdeaCategory[]
    ): string {
        if (ideas.length === 0) {
            return '';
        }

        // Filter to relevant categories and limit to recent ideas
        const relevantIdeas = ideas
            .filter(i => currentCategories.includes(i.category))
            .slice(0, 50);

        if (relevantIdeas.length === 0) {
            return '';
        }

        const ideaList = relevantIdeas
            .map(i => `- "${i.title}": ${i.description.slice(0, 100)}`)
            .join('\n');

        return `\n\n=== PREVIOUSLY GENERATED IDEAS (DO NOT REPEAT THESE) ===
The following ideas have already been generated. You MUST create something COMPLETELY DIFFERENT:
${ideaList}

IMPORTANT: Your new idea must be distinctly different from ALL of the above. Do not use similar names, concepts, or approaches.
============================================\n\n`;
    }

    /**
     * Utility delay function for UX pacing
     * Can be disabled/reduced via IDEA_DELAY_MULTIPLIER env var (default: 0.1)
     */
    private delay(ms: number): Promise<void> {
        const actualDelay = Math.floor(ms * DELAY_MULTIPLIER);
        return new Promise(resolve => setTimeout(resolve, actualDelay));
    }

    /**
     * Check if an error is retryable (rate limit, timeout, network issues)
     */
    private isRetryableError(error: unknown): boolean {
        const errStr = String(error).toLowerCase();
        return (
            errStr.includes('rate limit') ||
            errStr.includes('429') ||
            errStr.includes('quota') ||
            errStr.includes('timeout') ||
            errStr.includes('econnreset') ||
            errStr.includes('etimedout') ||
            errStr.includes('network') ||
            errStr.includes('temporarily unavailable')
        );
    }

    /**
     * Retry LLM calls with exponential backoff
     */
    private async retryLLMCall<T>(
        fn: () => Promise<T>,
        operation: string,
        maxRetries = 3
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt === maxRetries || !this.isRetryableError(error)) {
                    throw lastError;
                }

                const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
                appLogger.warn(
                    this.name,
                    `${operation} failed (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms: ${getErrorMessage(error)}`
                );

                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }

        throw lastError ?? new Error(`${operation} failed after ${maxRetries} attempts`);
    }

    /**
     * Generate ideas for a session using the multi-stage pipeline
     * Each idea goes through 9 mandatory stages for deep research and quality
     */
    async generateIdeas(sessionId: string): Promise<void> {
        const session = await this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        if (session.ideasGenerated >= session.maxIdeas) {
            throw new Error('Maximum ideas already generated for this session');
        }

        this.logInfo(`Starting multi-stage idea generation for session ${sessionId}`);
        await this.updateSessionStatus(sessionId, 'generating');

        try {
            const remainingIdeas = session.maxIdeas - session.ideasGenerated;
            // Ensure research data exists, if not, run a quick version or the full pipeline
            if (!session.researchData) {
                this.logInfo(`No research data found for session ${sessionId}, running research pipeline first...`);
                await this.runResearchPipeline(sessionId);
                // Refresh session data
                const updatedSession = await this.getSession(sessionId);
                if (updatedSession) {
                    session.researchData = updatedSession.researchData;
                }
            }

            const categoryResearch = session.researchData
                ? this.buildResearchContext(session.researchData)
                : '';

            // Get all previous ideas for deduplication
            const allPreviousIdeas = await this.getAllPreviousIdeas();

            // Track ideas generated in this session
            const sessionIdeas: ProjectIdea[] = [];

            for (let i = 0; i < remainingIdeas; i++) {
                const ideaIndex = session.ideasGenerated + i + 1;

                // Add delay between ideas
                if (i > 0) {
                    await this.delay(3000);
                }

                // Build context for deduplication
                const allExisting = [...allPreviousIdeas, ...sessionIdeas];
                const previousIdeasContext = this.buildPreviousIdeasContext(
                    allExisting,
                    session.categories
                );

                // Run the full multi-stage pipeline for this idea
                const idea = await this.runIdeaPipeline({
                    session,
                    categoryResearch,
                    previousIdeasContext,
                    sessionIdeas,
                    ideaIndex,
                    allExisting
                });

                // Save idea to database
                await this.saveIdea(idea);
                sessionIdeas.push(idea);

                // Update session counter
                const db = await this.getDb();
                await db.prepare('UPDATE idea_sessions SET ideas_generated = ?, updated_at = ? WHERE id = ?')
                    .run(ideaIndex, Date.now(), sessionId);

                // Emit final completion
                this.emitIdeaProgress({
                    sessionId,
                    ideaIndex,
                    totalIdeas: session.maxIdeas,
                    currentIdea: idea,
                    stage: 'complete',
                    stageProgress: 100,
                    stageMessage: 'Idea fully generated'
                });

                await this.delay(500);
            }

            await this.updateSessionStatus(sessionId, 'completed');
            this.logInfo(`Multi-stage idea generation completed for session ${sessionId}`);
        } catch (error) {
            this.logError(`Idea generation failed: ${getErrorMessage(error as Error)}`);
            await this.updateSessionStatus(sessionId, 'active');
            throw error;
        }
    }

    /**
     * Regenerate a single idea (replace existing idea with new generation)
     */
    async regenerateIdea(ideaId: string): Promise<ProjectIdea> {
        // Get the original idea to find session and category
        const db = await this.getDb();
        const original = await db.prepare('SELECT * FROM project_ideas WHERE id = ?').get(ideaId) as ProjectIdea | undefined;

        if (!original) {
            throw new Error(`Idea not found: ${ideaId}`);
        }

        const session = await this.getSession(original.sessionId);
        if (!session) {
            throw new Error(`Session not found: ${original.sessionId}`);
        }

        this.logInfo(`Regenerating idea ${ideaId} in session ${session.id}`);

        // Prepare research context
        const categoryResearch = session.researchData
            ? this.buildResearchContext(session.researchData)
            : '';

        // Get all previous ideas for deduplication (excluding the one being regenerated)
        const allPreviousIdeas = await this.getAllPreviousIdeas();
        const filteredIdeas = allPreviousIdeas.filter(idea => idea.id !== ideaId);

        // Build context to avoid duplicating other ideas
        const previousIdeasContext = this.buildPreviousIdeasContext(
            filteredIdeas,
            session.categories
        );

        // Run the full pipeline with the same category as original
        const newIdea = await this.runIdeaPipeline({
            session,
            categoryResearch,
            previousIdeasContext,
            sessionIdeas: [],
            ideaIndex: 1, // Single idea regeneration
            allExisting: filteredIdeas
        });

        // Replace the old idea with the new one (keep same ID and timestamps)
        newIdea.id = ideaId;
        newIdea.createdAt = original.createdAt;
        newIdea.updatedAt = Date.now();

        // Update in database
        await db.prepare(`
            UPDATE project_ideas 
            SET title = ?, description = ?, category = ?, market_analysis = ?, 
                tech_stack = ?, estimated_effort = ?, status = ?, roadmap = ?, 
                competitors = ?, updated_at = ?
            WHERE id = ?
        `).run(
            newIdea.title,
            newIdea.description,
            newIdea.category,
            newIdea.marketAnalysis ?? null,
            newIdea.techStack ? JSON.stringify(newIdea.techStack) : null,
            newIdea.estimatedEffort ?? null,
            'pending', // Reset status to pending
            newIdea.roadmap ? JSON.stringify(newIdea.roadmap) : null,
            newIdea.ideaCompetitors ? JSON.stringify(newIdea.ideaCompetitors) : null,
            newIdea.updatedAt,
            ideaId
        );

        this.logInfo(`Successfully regenerated idea: ${ideaId}`);

        // Emit event
        this.deps.eventBus.emit('idea:regenerated', { ideaId });

        return newIdea;
    }

    /**
     * Run the full 9-stage pipeline for a single idea
     */
    private async runIdeaPipeline(params: {
        session: IdeaSession
        categoryResearch: string
        previousIdeasContext: string
        sessionIdeas: ProjectIdea[]
        ideaIndex: number
        allExisting: ProjectIdea[]
    }): Promise<ProjectIdea> {
        const { session, categoryResearch, previousIdeasContext, sessionIdeas, ideaIndex, allExisting } = params;
        const sessionId = session.id;

        // Select category for this idea
        const categoryIndex = Math.floor(Math.random() * session.categories.length);
        const category = session.categories[categoryIndex];

        // Stage 2: Generate initial idea seed
        this.emitIdeaProgress({
            sessionId,
            ideaIndex,
            totalIdeas: session.maxIdeas,
            stage: 'seed-generation',
            stageProgress: 0,
            stageMessage: 'Generating initial idea concept...'
        });

        const seedIdea = await this.stageGenerateSeed({
            session,
            category,
            categoryResearch,
            previousIdeasContext,
            sessionIdeas,
            ideaIndex,
            allExisting
        });
        await this.delay(1500);

        // Stage 3: Targeted idea-specific research
        this.emitIdeaProgress({
            sessionId,
            ideaIndex,
            totalIdeas: session.maxIdeas,
            currentIdea: seedIdea,
            stage: 'idea-research',
            stageProgress: 15,
            stageMessage: `Researching market for "${seedIdea.title}"...`
        });

        const researchContext = await this.stageIdeaResearch(session, seedIdea);
        seedIdea.researchContext = researchContext;
        await this.delay(2000);

        // Stage 4: Generate 10 project names
        this.emitIdeaProgress({
            sessionId,
            ideaIndex,
            totalIdeas: session.maxIdeas,
            currentIdea: seedIdea,
            stage: 'naming',
            stageProgress: 30,
            stageMessage: 'Generating project name suggestions...'
        });

        const nameSuggestions = await this.stageGenerateNames(session, seedIdea, researchContext);
        seedIdea.nameSuggestions = nameSuggestions;
        await this.delay(1500);

        // Stage 5: Long-form description
        this.emitIdeaProgress({
            sessionId,
            ideaIndex,
            totalIdeas: session.maxIdeas,
            currentIdea: seedIdea,
            stage: 'long-description',
            stageProgress: 45,
            stageMessage: 'Writing detailed project description...'
        });

        const { longDescription, valueProposition, explanation } = await this.stageLongDescription(session, seedIdea, researchContext);
        seedIdea.longDescription = longDescription;
        seedIdea.valueProposition = valueProposition;
        seedIdea.explanation = explanation;
        await this.delay(2500);

        return this.runIdeaRefinement(session, seedIdea, researchContext, ideaIndex);
    }

    /**
     * Extracted refinement stages (6-11) to reduce pipeline function length
     */
    private async runIdeaRefinement(
        session: IdeaSession,
        seedIdea: ProjectIdea,
        researchContext: string,
        ideaIndex: number
    ): Promise<ProjectIdea> {
        const sessionId = session.id;

        // Stage 6: Project roadmap
        this.emitIdeaProgress({
            sessionId,
            ideaIndex,
            totalIdeas: session.maxIdeas,
            currentIdea: seedIdea,
            stage: 'roadmap',
            stageProgress: 60,
            stageMessage: 'Creating project roadmap...'
        });

        const roadmap = await this.stageGenerateRoadmap(session, seedIdea);
        seedIdea.roadmap = roadmap;
        await this.delay(2000);

        // Stage 7: Technology stack
        this.emitIdeaProgress({
            sessionId,
            ideaIndex,
            totalIdeas: session.maxIdeas,
            currentIdea: seedIdea,
            stage: 'tech-stack',
            stageProgress: 75,
            stageMessage: 'Selecting technology stack...'
        });

        const techStack = await this.stageSelectTechStack(session, seedIdea);
        seedIdea.techStack = techStack;
        await this.delay(1500);

        // Stage 8: Competitor analysis
        this.emitIdeaProgress({
            sessionId,
            ideaIndex,
            totalIdeas: session.maxIdeas,
            currentIdea: seedIdea,
            stage: 'competitor-analysis',
            stageProgress: 85,
            stageMessage: 'Analyzing competitors and market position...'
        });

        const { competitors, advantages } = await this.stageCompetitorAnalysis(session, seedIdea, researchContext);
        seedIdea.ideaCompetitors = competitors;
        seedIdea.competitiveAdvantages = advantages;
        await this.delay(2000);

        seedIdea.generationStage = 'marketing-plan';
        await this.delay(2000);

        // Stage 9: User personas & journey maps
        this.emitIdeaProgress({
            sessionId,
            ideaIndex,
            totalIdeas: session.maxIdeas,
            currentIdea: seedIdea,
            stage: 'personas',
            stageProgress: 88,
            stageMessage: 'Generating user personas and journey maps...'
        });

        const { personas, journey } = await this.stageGeneratePersonas(session, seedIdea);
        seedIdea.personas = personas;
        seedIdea.userJourney = journey;
        await this.delay(2000);

        // Stage 10: SWOT & monetization
        this.emitIdeaProgress({
            sessionId,
            ideaIndex,
            totalIdeas: session.maxIdeas,
            currentIdea: seedIdea,
            stage: 'business-strategy',
            stageProgress: 92,
            stageMessage: 'Developing SWOT analysis and monetization strategy...'
        });

        const { swot, businessModel } = await this.stageGenerateBusinessStrategy(session, seedIdea);
        seedIdea.swot = swot;
        seedIdea.businessModel = businessModel;
        await this.delay(2000);

        // Stage 11: GTM & first 100 users
        this.emitIdeaProgress({
            sessionId,
            ideaIndex,
            totalIdeas: session.maxIdeas,
            currentIdea: seedIdea,
            stage: 'marketing-plan',
            stageProgress: 96,
            stageMessage: 'Creating Go-To-Market plan and launch checklist...'
        });

        const marketingPlan = await this.stageGenerateGTMPlan(session, seedIdea);
        seedIdea.marketingPlan = marketingPlan;
        await this.delay(2000);

        // Stage 12: Finalize
        this.emitIdeaProgress({
            sessionId,
            ideaIndex,
            totalIdeas: session.maxIdeas,
            currentIdea: seedIdea,
            stage: 'finalizing',
            stageProgress: 98,
            stageMessage: 'Finalizing project idea...'
        });

        seedIdea.generationStage = 'complete';
        await this.delay(500);

        return seedIdea;
    }

    // ==================== Pipeline Stage Methods ====================

    /**
     * Stage 2: Generate initial idea seed
     */
    private async stageGenerateSeed(params: {
        session: IdeaSession
        category: IdeaCategory
        categoryResearch: string
        previousIdeasContext: string
        sessionIdeas: ProjectIdea[]
        ideaIndex: number
        allExisting: ProjectIdea[]
    }): Promise<ProjectIdea> {
        const { session, category, categoryResearch, previousIdeasContext, sessionIdeas, ideaIndex, allExisting } = params;
        const sessionContext = sessionIdeas.length > 0
            ? `\nIdeas already in this session:\n${sessionIdeas.map(i => `- ${i.title}`).join('\n')}\n`
            : '';

        // Try up to 3 times to generate a unique idea
        const maxRetries = 3;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const prompt = this.buildSeedGenerationPrompt({
                category,
                categoryResearch,
                previousIdeasContext,
                sessionContext,
                ideaIndex,
                attemptNumber: attempt,
                customPrompt: session.customPrompt
            });

            const systemPrompt = await this.getSeedSystemPrompt(session.goal);

            const messages: Message[] = [
                {
                    id: uuidv4(),
                    role: 'system',
                    content: systemPrompt,
                    timestamp: new Date()
                },
                {
                    id: uuidv4(),
                    role: 'user',
                    content: prompt,
                    timestamp: new Date()
                }
            ];

            const response = await this.retryLLMCall(
                async () => await this.deps.llmService.chat(
                    messages,
                    session.model,
                    undefined,
                    session.provider,
                    { temperature: 0.9 }
                ),
                'Generate seed idea'
            );

            const idea = this.parseSeedResponse(response.content, category, session.id);

            if (!this.isIdeaTooSimilar(idea, allExisting)) {
                return idea;
            }

            this.logWarn(`Seed "${idea.title}" too similar, retrying (${attempt + 1}/${maxRetries})`);
            await this.delay(1000);
        }

        // Final attempt with forced uniqueness
        const fallbackPrompt = this.buildSeedGenerationPrompt({
            category,
            categoryResearch,
            previousIdeasContext,
            sessionContext,
            ideaIndex,
            attemptNumber: maxRetries,
            customPrompt: session.customPrompt
        });

        const systemPrompt = await this.getSeedSystemPrompt(session.goal);

        const messages: Message[] = [
            { id: uuidv4(), role: 'system', content: systemPrompt, timestamp: new Date() },
            { id: uuidv4(), role: 'user', content: fallbackPrompt, timestamp: new Date() }
        ];

        const response = await this.retryLLMCall(
            async () => await this.deps.llmService.chat(messages, session.model, undefined, session.provider, { temperature: 1.0 }),
            'Generate seed idea (fallback)'
        );
        const idea = this.parseSeedResponse(response.content, category, session.id);
        idea.title = `${idea.title} (v${Date.now() % 1000})`;
        return idea;
    }

    /**
     * Stage 3: Targeted idea-specific research
     */
    private async stageIdeaResearch(session: IdeaSession, idea: ProjectIdea): Promise<string> {
        const prompt = `Research the market specifically for this project idea:

Title: ${idea.title}
Category: ${idea.category}
Description: ${idea.description}

Provide a detailed analysis including:
1. Specific market segment and size for this exact idea
2. Existing similar products and their positioning
3. Target user demographics and behaviors
4. Current market gaps this idea could fill
5. Recent trends (${CURRENT_YEAR}) affecting this space
6. Potential challenges and risks

Format as a comprehensive research brief that will guide product development.`;

        const messages: Message[] = [
            {
                id: uuidv4(),
                role: 'system',
                content: `You are a senior market research analyst specializing in ${idea.category} products. Provide detailed, actionable research based on ${CURRENT_YEAR} market conditions. Be specific and data-driven.`,
                timestamp: new Date()
            },
            { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
        ];

        const response = await this.retryLLMCall(
            async () => await this.deps.llmService.chat(messages, session.model, undefined, session.provider),
            'Generate category research'
        );
        return response.content;
    }

    /**
     * Stage 4: Generate 10 project names
     */
    private async stageGenerateNames(session: IdeaSession, idea: ProjectIdea, research: string): Promise<string[]> {
        const prompt = `Generate exactly 10 unique, memorable project names for:

Title: ${idea.title}
Category: ${idea.category}
Description: ${idea.description}

Market Context:
${research.slice(0, 1500)}

Requirements:
- Names should be brandable and memorable
- Mix of styles: clever wordplay, descriptive, abstract, compound words
- Easy to pronounce and spell
- Available as potential domain names
- Appropriate for the ${idea.category} category

Respond in JSON:
{
    "names": ["Name1", "Name2", "Name3", "Name4", "Name5", "Name6", "Name7", "Name8", "Name9", "Name10"]
}`;

        const messages: Message[] = [
            {
                id: uuidv4(),
                role: 'system',
                content: 'You are a branding expert. Generate creative, memorable project names. Always respond in valid JSON.',
                timestamp: new Date()
            },
            { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
        ];

        const response = await this.retryLLMCall(
            async () => await this.deps.llmService.chat(messages, session.model, undefined, session.provider),
            'Generate alternative names'
        );
        return this.parseNamesResponse(response.content);
    }

    /**
     * Stage 5: Long-form description
     */
    private async stageLongDescription(session: IdeaSession, idea: ProjectIdea, research: string): Promise<{
        longDescription: string
        valueProposition: string
        explanation: string
    }> {
        const prompt = `Write a comprehensive, professional description for this project:

Title: ${idea.title}
Category: ${idea.category}
Short Description: ${idea.description}

Market Research:
${research.slice(0, 2000)}

Create:
1. A detailed long description (3-4 paragraphs) covering:
   - The problem being solved
   - The solution and how it works
   - Target users and use cases
   - Key features and benefits
   - Why this matters now

2. A compelling value proposition (2-3 sentences)

3. A technical explanation (2 paragraphs) of what the project does and how

Requirements:
- Professional, polished writing
- No spelling or grammar errors
- Specific and concrete, not generic
- Suitable for a pitch deck or product page

Respond in JSON:
{
    "longDescription": "...",
    "valueProposition": "...",
    "explanation": "..."
}`;

        const messages: Message[] = [
            {
                id: uuidv4(),
                role: 'system',
                content: 'You are a senior product copywriter. Write compelling, professional product descriptions. Always respond in valid JSON.',
                timestamp: new Date()
            },
            { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
        ];

        const response = await this.retryLLMCall(
            async () => await this.deps.llmService.chat(messages, session.model, undefined, session.provider),
            'Generate long description'
        );
        return this.parseLongDescriptionResponse(response.content);
    }

    /**
     * Stage 6: Generate project roadmap
     */
    private async stageGenerateRoadmap(session: IdeaSession, idea: ProjectIdea): Promise<ProjectRoadmap> {
        const prompt = `Create a realistic development roadmap for:

Title: ${idea.title}
Category: ${idea.category}
Description: ${idea.description}
${idea.longDescription ? `\nDetailed Description: ${idea.longDescription.slice(0, 1000)}` : ''}

Create a structured roadmap with:
1. MVP phase (minimum viable product)
2. 3-4 additional development phases
3. Each phase should have: name, description, duration, and deliverables
4. Total timeline should be realistic for a small team (6-18 months)

Respond in JSON:
{
    "mvp": {
        "name": "MVP",
        "description": "...",
        "duration": "X weeks/months",
        "deliverables": ["...", "..."],
        "order": 0
    },
    "phases": [
        {
            "name": "Phase 1: ...",
            "description": "...",
            "duration": "X weeks/months",
            "deliverables": ["...", "..."],
            "order": 1
        }
    ],
    "totalDuration": "X months"
}`;

        const messages: Message[] = [
            {
                id: uuidv4(),
                role: 'system',
                content: 'You are a technical product manager. Create realistic, actionable development roadmaps. Always respond in valid JSON.',
                timestamp: new Date()
            },
            { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
        ];

        const response = await this.retryLLMCall(
            async () => await this.deps.llmService.chat(messages, session.model, undefined, session.provider),
            'Generate roadmap'
        );
        return this.parseRoadmapResponse(response.content);
    }

    /**
     * Stage 7: Select technology stack
     */
    private async stageSelectTechStack(session: IdeaSession, idea: ProjectIdea): Promise<TechStack> {
        const categoryTechContext: Record<IdeaCategory, string> = {
            'website': 'web technologies, frameworks like React/Vue/Angular, Node.js, databases',
            'mobile-app': 'mobile frameworks like React Native/Flutter/Swift/Kotlin, mobile backends',
            'game': 'game engines like Unity/Unreal/Godot, graphics libraries, multiplayer tech',
            'cli-tool': 'languages like Rust/Go/Python/Node.js, CLI frameworks, distribution',
            'desktop': 'Electron/Tauri/native frameworks, cross-platform considerations',
            'other': 'appropriate technologies for the specific use case'
        };

        const prompt = `Recommend a technology stack for:

Title: ${idea.title}
Category: ${idea.category}
Description: ${idea.description}
${idea.roadmap ? `\nMVP Features: ${idea.roadmap.mvp.deliverables.join(', ')}` : ''}

Context: This is a ${idea.category} project requiring ${categoryTechContext[idea.category]}.

Provide justified recommendations for:
1. Frontend (if applicable)
2. Backend (if applicable)
3. Database (if applicable)
4. Infrastructure (hosting, deployment, CI/CD)
5. Other tools/services needed

For each choice, explain WHY it's the right choice and list alternatives.

Respond in JSON:
{
    "frontend": [{"name": "Tech", "reason": "Why", "alternatives": ["Alt1", "Alt2"]}],
    "backend": [{"name": "Tech", "reason": "Why", "alternatives": ["Alt1"]}],
    "database": [{"name": "Tech", "reason": "Why", "alternatives": ["Alt1"]}],
    "infrastructure": [{"name": "Tech", "reason": "Why", "alternatives": ["Alt1"]}],
    "other": [{"name": "Tech", "reason": "Why", "alternatives": []}]
}`;

        const messages: Message[] = [
            {
                id: uuidv4(),
                role: 'system',
                content: `You are a senior software architect with expertise in ${idea.category} development. Recommend modern, production-ready technologies for ${CURRENT_YEAR}. Always respond in valid JSON.`,
                timestamp: new Date()
            },
            { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
        ];

        const response = await this.retryLLMCall(
            async () => await this.deps.llmService.chat(messages, session.model, undefined, session.provider),
            'Generate tech stack'
        );
        return this.parseTechStackResponse(response.content);
    }

    /**
     * Stage 8: Competitor analysis
     */
    private async stageCompetitorAnalysis(session: IdeaSession, idea: ProjectIdea, research: string): Promise<{
        competitors: IdeaCompetitor[]
        advantages: string[]
    }> {
        const prompt = `Analyze competitors for this specific project idea:

Title: ${idea.title}
Category: ${idea.category}
Description: ${idea.description}
Value Proposition: ${idea.valueProposition ?? idea.description}

Market Research Context:
${research.slice(0, 1500)}

Identify 3-5 direct or indirect competitors and analyze:
1. Each competitor's strengths and weaknesses
2. Features they're missing that this project could offer
3. Their market position
4. How this project can differentiate

Also provide 5 competitive advantages this project would have.

Respond in JSON:
{
    "competitors": [
        {
            "name": "Competitor Name",
            "description": "What they do",
            "url": "https://...",
            "strengths": ["...", "..."],
            "weaknesses": ["...", "..."],
            "missingFeatures": ["...", "..."],
            "marketPosition": "Leader/Challenger/Niche",
            "differentiationOpportunity": "How to beat them"
        }
    ],
    "advantages": ["Advantage 1", "Advantage 2", "Advantage 3", "Advantage 4", "Advantage 5"]
}`;

        const messages: Message[] = [
            {
                id: uuidv4(),
                role: 'system',
                content: `You are a competitive intelligence analyst. Provide thorough competitor analysis based on ${CURRENT_YEAR} market conditions. Always respond in valid JSON.`,
                timestamp: new Date()
            },
            { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
        ];

        const response = await this.retryLLMCall(
            async () => await this.deps.llmService.chat(messages, session.model, undefined, session.provider),
            'Analyze competitors'
        );
        return this.parseCompetitorResponse(response.content);
    }

    /**
     * Enrich an existing idea with additional details (simple enrichment)
     * For full multi-stage enrichment, use the generation pipeline
     */
    async enrichIdea(ideaId: string): Promise<ProjectIdea> {
        const idea = await this.getIdea(ideaId);
        if (!idea) {
            throw new Error(`Idea not found: ${ideaId}`);
        }

        const session = await this.getSession(idea.sessionId);
        if (!session) {
            throw new Error(`Session not found: ${idea.sessionId}`);
        }

        this.logInfo(`Enriching idea: ${ideaId}`);

        const prompt = `Given this project idea:
Title: ${idea.title}
Category: ${idea.category}
Description: ${idea.description}

Please provide:
1. A detailed explanation of what the project does and how it works (2-3 paragraphs)
2. A compelling value proposition (1-2 sentences)
3. Exactly 10 creative name suggestions for this project
4. 5 competitive advantages this project would have

Respond in JSON format:
{
    "explanation": "...",
    "valueProposition": "...",
    "nameSuggestions": ["name1", "name2", ...],
    "competitiveAdvantages": ["adv1", "adv2", ...]
}`;

        const messages: Message[] = [
            {
                id: uuidv4(),
                role: 'system',
                content: 'You are a product strategist. Provide detailed enrichment for project ideas. Always respond in valid JSON format.',
                timestamp: new Date()
            },
            {
                id: uuidv4(),
                role: 'user',
                content: prompt,
                timestamp: new Date()
            }
        ];

        const response = await this.retryLLMCall(
            async () => await this.deps.llmService.chat(messages, session.model, undefined, session.provider),
            'Enrich idea'
        );

        // Parse enrichment
        const enrichment = this.parseEnrichmentResponse(response.content);

        // Update idea in database
        const db = await this.getDb();
        await db.prepare(`
            UPDATE project_ideas
            SET explanation = ?, value_proposition = ?, name_suggestions = ?, competitive_advantages = ?, updated_at = ?
            WHERE id = ?
        `).run(
            enrichment.explanation,
            enrichment.valueProposition,
            JSON.stringify(enrichment.nameSuggestions),
            JSON.stringify(enrichment.competitiveAdvantages),
            Date.now(),
            ideaId
        );

        return {
            ...idea,
            explanation: enrichment.explanation,
            valueProposition: enrichment.valueProposition,
            nameSuggestions: enrichment.nameSuggestions,
            competitiveAdvantages: enrichment.competitiveAdvantages
        };
    }

    // ==================== Idea Management ====================

    /**
     * Get an idea by ID
     */
    async getIdea(id: string): Promise<ProjectIdea | null> {
        const db = await this.getDb();
        const row = await db.prepare('SELECT * FROM project_ideas WHERE id = ?').get<JsonObject>(id);
        return row ? this.mapRowToIdea(row) : null;
    }

    /**
     * Get ideas for a session
     */
    async getIdeas(sessionId?: string): Promise<ProjectIdea[]> {
        const db = await this.getDb();
        const sql = sessionId
            ? 'SELECT * FROM project_ideas WHERE session_id = ? ORDER BY created_at DESC'
            : 'SELECT * FROM project_ideas ORDER BY created_at DESC';

        const rows = sessionId
            ? await db.prepare(sql).all<JsonObject>(sessionId)
            : await db.prepare(sql).all<JsonObject>();

        return rows.map(row => this.mapRowToIdea(row));
    }

    /**
     * Save a new idea with all pipeline-generated fields
     */
    private async saveIdea(idea: ProjectIdea): Promise<void> {
        const db = await this.getDb();
        const serialized = this.serializeIdeaForDb(idea);

        await db.prepare(`
            INSERT INTO project_ideas (
                id, session_id, title, category, description, explanation, value_proposition,
                name_suggestions, competitive_advantages, market_research, status, metadata,
                long_description, roadmap, tech_stack, idea_competitors, generation_stage, research_context,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            idea.id,
            idea.sessionId,
            idea.title,
            idea.category,
            idea.description,
            idea.explanation ?? null,
            idea.valueProposition ?? null,
            serialized.nameSuggestions,
            serialized.competitiveAdvantages,
            serialized.marketResearch,
            idea.status,
            serialized.meta,
            idea.longDescription ?? null,
            serialized.roadmap,
            serialized.techStack,
            serialized.competitors,
            idea.generationStage ?? 'complete',
            idea.researchContext ?? null,
            idea.createdAt,
            idea.updatedAt
        );
    }

    private serializeIdeaForDb(idea: ProjectIdea) {
        return {
            meta: JSON.stringify(idea.metadata ?? {}),
            roadmap: idea.roadmap ? JSON.stringify(idea.roadmap) : null,
            techStack: idea.techStack ? JSON.stringify(idea.techStack) : null,
            competitors: idea.ideaCompetitors ? JSON.stringify(idea.ideaCompetitors) : null,
            nameSuggestions: idea.nameSuggestions ? JSON.stringify(idea.nameSuggestions) : null,
            competitiveAdvantages: idea.competitiveAdvantages ? JSON.stringify(idea.competitiveAdvantages) : null,
            marketResearch: idea.marketResearch ? JSON.stringify(idea.marketResearch) : null
        };
    }

    /**
     * Update idea status
     */
    async updateIdeaStatus(id: string, status: IdeaStatus): Promise<void> {
        const db = await this.getDb();
        await db.prepare('UPDATE project_ideas SET status = ?, updated_at = ? WHERE id = ?')
            .run(status, Date.now(), id);
    }

    // ==================== Approval Workflow ====================

    /**
     * Approve an idea and create a project
     */
    async approveIdea(ideaId: string, projectPath: string, selectedName?: string): Promise<Project> {
        const idea = await this.getIdea(ideaId);
        if (!idea) {
            throw new Error(`Idea not found: ${ideaId}`);
        }

        this.logInfo(`Approving idea: ${ideaId}, creating project at ${projectPath}`);

        // Enrich the idea if not already enriched
        let enrichedIdea = idea;
        if (!idea.explanation || !idea.nameSuggestions) {
            enrichedIdea = await this.enrichIdea(ideaId);
        }

        // Use selected name if provided
        if (selectedName) {
            enrichedIdea.title = selectedName;
        }

        // Scaffold the project
        await this.deps.projectScaffoldService.scaffoldProject(enrichedIdea, projectPath);

        // Create project in database
        const project = await this.deps.databaseService.createProject(
            enrichedIdea.title,
            projectPath,
            enrichedIdea.description
        );

        // Update idea with project reference
        const db = await this.getDb();
        await db.prepare('UPDATE project_ideas SET status = ?, project_id = ?, updated_at = ? WHERE id = ?')
            .run('approved', project.id, Date.now(), ideaId);

        this.logInfo(`Project created: ${project.id} from idea ${ideaId}`);

        return project;
    }

    /**
     * Reject an idea
     */
    async rejectIdea(ideaId: string): Promise<void> {
        await this.updateIdeaStatus(ideaId, 'rejected');
        this.logInfo(`Idea rejected: ${ideaId}`);
    }

    // ==================== Logo Generation ====================

    /**
     * Check if logo generation is available (Antigravity logged in)
     */
    async canGenerateLogo(): Promise<boolean> {
        try {
            const accounts = await this.deps.databaseService.getLinkedAccounts();
            return accounts.some(acc =>
                acc.provider === 'antigravity' &&
                acc.isActive &&
                acc.accessToken
            );
        } catch {
            return false;
        }
    }

    /**
     * Generate a logo for an idea using the best available provider
     */
    async generateLogo(ideaId: string, prompt: string): Promise<string> {
        const idea = await this.getIdea(ideaId);
        if (!idea) {
            throw new Error(`Idea not found: ${ideaId}`);
        }

        this.logInfo(`Generating logo for idea: ${ideaId}`);

        const logoPrompt = `Create a professional, modern app icon or logo for: "${idea.title}".
${prompt ? `Additional requirements: ${prompt}` : ''}
Style: Clean, minimal, suitable for app store listing.
The logo should be simple, memorable, and work well at small sizes.`;

        try {
            // Priority 1: Local Image Generation (Ollama/SD-WebUI/Pollinations)
            const localLogoPath = await this.deps.localImageService.generateImage({
                prompt: logoPrompt,
                width: 1024,
                height: 1024
            });

            if (localLogoPath) {
                const db = await this.getDb();
                await db.prepare('UPDATE project_ideas SET logo_path = ?, updated_at = ? WHERE id = ?')
                    .run(localLogoPath, Date.now(), ideaId);

                this.logInfo(`Local logo generated for idea: ${ideaId}`);
                return localLogoPath;
            }

            // Priority 2: Remote Image Generation (Gemini)
            const messages: Message[] = [
                {
                    id: uuidv4(),
                    role: 'user',
                    content: logoPrompt,
                    timestamp: new Date()
                }
            ];

            const response = await this.retryLLMCall(
                async () => await this.deps.llmService.chat(
                    messages,
                    'gemini-2.0-flash-preview-image-generation',
                    undefined,
                    'antigravity'
                ),
                'Generate logo'
            );

            if (response.images && response.images.length > 0) {
                const logoPath = response.images[0];
                const db = await this.getDb();
                await db.prepare('UPDATE project_ideas SET logo_path = ?, updated_at = ? WHERE id = ?')
                    .run(logoPath, Date.now(), ideaId);

                this.logInfo(`Remote logo generated for idea: ${ideaId}`);
                return logoPath;
            }

            throw new Error('No logo image generated by any provider');
        } catch (error) {
            appLogger.error('IdeaGeneratorService', 'Logo generation stage failed', error as Error);
            throw error;
        }
    }

    // ==================== Helper Methods ====================

    private async getDb() {
        // Access the database through the public getDatabase() method
        return this.deps.databaseService.getDatabase();
    }

    private mapRowToSession(row: JsonObject): IdeaSession {
        return {
            id: String(row.id),
            model: String(row.model),
            provider: String(row.provider),
            categories: safeJsonParse(row.categories as string, []) as IdeaCategory[],
            maxIdeas: Number(row.max_ideas),
            ideasGenerated: Number(row.ideas_generated),
            status: String(row.status) as IdeaSessionStatus,
            researchData: row.research_data
                ? safeJsonParse<ResearchData>(row.research_data as string, {} as ResearchData)
                : undefined,
            customPrompt: row.custom_prompt ? String(row.custom_prompt) : undefined,
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at)
        };
    }

    private mapRowToIdea(row: JsonObject): ProjectIdea {
        return {
            id: String(row.id),
            sessionId: String(row.session_id),
            title: String(row.title),
            category: String(row.category) as IdeaCategory,
            description: String(row.description ?? ''),
            explanation: row.explanation as string | undefined,
            valueProposition: row.value_proposition as string | undefined,
            longDescription: row.long_description as string | undefined,
            nameSuggestions: row.name_suggestions
                ? safeJsonParse(row.name_suggestions as string, []) as string[]
                : undefined,
            competitiveAdvantages: row.competitive_advantages
                ? safeJsonParse(row.competitive_advantages as string, []) as string[]
                : undefined,
            roadmap: row.roadmap
                ? safeJsonParse(row.roadmap as string, undefined) as ProjectRoadmap | undefined
                : undefined,
            techStack: row.tech_stack
                ? safeJsonParse(row.tech_stack as string, undefined) as TechStack | undefined
                : undefined,
            ideaCompetitors: row.idea_competitors
                ? safeJsonParse(row.idea_competitors as string, []) as IdeaCompetitor[]
                : undefined,
            marketResearch: row.market_research
                ? safeJsonParse(row.market_research as string, undefined)
                : undefined,
            generationStage: row.generation_stage ? (row.generation_stage as IdeaGenerationStage) : 'complete',
            researchContext: row.research_context as string | undefined,
            status: String(row.status) as IdeaStatus,
            projectId: row.project_id as string | undefined,
            logoPath: row.logo_path as string | undefined,
            metadata: safeJsonParse(row.metadata as string, {}),
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at)
        };
    }

    private emitResearchProgress(
        sessionId: string,
        stage: ResearchStage,
        progress: number,
        message?: string
    ): void {
        const event: ResearchProgress = { sessionId, stage, progress, message };
        this.deps.eventBus.emit('ideas:research-progress', event);
    }

    private emitIdeaProgress(options: {
        sessionId: string
        ideaIndex: number
        totalIdeas: number
        currentIdea?: Partial<ProjectIdea>
        stage: IdeaGenerationStage
        stageProgress?: number
        stageMessage?: string
    }): void {
        const event: IdeaProgress = {
            sessionId: options.sessionId,
            ideaIndex: options.ideaIndex,
            totalIdeas: options.totalIdeas,
            currentIdea: options.currentIdea,
            stage: options.stage,
            stageProgress: options.stageProgress,
            stageMessage: options.stageMessage
        };
        this.deps.eventBus.emit('ideas:idea-progress', event);
    }

    private buildResearchContext(research: ResearchData): string {
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

    // ==================== Seed Generation Helpers ====================

    private async getSeedSystemPrompt(sessionGoal?: string): Promise<string> {
        let basePrompt = `You are an elite startup advisor and venture capital strategist with 20+ years of experience identifying breakthrough ideas.

Your task is to generate a UNIQUE, INNOVATIVE initial concept (seed idea) based on deep category research.

Key principles:
1. CATEGORY-FIRST: You have thoroughly researched the category before proposing any idea
2. UNIQUENESS: Every idea must be distinctly different from existing solutions
3. SPECIFICITY: Target specific user pain points with concrete solutions
4. FEASIBILITY: Ideas should be buildable by a small team within 6-12 months
5. TIMELY: Leverage ${CURRENT_YEAR} technology trends and market conditions

This is ONLY the seed idea. It will be further researched and refined in subsequent stages.

Always respond in valid JSON format.
                
CRITICAL RULE: You MUST strictly adhere to the user's selected category. Do NOT pivot to AI, machine learning, or unrelated trends unless they are the primary category or specifically requested. If the category is "game", focus on gameplay, mechanics, and fun, NOT just "AI-driven NPCs".`;

        // Add brain context about the user
        try {
            const brainContext = await this.deps.brainService.getBrainContext(sessionGoal);
            const formattedBrain = this.deps.brainService.formatBrainContext(brainContext);

            if (formattedBrain) {
                basePrompt += `\n\n${formattedBrain}`;
            }
        } catch (error) {
            // Gracefully handle brain errors - don't fail idea generation
            appLogger.warn(this.name, `Could not fetch brain context: ${getErrorMessage(error as Error)}`);
        }

        return basePrompt;
    }

    private buildSeedGenerationPrompt(options: {
        category: IdeaCategory
        categoryResearch: string
        previousIdeasContext: string
        sessionContext: string
        ideaIndex: number
        attemptNumber: number
        customPrompt?: string
    }): string {
        const { category, categoryResearch, previousIdeasContext, sessionContext, ideaIndex, attemptNumber, customPrompt } = options;

        const categoryNames: Record<IdeaCategory, string> = {
            'website': 'web application',
            'mobile-app': 'mobile application',
            'game': 'video game',
            'cli-tool': 'command-line tool',
            'desktop': 'desktop application',
            'other': 'software application'
        };

        const attemptGuidance = attemptNumber > 0
            ? `\n\n⚠️ CRITICAL: Previous attempts generated ideas too similar to existing ones. This is attempt #${attemptNumber + 1}. You MUST be MORE CREATIVE. Try a completely different angle, niche, or approach.\n`
            : '';

        const creativityPrompts = [
            'Focus on an underserved niche or demographic that is often overlooked',
            'Combine two unrelated industries in an innovative way',
            'Address a problem that has emerged or intensified in the last 2 years',
            'Think about daily frustrations professionals face but accept as normal',
            'Consider accessibility, inclusion, or sustainability opportunities'
        ];
        const creativityHint = creativityPrompts[ideaIndex % creativityPrompts.length];

        return `Generate a SEED IDEA for a ${categoryNames[category]} (#${ideaIndex}).
${attemptGuidance}
=== DEEP CATEGORY RESEARCH (${CURRENT_YEAR}) ===
${categoryResearch}
${previousIdeasContext}${sessionContext}
=== SEED IDEA REQUIREMENTS ===
This is the INITIAL concept that will be further researched and developed.

1. UNIQUE: Must be distinctly different from any existing or previously generated ideas
2. SPECIFIC: Target a clear, specific user pain point
3. NOVEL: Not a clone of existing products - bring something new
4. TIMELY: Relevant to ${CURRENT_YEAR} market conditions and technology
5. RELEVANT: Strictly stay within the ${categoryNames[category]} category. Do NOT focus on AI/ML unless it is essential to the core functionality of this specific category.

💡 Creative direction: ${creativityHint}
${customPrompt ? `\n\n=== USER CONSTRAINTS ===\n${this.sanitizeCustomPrompt(customPrompt)}\n` : ''}
=== THINK DEEPLY ===
Before responding, carefully consider:
- What SPECIFIC problem does this solve that isn't well-addressed?
- WHO exactly will use this and WHY will they care?
- What makes this DIFFERENT from existing solutions?
- Why is ${CURRENT_YEAR} the right time for this idea?

Respond ONLY with valid JSON:
{
    "title": "Unique, Memorable Project Name",
    "description": "2-3 sentences: the specific problem, target users, and key differentiator"
}`;
    }

    private parseSeedResponse(content: string, category: IdeaCategory, sessionId: string): ProjectIdea {
        const now = Date.now();
        try {
            const parsed = this.parseJsonResponse<{
                title?: string
                description?: string
            }>(content, { title: 'Generated Project Idea', description: content.slice(0, 500) });

            return {
                id: uuidv4(),
                sessionId,
                title: parsed.title ?? 'Generated Project Idea',
                category,
                description: parsed.description ?? content.slice(0, 500),
                status: 'pending',
                generationStage: 'seed-generation',
                createdAt: now,
                updatedAt: now
            };
        } catch (error) {
            this.logWarn(`Failed to parse seed response: ${getErrorMessage(error as Error)}`);

            return {
                id: uuidv4(),
                sessionId,
                title: 'Generated Project Idea',
                category,
                description: content.slice(0, 500),
                status: 'pending',
                generationStage: 'seed-generation',
                createdAt: now,
                updatedAt: now
            };
        }
    }

    // ==================== Stage Response Parsers ====================

    /**
     * Generic JSON parser with markdown code block extraction
     */
    private parseJsonResponse<T>(content: string, defaultValue: T | null = null): T {
        try {
            let jsonStr = content;
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1].trim();
            }
            return safeJsonParse(jsonStr, defaultValue) as T;
        } catch (error) {
            this.logWarn(`Failed to parse JSON response: ${getErrorMessage(error as Error)}`);
            if (defaultValue !== null) {
                return defaultValue;
            }
            throw error; // Re-throw if no default value is provided
        }
    }

    private parseNamesResponse(content: string): string[] {
        try {
            const parsed = this.parseJsonResponse<{ names: string[] }>(content, { names: [] });
            if (parsed.names.length === 0) {
                appLogger.warn('IdeaGeneratorService', 'Failed to parse alternative names response');
                return ['Alternative Name 1', 'Alternative Name 2', 'Alternative Name 3'];
            }
            return parsed.names;
        } catch (error) {
            this.logWarn(`Failed to parse names: ${getErrorMessage(error as Error)}`);
            return ['Alternative Name 1', 'Alternative Name 2', 'Alternative Name 3'];
        }
    }

    private parseLongDescriptionResponse(content: string): {
        longDescription: string
        valueProposition: string
        explanation: string
    } {
        try {
            const parsed = this.parseJsonResponse<{
                longDescription?: string
                valueProposition?: string
                explanation?: string
            }>(content, {
                longDescription: 'A comprehensive solution addressing key user needs.',
                valueProposition: 'Delivers unique value to users.',
                explanation: 'An innovative approach to solving the problem.'
            });

            return {
                longDescription: parsed.longDescription ?? 'A comprehensive solution addressing key user needs.',
                valueProposition: parsed.valueProposition ?? 'Delivers unique value to users.',
                explanation: parsed.explanation ?? 'An innovative approach to solving the problem.'
            };
        } catch (error) {
            this.logWarn(`Failed to parse description: ${getErrorMessage(error as Error)}`);
            return {
                longDescription: 'A comprehensive solution addressing key user needs.',
                valueProposition: 'Delivers unique value to users.',
                explanation: 'An innovative approach to solving the problem.'
            };
        }
    }

    private getPhaseDetails(phase: Partial<RoadmapPhase> | undefined, defaultName: string, defaultOrder: number): { name: string; description: string; duration: string; order: number } {
        return {
            name: phase?.name ?? defaultName,
            description: phase?.description ?? 'Development phase',
            duration: phase?.duration ?? '1-2 months',
            order: phase?.order ?? defaultOrder
        };
    }

    private sanitizeRoadmapPhase(phase: Partial<RoadmapPhase> | undefined, defaultName: string, defaultOrder: number): RoadmapPhase {
        const details = this.getPhaseDetails(phase, defaultName, defaultOrder);
        return {
            ...details,
            deliverables: Array.isArray(phase?.deliverables) ? phase.deliverables : []
        };
    }

    private getDefaultRoadmap(): ProjectRoadmap {
        return {
            mvp: {
                name: 'MVP',
                description: 'Minimum viable product',
                duration: '2-3 months',
                deliverables: ['Core features'],
                order: 0
            },
            phases: [],
            totalDuration: '6-12 months'
        };
    }

    private parseRoadmapResponse(content: string): ProjectRoadmap {
        try {
            const parsed = this.parseJsonResponse<ProjectRoadmap>(content);
            const phases = Array.isArray(parsed.phases) ? parsed.phases : [];

            return {
                mvp: this.sanitizeRoadmapPhase(parsed.mvp, 'MVP', 0),
                phases: phases.map((p, i) => this.sanitizeRoadmapPhase(p, `Phase ${i + 1}`, i + 1)),
                totalDuration: parsed.totalDuration
            };
        } catch (error) {
            this.logWarn(`Failed to parse roadmap: ${getErrorMessage(error as Error)}`);
            return this.getDefaultRoadmap();
        }
    }

    private parseTechStackResponse(content: string): TechStack {
        try {
            let jsonStr = content;
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1].trim();
            }

            const parsed = safeJsonParse(jsonStr, {
                frontend: [{ name: 'React', reason: 'Popular frontend library', alternatives: ['Vue', 'Angular'] }],
                backend: [{ name: 'Node.js', reason: 'JavaScript runtime', alternatives: ['Python', 'Go'] }],
                database: [{ name: 'PostgreSQL', reason: 'Reliable database', alternatives: ['MySQL', 'MongoDB'] }],
                infrastructure: [{ name: 'AWS', reason: 'Cloud platform', alternatives: ['Google Cloud', 'Azure'] }],
                other: []
            });

            const mapTechChoices = (arr?: Array<{ name?: string; reason?: string; alternatives?: string[] }>): TechChoice[] => {
                const safeArr = Array.isArray(arr) ? arr : [];
                return safeArr.map(t => ({
                    name: t.name ?? 'Unknown',
                    reason: t.reason ?? 'Recommended for this project',
                    alternatives: t.alternatives ?? []
                }));
            };

            return {
                frontend: mapTechChoices(parsed.frontend),
                backend: mapTechChoices(parsed.backend),
                database: mapTechChoices(parsed.database),
                infrastructure: mapTechChoices(parsed.infrastructure),
                other: mapTechChoices(parsed.other)
            };
        } catch {
            this.logWarn('Failed to parse tech stack response');
            return {
                frontend: [],
                backend: [],
                database: [],
                infrastructure: [],
                other: []
            };
        }
    }

    /**
     * Sanitize custom prompt to prevent prompt injection
     */
    private sanitizeCustomPrompt(prompt: string): string {
        return prompt
            .replace(/```/g, '') // Remove code block markers
            .replace(/===+/g, '---') // Prevent section marker injection
            .replace(/(\r?\n){3,}/g, '\n\n') // Limit excessive newlines
            .slice(0, 1000); // Limit length
    }

    private parseCompetitorResponse(content: string): {
        competitors: IdeaCompetitor[]
        advantages: string[]
    } {
        try {
            let jsonStr = content;
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1].trim();
            }

            const parsed = safeJsonParse(jsonStr, {
                competitors: [{
                    name: 'Unknown Competitor',
                    description: 'Competitor analysis unavailable',
                    url: '',
                    strengths: [],
                    weaknesses: [],
                    missingFeatures: [],
                    marketPosition: '',
                    differentiationOpportunity: ''
                }],
                advantages: ['Unique value proposition']
            });

            const competitors: IdeaCompetitor[] = Array.isArray(parsed.competitors)
                ? parsed.competitors.map(c => ({
                    name: c.name,
                    description: c.description,
                    url: c.url,
                    strengths: c.strengths,
                    weaknesses: c.weaknesses,
                    missingFeatures: c.missingFeatures,
                    marketPosition: c.marketPosition,
                    differentiationOpportunity: c.differentiationOpportunity
                }))
                : [];

            return {
                competitors,
                advantages: Array.isArray(parsed.advantages) ? parsed.advantages.slice(0, 5) : []
            };
        } catch {
            this.logWarn('Failed to parse competitor response');
            return {
                competitors: [],
                advantages: []
            };
        }
    }

    /**
     * Stage 9: User personas & journey maps
     */
    private async stageGeneratePersonas(session: IdeaSession, idea: ProjectIdea): Promise<{ personas: UserPersona[]; journey: JourneyStep[] }> {
        const prompt = `Create 3 detailed user personas and a 4-step journey map for:
Title: ${idea.title}
Description: ${idea.description}
Context: ${idea.longDescription?.slice(0, 1000)}

Requirements:
- 3 distinct personas (Name, Role, Pain Points, Goals, Tech Literacy)
- Avatar emoji for each
- 4-step journey map (discovery, onboarding, first-value, retention)

Respond in JSON:
{
    "personas": [
        { "name": "...", "role": "...", "avatarEmoji": "...", "painPoints": ["..."], "goals": ["..."], "techLiteracy": "low|medium|high", "reasoning": "..." }
    ],
    "journey": [
        { "stage": "discovery|onboarding|first-value|retention", "action": "...", "emotion": "excited|happy|neutral|frustrated", "benefit": "..." }
    ]
}`;

        const messages: Message[] = [
            { id: uuidv4(), role: 'system', content: 'You are a senior UX researcher. Always respond in valid JSON.', timestamp: new Date() },
            { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
        ];

        const response = await this.retryLLMCall(
            async () => await this.deps.llmService.chat(messages, session.model, undefined, session.provider),
            'Generate personas'
        );
        return this.parsePersonasResponse(response.content);
    }

    /**
     * Stage 10: SWOT & monetization
     */
    private async stageGenerateBusinessStrategy(session: IdeaSession, idea: ProjectIdea): Promise<{ swot: SWOTAnalysis; businessModel: BusinessModel }> {
        const prompt = `Develop a SWOT analysis and business model for:
Title: ${idea.title}
Target Market: ${idea.marketResearch?.targetAudience ?? idea.category}

Requirements:
- Detailed SWOT matrix
- Professional monetization strategy with price points
- Cost structure and break-even strategy

Respond in JSON:
{
    "swot": { "strengths": ["..."], "weaknesses": ["..."], "opportunities": ["..."], "threats": ["..."] },
    "businessModel": {
        "monetizationType": "...",
        "revenueStreams": [{ "name": "...", "description": "...", "pricePoint": "..." }],
        "costStructure": ["..."],
        "breakEvenStrategy": "..."
    }
}`;

        const messages: Message[] = [
            { id: uuidv4(), role: 'system', content: 'You are a senior business strategist. Always respond in valid JSON.', timestamp: new Date() },
            { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
        ];

        const response = await this.retryLLMCall(
            async () => await this.deps.llmService.chat(messages, session.model, undefined, session.provider),
            'Generate business model'
        );
        return this.parseBusinessResponse(response.content);
    }

    /**
     * Stage 11: GTM & first 100 users
     */
    private async stageGenerateGTMPlan(session: IdeaSession, idea: ProjectIdea): Promise<MarketingPlan> {
        const prompt = `Create a Go-To-Market plan for:
Title: ${idea.title}
Value Prop: ${idea.valueProposition}

Requirements:
- Actionable steps to get the first 100 users
- Content strategy and marketing channels
- Pre-launch/Launch checklist

Respond in JSON:
{
    "channels": ["..."],
    "first100UsersActionableSteps": ["..."],
    "contentStrategy": "...",
    "launchChecklist": ["..."]
}`;

        const messages: Message[] = [
            { id: uuidv4(), role: 'system', content: 'You are a growth marketing expert. Always respond in valid JSON.', timestamp: new Date() },
            { id: uuidv4(), role: 'user', content: prompt, timestamp: new Date() }
        ];

        const response = await this.retryLLMCall(
            async () => await this.deps.llmService.chat(messages, session.model, undefined, session.provider),
            'Generate marketing plan'
        );
        return this.parseMarketingResponse(response.content);
    }

    /**
     * Interactive Research Chat
     */
    async queryIdeaResearch(ideaId: string, question: string): Promise<string> {
        const db = await this.getDb();
        const row = await db.prepare('SELECT * FROM project_ideas WHERE id = ?').get<JsonObject>(ideaId);
        if (!row) { throw new Error('Idea not found'); }
        const idea = this.mapRowToIdea(row);

        const context = `
Title: ${idea.title}
Market Research: ${JSON.stringify(idea.marketResearch)}
Personas: ${JSON.stringify(idea.personas)}
Business Model: ${JSON.stringify(idea.businessModel)}
Competitive Landscape: ${JSON.stringify(idea.ideaCompetitors)}
`;

        const messages: Message[] = [
            { id: uuidv4(), role: 'system', content: 'You are a deep research assistant. Answer the users question based ONLY on the provided research context.', timestamp: new Date() },
            { id: uuidv4(), role: 'user', content: `Context: ${context}\n\nQuestion: ${question}`, timestamp: new Date() }
        ];

        const session = await this.getSession(idea.sessionId);
        const response = await this.retryLLMCall(
            async () => await this.deps.llmService.chat(
                messages,
                session?.model ?? 'gpt-4o',
                undefined,
                session?.provider ?? 'openai'
            ),
            'Query idea research'
        );

        return response.content;
    }

    // ==================== Enrichment Parser ====================

    private parseEnrichmentResponse(content: string): {
        explanation: string
        valueProposition: string
        nameSuggestions: string[]
        competitiveAdvantages: string[]
    } {
        try {
            const parsed = safeJsonParse(content, {}) as {
                explanation?: string
                valueProposition?: string
                nameSuggestions?: string[]
                competitiveAdvantages?: string[]
            };

            return {
                explanation: parsed.explanation ?? 'A innovative project idea.',
                valueProposition: parsed.valueProposition ?? 'Solves real problems for users.',
                nameSuggestions: Array.isArray(parsed.nameSuggestions)
                    ? parsed.nameSuggestions.slice(0, 10)
                    : [],
                competitiveAdvantages: Array.isArray(parsed.competitiveAdvantages)
                    ? parsed.competitiveAdvantages.slice(0, 5)
                    : []
            };
        } catch {
            return {
                explanation: 'A innovative project idea.',
                valueProposition: 'Solves real problems for users.',
                nameSuggestions: [],
                competitiveAdvantages: []
            };
        }
    }

    // ==================== Parsers for new data ====================

    private parsePersonasResponse(content: string): { personas: UserPersona[]; journey: JourneyStep[] } {
        try {
            const parsed = safeJsonParse(content, {}) as { personas?: UserPersona[]; journey?: JourneyStep[] };
            return {
                personas: Array.isArray(parsed.personas) ? parsed.personas : [],
                journey: Array.isArray(parsed.journey) ? parsed.journey : []
            };
        } catch {
            return { personas: [], journey: [] };
        }
    }

    private parseBusinessResponse(content: string): { swot: SWOTAnalysis; businessModel: BusinessModel } {
        try {
            const parsed = safeJsonParse(content, {}) as { swot?: SWOTAnalysis; businessModel?: BusinessModel };
            return {
                swot: parsed.swot ?? { strengths: [], weaknesses: [], opportunities: [], threats: [] },
                businessModel: parsed.businessModel ?? { monetizationType: '', revenueStreams: [], costStructure: [], breakEvenStrategy: '' }
            };
        } catch {
            return {
                swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
                businessModel: { monetizationType: '', revenueStreams: [], costStructure: [], breakEvenStrategy: '' }
            };
        }
    }

    private parseMarketingResponse(content: string): MarketingPlan {
        try {
            const parsed = safeJsonParse(content, {}) as {
                channels?: MarketingPlan['channels']
                first100UsersActionableSteps?: string[]
                contentStrategy?: string
                launchChecklist?: string[]
            };
            return {
                channels: Array.isArray(parsed.channels) ? parsed.channels : [],
                first100UsersActionableSteps: Array.isArray(parsed.first100UsersActionableSteps) ? parsed.first100UsersActionableSteps : [],
                contentStrategy: parsed.contentStrategy ?? '',
                launchChecklist: Array.isArray(parsed.launchChecklist) ? parsed.launchChecklist : []
            };
        } catch {
            return { channels: [], first100UsersActionableSteps: [], contentStrategy: '', launchChecklist: [] };
        }
    }

    // ==================== Data Management Methods ====================

    /**
     * Delete a single idea permanently
     */
    async deleteIdea(ideaId: string): Promise<void> {
        const db = await this.getDb();
        await db.prepare('DELETE FROM project_ideas WHERE id = ?').run(ideaId);
        this.logInfo(`Idea deleted: ${ideaId}`);
    }

    /**
     * Delete an entire session and all its ideas
     */
    async deleteSession(sessionId: string): Promise<void> {
        const db = await this.getDb();

        // First delete all ideas in the session
        await db.prepare('DELETE FROM project_ideas WHERE session_id = ?').run(sessionId);

        // Then delete the session itself
        await db.prepare('DELETE FROM idea_sessions WHERE id = ?').run(sessionId);

        this.logInfo(`Session deleted with all ideas: ${sessionId}`);
    }

    /**
     * Archive an idea (soft delete)
     * Changes status to 'archived' instead of deleting
     */
    async archiveIdea(ideaId: string): Promise<void> {
        const db = await this.getDb();
        await db.prepare('UPDATE project_ideas SET status = ?, updated_at = ? WHERE id = ?')
            .run('archived', Date.now(), ideaId);
        this.logInfo(`Idea archived: ${ideaId}`);
    }

    /**
     * Restore an archived idea back to pending status
     */
    async restoreIdea(ideaId: string): Promise<void> {
        const db = await this.getDb();
        await db.prepare('UPDATE project_ideas SET status = ?, updated_at = ? WHERE id = ?')
            .run('pending', Date.now(), ideaId);
        this.logInfo(`Idea restored: ${ideaId}`);
    }

    /**
     * Get archived ideas, optionally filtered by session
     */
    async getArchivedIdeas(sessionId?: string): Promise<ProjectIdea[]> {
        const db = await this.getDb();
        const sql = sessionId
            ? 'SELECT * FROM project_ideas WHERE session_id = ? AND status = ? ORDER BY updated_at DESC'
            : 'SELECT * FROM project_ideas WHERE status = ? ORDER BY updated_at DESC';

        const rows = sessionId
            ? await db.prepare(sql).all<JsonObject>(sessionId, 'archived')
            : await db.prepare(sql).all<JsonObject>('archived');

        return rows.map(row => this.mapRowToIdea(row));
    }
}
