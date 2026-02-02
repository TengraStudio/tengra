import { BaseService } from '@main/services/base.service';
import { LLMService } from '@main/services/llm/llm.service';
import { Message } from '@shared/types/chat';
import { IdeaCategory, ProjectIdea } from '@shared/types/ideas';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { v4 as uuidv4 } from 'uuid';

/**
 * Detailed idea score breakdown
 */
export interface IdeaScoreBreakdown {
    /** Overall score 0-100 */
    overallScore: number

    /** Individual dimension scores */
    dimensions: {
        /** How innovative and unique is this idea? */
        innovation: number
        /** How clear is the market need? */
        marketNeed: number
        /** How feasible is this to build? */
        feasibility: number
        /** How strong is the business potential? */
        businessPotential: number
        /** How well-defined is the target audience? */
        targetClarity: number
        /** How defensible/competitive is the moat? */
        competitiveMoat: number
    }

    /** Key strengths identified */
    strengths: string[]

    /** Key weaknesses identified */
    weaknesses: string[]

    /** Suggestions for improvement */
    improvements: string[]

    /** Confidence in the scoring */
    confidence: 'high' | 'medium' | 'low'

    /** Brief summary explanation */
    summary: string
}

/**
 * Comparison result between two ideas
 */
export interface IdeaComparison {
    winnerId: string
    reason: string
    strengthComparison: Record<string, { idea1: number; idea2: number }>
    recommendation: string
}

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Idea Scoring Service
 * Provides AI-powered scoring and ranking of project ideas
 */
export class IdeaScoringService extends BaseService {
    private scoringCache: Map<string, IdeaScoreBreakdown> = new Map();
    private initialized = false;

    constructor(private llmService: LLMService) {
        super('IdeaScoringService');
    }

    /**
     * Initialize the IdeaScoringService
     */
    async initialize(): Promise<void> {
        this.logInfo('Initializing idea scoring service...');

        // Clear any existing cache
        this.scoringCache.clear();
        this.initialized = true;

        this.logInfo('Idea scoring service initialized with scoring cache');
    }

    /**
     * Cleanup the IdeaScoringService
     */
    async cleanup(): Promise<void> {
        this.logInfo('Cleaning up idea scoring service...');

        // Clear scoring cache
        this.scoringCache.clear();
        this.initialized = false;

        this.logInfo('Idea scoring service cleaned up');
    }

    /**
     * Score a single idea comprehensively
     */
    async scoreIdea(idea: ProjectIdea): Promise<IdeaScoreBreakdown> {
        this.logInfo(`Scoring idea: ${idea.title}`);

        const prompt = this.buildScoringPrompt(idea);

        const messages: Message[] = [
            {
                id: uuidv4(),
                role: 'system',
                content: this.getScoringSystemPrompt(),
                timestamp: new Date()
            },
            {
                id: uuidv4(),
                role: 'user',
                content: prompt,
                timestamp: new Date()
            }
        ];

        try {
            const response = await this.llmService.chat(
                messages,
                'gpt-4o-mini',
                undefined,
                'openai',
                { temperature: 0.3 }
            );

            return this.parseScoringResponse(response.content);
        } catch (error) {
            this.logError(`Failed to score idea: ${getErrorMessage(error as Error)}`);
            return this.getDefaultScore();
        }
    }

    /**
     * Rank multiple ideas and return sorted by score
     */
    async rankIdeas(ideas: ProjectIdea[]): Promise<Array<{
        idea: ProjectIdea
        score: IdeaScoreBreakdown
        rank: number
    }>> {
        this.logInfo(`Ranking ${ideas.length} ideas`);

        // Score all ideas in parallel (with concurrency limit)
        const scores: Array<{ idea: ProjectIdea; score: IdeaScoreBreakdown }> = [];

        // Process in batches of 3 to avoid rate limits
        const batchSize = 3;
        for (let i = 0; i < ideas.length; i += batchSize) {
            const batch = ideas.slice(i, i + batchSize);
            const batchScores = await Promise.all(
                batch.map(async idea => ({
                    idea,
                    score: await this.scoreIdea(idea)
                }))
            );
            scores.push(...batchScores);
        }

        // Sort by overall score descending
        scores.sort((a, b) => b.score.overallScore - a.score.overallScore);

        // Add ranks
        return scores.map((item, index) => ({
            ...item,
            rank: index + 1
        }));
    }

    /**
     * Compare two ideas directly
     */
    async compareIdeas(idea1: ProjectIdea, idea2: ProjectIdea): Promise<IdeaComparison> {
        this.logInfo(`Comparing ideas: "${idea1.title}" vs "${idea2.title}"`);

        const prompt = `Compare these two project ideas and determine which is stronger:

IDEA 1: "${idea1.title}"
Category: ${idea1.category}
Description: ${idea1.description}
${idea1.valueProposition ? `Value Proposition: ${idea1.valueProposition}` : ''}
${idea1.competitiveAdvantages ? `Competitive Advantages: ${idea1.competitiveAdvantages.join(', ')}` : ''}

IDEA 2: "${idea2.title}"
Category: ${idea2.category}
Description: ${idea2.description}
${idea2.valueProposition ? `Value Proposition: ${idea2.valueProposition}` : ''}
${idea2.competitiveAdvantages ? `Competitive Advantages: ${idea2.competitiveAdvantages.join(', ')}` : ''}

Analyze both ideas across these dimensions and pick a winner:
1. Innovation & Uniqueness
2. Market Need
3. Feasibility
4. Business Potential
5. Target Clarity
6. Competitive Moat

Respond in JSON:
{
    "winnerId": "1" or "2",
    "reason": "Brief explanation of why this idea is stronger",
    "strengthComparison": {
        "innovation": { "idea1": 0-100, "idea2": 0-100 },
        "marketNeed": { "idea1": 0-100, "idea2": 0-100 },
        "feasibility": { "idea1": 0-100, "idea2": 0-100 },
        "businessPotential": { "idea1": 0-100, "idea2": 0-100 },
        "targetClarity": { "idea1": 0-100, "idea2": 0-100 },
        "competitiveMoat": { "idea1": 0-100, "idea2": 0-100 }
    },
    "recommendation": "What would make the losing idea stronger"
}`;

        const messages: Message[] = [
            {
                id: uuidv4(),
                role: 'system',
                content: 'You are a startup advisor comparing project ideas. Be analytical and objective. Always respond in valid JSON.',
                timestamp: new Date()
            },
            {
                id: uuidv4(),
                role: 'user',
                content: prompt,
                timestamp: new Date()
            }
        ];

        try {
            const response = await this.llmService.chat(messages, 'gpt-4o-mini', undefined, 'openai');
            return this.parseComparisonResponse(response.content, idea1.id, idea2.id);
        } catch (error) {
            this.logError(`Failed to compare ideas: ${getErrorMessage(error as Error)}`);
            return {
                winnerId: idea1.id,
                reason: 'Comparison could not be completed',
                strengthComparison: {},
                recommendation: 'Try comparing again'
            };
        }
    }

    /**
     * Quick score without full analysis (faster, less detailed)
     */
    async quickScore(title: string, description: string, category: IdeaCategory): Promise<number> {
        const prompt = `Rate this project idea from 0-100 based on innovation, market need, and feasibility:

Title: ${title}
Category: ${category}
Description: ${description}

Respond with ONLY a number between 0 and 100.`;

        const messages: Message[] = [
            {
                id: uuidv4(),
                role: 'system',
                content: 'You are a startup idea evaluator. Respond with only a number.',
                timestamp: new Date()
            },
            {
                id: uuidv4(),
                role: 'user',
                content: prompt,
                timestamp: new Date()
            }
        ];

        try {
            const response = await this.llmService.chat(
                messages,
                'gpt-4o-mini',
                undefined,
                'openai',
                { temperature: 0.2 }
            );

            const score = parseInt(response.content.trim(), 10);
            if (isNaN(score) || score < 0 || score > 100) {
                return 50;
            }
            return score;
        } catch {
            return 50;
        }
    }

    /**
     * Build the detailed scoring prompt
     */
    private buildScoringPrompt(idea: ProjectIdea): string {
        let prompt = `Score this project idea comprehensively:

BASIC INFO:
- Title: ${idea.title}
- Category: ${idea.category}
- Description: ${idea.description}
`;
        prompt += this.buildOptionalSections(idea);
        prompt += this.buildScoringInstructions();

        return prompt;
    }

    private buildOptionalSections(idea: ProjectIdea): string {
        let sections = '';

        if (idea.valueProposition) {
            sections += `- Value Proposition: ${idea.valueProposition}\n`;
        }

        if (idea.longDescription) {
            sections += `\nDETAILED DESCRIPTION:\n${idea.longDescription.slice(0, 1000)}\n`;
        }

        if (idea.competitiveAdvantages?.length) {
            sections += `\nCOMPETITIVE ADVANTAGES:\n${idea.competitiveAdvantages.map(a => `- ${a}`).join('\n')}\n`;
        }

        sections += this.buildTechStackSection(idea);
        sections += this.buildRoadmapSection(idea);
        sections += this.buildBusinessModelSection(idea);
        sections += this.buildSwotSection(idea);

        return sections;
    }

    private buildTechStackSection(idea: ProjectIdea): string {
        if (!idea.techStack) { return ''; }

        const techs: string[] = [];
        if (idea.techStack.frontend.length) {
            techs.push(`Frontend: ${idea.techStack.frontend.map(t => t.name).join(', ')}`);
        }
        if (idea.techStack.backend.length) {
            techs.push(`Backend: ${idea.techStack.backend.map(t => t.name).join(', ')}`);
        }

        return techs.length ? `\nTECH STACK:\n${techs.join('\n')}\n` : '';
    }

    private buildRoadmapSection(idea: ProjectIdea): string {
        if (!idea.roadmap) { return ''; }
        return `\nROADMAP:\n- MVP: ${idea.roadmap.mvp.description}\n- Total Duration: ${idea.roadmap.totalDuration}\n`;
    }

    private buildBusinessModelSection(idea: ProjectIdea): string {
        if (!idea.businessModel) { return ''; }
        return `\nBUSINESS MODEL:\n- Type: ${idea.businessModel.monetizationType}\n`;
    }

    private buildSwotSection(idea: ProjectIdea): string {
        if (!idea.swot) { return ''; }
        let swot = `\nSWOT ANALYSIS:\n`;
        swot += `Strengths: ${idea.swot.strengths.slice(0, 3).join(', ')}\n`;
        swot += `Weaknesses: ${idea.swot.weaknesses.slice(0, 3).join(', ')}\n`;
        return swot;
    }

    private buildScoringInstructions(): string {
        return `
Score this idea on these dimensions (0-100 each):
1. INNOVATION: How unique and innovative is this idea?
2. MARKET NEED: How clear and strong is the market need?
3. FEASIBILITY: How realistic is it to build this?
4. BUSINESS POTENTIAL: How strong is the revenue/growth potential?
5. TARGET CLARITY: How well-defined is the target audience?
6. COMPETITIVE MOAT: How defensible is this against competitors?

Also provide:
- 3-5 key strengths
- 2-4 key weaknesses
- 3-5 specific improvements
- Brief summary (2-3 sentences)
- Confidence level (high/medium/low)

Respond in JSON:
{
    "overallScore": 75,
    "dimensions": {
        "innovation": 80,
        "marketNeed": 70,
        "feasibility": 75,
        "businessPotential": 70,
        "targetClarity": 80,
        "competitiveMoat": 65
    },
    "strengths": ["...", "..."],
    "weaknesses": ["...", "..."],
    "improvements": ["...", "..."],
    "confidence": "high|medium|low",
    "summary": "Brief evaluation summary"
}`;
    }

    /**
     * Get the system prompt for scoring
     */
    private getScoringSystemPrompt(): string {
        return `You are an expert startup advisor and venture capital analyst. Your job is to objectively evaluate project ideas for their potential success.

Scoring guidelines:
- 0-20: Poor - Fundamental flaws, no clear value
- 21-40: Below Average - Significant issues, unclear market
- 41-60: Average - Decent but nothing special, crowded market
- 61-80: Good - Strong concept, clear opportunity
- 81-100: Excellent - Innovative, clear market need, strong potential

Be honest and critical. Don't inflate scores. Consider:
- Current market conditions (${CURRENT_YEAR})
- Technical feasibility with modern tools
- Competition landscape
- Target market size and accessibility
- Revenue potential and business model viability

Always respond in valid JSON format.`;
    }

    /**
     * Parse the scoring response from LLM
     */
    private parseScoringResponse(content: string): IdeaScoreBreakdown {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/)?.[0];
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const data = safeJsonParse(jsonMatch, {
                overallScore: 50,
                dimensions: {
                    innovation: 50,
                    marketNeed: 50,
                    feasibility: 50,
                    businessPotential: 50,
                    targetClarity: 50,
                    competitiveMoat: 50
                },
                strengths: [],
                weaknesses: [],
                improvements: [],
                confidence: 'medium' as const,
                summary: 'Default score assessment'
            });

            const clamp = (val: number | undefined, def: number): number =>
                Math.max(0, Math.min(100, val ?? def));

            const dimensions = {
                innovation: clamp(data.dimensions.innovation, 50),
                marketNeed: clamp(data.dimensions.marketNeed, 50),
                feasibility: clamp(data.dimensions.feasibility, 50),
                businessPotential: clamp(data.dimensions.businessPotential, 50),
                targetClarity: clamp(data.dimensions.targetClarity, 50),
                competitiveMoat: clamp(data.dimensions.competitiveMoat, 50)
            };

            // Calculate overall if not provided
            const overallScore = data.overallScore || Math.round(
                (dimensions.innovation +
                    dimensions.marketNeed +
                    dimensions.feasibility +
                    dimensions.businessPotential +
                    dimensions.targetClarity +
                    dimensions.competitiveMoat) / 6
            );

            return {
                overallScore: clamp(overallScore, 50),
                dimensions,
                strengths: data.strengths,
                weaknesses: data.weaknesses,
                improvements: data.improvements,
                confidence: data.confidence,
                summary: data.summary
            };
        } catch (error) {
            this.logWarn(`Failed to parse scoring response: ${getErrorMessage(error as Error)}`);
            return this.getDefaultScore();
        }
    }

    /**
     * Parse comparison response
     */
    private parseComparisonResponse(
        content: string,
        idea1Id: string,
        idea2Id: string
    ): IdeaComparison {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/)?.[0];
            if (!jsonMatch) { throw new Error('No JSON found'); }

            const data = safeJsonParse(jsonMatch, {
                winnerId: '1',
                reason: 'Comparison completed',
                strengthComparison: {},
                recommendation: ''
            });

            return {
                winnerId: data.winnerId === '2' ? idea2Id : idea1Id,
                reason: data.reason,
                strengthComparison: data.strengthComparison,
                recommendation: data.recommendation
            };
        } catch {
            return {
                winnerId: idea1Id,
                reason: 'Comparison could not be parsed',
                strengthComparison: {},
                recommendation: ''
            };
        }
    }

    /**
     * Get default score when scoring fails
     */
    private getDefaultScore(): IdeaScoreBreakdown {
        return {
            overallScore: 50,
            dimensions: {
                innovation: 50,
                marketNeed: 50,
                feasibility: 50,
                businessPotential: 50,
                targetClarity: 50,
                competitiveMoat: 50
            },
            strengths: [],
            weaknesses: [],
            improvements: ['Unable to fully analyze - please try again'],
            confidence: 'low',
            summary: 'Scoring could not be completed'
        };
    }
}
