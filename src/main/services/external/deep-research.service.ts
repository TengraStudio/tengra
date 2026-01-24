import { BaseService } from '@main/services/base.service'
import { WebService } from '@main/services/external/web.service'
import { LLMService } from '@main/services/llm/llm.service'
import { Message } from '@shared/types/chat'
import { IdeaCategory } from '@shared/types/ideas'
import { getErrorMessage } from '@shared/utils/error.util'
import { safeJsonParse } from '@shared/utils/sanitize.util'
import { v4 as uuidv4 } from 'uuid'

/**
 * Research source with credibility metadata
 */
export interface ResearchSource {
    url: string
    title: string
    snippet: string
    fullContent?: string
    credibilityScore: number // 0-100
    domain: string
    fetchedAt: number
}

/**
 * Research finding with citations
 */
export interface ResearchFinding {
    insight: string
    confidence: 'high' | 'medium' | 'low'
    sources: ResearchSource[]
    category: 'trend' | 'competitor' | 'opportunity' | 'risk' | 'market-size' | 'user-behavior'
}

/**
 * Comprehensive research report
 */
export interface DeepResearchReport {
    query: string
    category: IdeaCategory
    findings: ResearchFinding[]
    marketSizeEstimate?: string
    trendMomentum: 'rising' | 'stable' | 'declining'
    competitorDensity: 'low' | 'medium' | 'high'
    opportunityScore: number // 0-100
    riskFactors: string[]
    rawSources: ResearchSource[]
    generatedAt: number
    researchDurationMs: number
}

/**
 * Research query for multi-angle investigation
 */
interface ResearchQuery {
    query: string
    purpose: 'trends' | 'competitors' | 'market-size' | 'user-needs' | 'risks' | 'opportunities'
    weight: number
}

const CURRENT_YEAR = new Date().getFullYear()

/**
 * Deep Research Service
 * Provides thorough, multi-source research with citations and validation
 */
export class DeepResearchService extends BaseService {
    /** Cache for recent research to avoid redundant queries */
    private researchCache: Map<string, DeepResearchReport> = new Map()
    private readonly CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

    constructor(
        private webService: WebService,
        private llmService: LLMService
    ) {
        super('DeepResearchService')
    }

    /**
     * Perform comprehensive deep research on a topic
     */
    async performDeepResearch(
        topic: string,
        category: IdeaCategory,
        onProgress?: (stage: string, progress: number) => void
    ): Promise<DeepResearchReport> {
        const startTime = Date.now()
        const cacheKey = `${topic}-${category}`.toLowerCase()

        // Check cache
        const cached = this.researchCache.get(cacheKey)
        if (cached && (Date.now() - cached.generatedAt) < this.CACHE_TTL_MS) {
            this.logInfo(`Using cached research for: ${topic}`)
            return cached
        }

        this.logInfo(`Starting deep research for: ${topic} (${category})`)

        // Generate multi-angle research queries
        onProgress?.('Generating research queries', 5)
        const queries = this.generateResearchQueries(topic, category)

        // Execute all research queries
        const allSources: ResearchSource[] = []
        for (let i = 0; i < queries.length; i++) {
            const query = queries[i]
            onProgress?.(`Researching: ${query.purpose}`, 10 + Math.floor((i / queries.length) * 50))

            const sources = await this.executeResearchQuery(query)
            allSources.push(...sources)

            // Fetch full content for top sources
            const topSources = sources.slice(0, 3)
            for (const source of topSources) {
                if (!source.fullContent) {
                    const fullContent = await this.fetchFullContent(source.url)
                    if (fullContent) {
                        source.fullContent = fullContent
                    }
                }
            }

            await this.delay(1000) // Rate limiting
        }

        // Deduplicate sources
        const uniqueSources = this.deduplicateSources(allSources)
        this.logInfo(`Gathered ${uniqueSources.length} unique sources`)

        // Analyze and synthesize findings
        onProgress?.('Analyzing findings', 70)
        const findings = await this.synthesizeFindings(topic, category, uniqueSources)

        // Calculate metrics
        onProgress?.('Calculating metrics', 85)
        const metrics = this.calculateMetrics(findings, uniqueSources)

        // Build final report
        onProgress?.('Building report', 95)
        const report: DeepResearchReport = {
            query: topic,
            category,
            findings,
            marketSizeEstimate: metrics.marketSizeEstimate,
            trendMomentum: metrics.trendMomentum,
            competitorDensity: metrics.competitorDensity,
            opportunityScore: metrics.opportunityScore,
            riskFactors: metrics.riskFactors,
            rawSources: uniqueSources,
            generatedAt: Date.now(),
            researchDurationMs: Date.now() - startTime
        }

        // Cache the report
        this.researchCache.set(cacheKey, report)

        onProgress?.('Research complete', 100)
        this.logInfo(`Deep research completed in ${report.researchDurationMs}ms`)

        return report
    }

    /**
     * Generate multi-angle research queries for thorough investigation
     */
    private generateResearchQueries(topic: string, category: IdeaCategory): ResearchQuery[] {
        const categoryContext = this.getCategoryContext(category)

        return [
            // Market trends
            {
                query: `${topic} ${categoryContext} market trends ${CURRENT_YEAR}`,
                purpose: 'trends',
                weight: 1.0
            },
            {
                query: `emerging ${topic} technologies and innovations ${CURRENT_YEAR}`,
                purpose: 'trends',
                weight: 0.9
            },
            // Competitors
            {
                query: `best ${topic} ${categoryContext} apps platforms ${CURRENT_YEAR}`,
                purpose: 'competitors',
                weight: 1.0
            },
            {
                query: `${topic} startups funding rounds ${CURRENT_YEAR}`,
                purpose: 'competitors',
                weight: 0.8
            },
            {
                query: `${topic} market leaders comparison`,
                purpose: 'competitors',
                weight: 0.9
            },
            // Market size
            {
                query: `${topic} market size revenue ${CURRENT_YEAR} statistics`,
                purpose: 'market-size',
                weight: 1.0
            },
            {
                query: `${topic} industry growth forecast analysis`,
                purpose: 'market-size',
                weight: 0.9
            },
            // User needs
            {
                query: `${topic} user complaints problems pain points`,
                purpose: 'user-needs',
                weight: 1.0
            },
            {
                query: `what users want from ${topic} ${categoryContext}`,
                purpose: 'user-needs',
                weight: 0.8
            },
            // Opportunities
            {
                query: `${topic} market gaps underserved needs`,
                purpose: 'opportunities',
                weight: 1.0
            },
            {
                query: `${topic} future opportunities predictions ${CURRENT_YEAR + 1}`,
                purpose: 'opportunities',
                weight: 0.9
            },
            // Risks
            {
                query: `${topic} ${categoryContext} challenges risks failures`,
                purpose: 'risks',
                weight: 1.0
            },
            {
                query: `why ${topic} startups fail common mistakes`,
                purpose: 'risks',
                weight: 0.8
            }
        ]
    }

    /**
     * Execute a single research query
     */
    private async executeResearchQuery(query: ResearchQuery): Promise<ResearchSource[]> {
        const sources: ResearchSource[] = []

        try {
            const result = await this.webService.searchWeb(query.query, 8)

            if (result.success && result.results) {
                for (const searchResult of result.results) {
                    const domain = this.extractDomain(searchResult.url)
                    sources.push({
                        url: searchResult.url,
                        title: searchResult.title,
                        snippet: searchResult.snippet || '',
                        credibilityScore: this.calculateCredibilityScore(domain, searchResult.title),
                        domain,
                        fetchedAt: Date.now()
                    })
                }
            }
        } catch (error) {
            this.logWarn(`Research query failed: ${query.query}`, getErrorMessage(error as Error))
        }

        return sources
    }

    /**
     * Fetch full content from a URL
     */
    private async fetchFullContent(url: string): Promise<string | null> {
        try {
            const result = await this.webService.fetchWebPage(url)
            if (result.success && result.content) {
                // Limit content length to avoid token limits
                return result.content.slice(0, 5000)
            }
        } catch {
            this.logDebug(`Failed to fetch full content from ${url}`)
        }
        return null
    }

    /**
     * Calculate credibility score for a source
     */
    private calculateCredibilityScore(domain: string, title: string): number {
        let score = 50 // Base score

        // High credibility domains
        const highCredibilityDomains = [
            'techcrunch.com', 'forbes.com', 'bloomberg.com', 'reuters.com',
            'wired.com', 'theverge.com', 'arstechnica.com', 'statista.com',
            'gartner.com', 'mckinsey.com', 'hbr.org', 'nature.com',
            'ieee.org', 'acm.org', 'ycombinator.com', 'producthunt.com',
            'crunchbase.com', 'pitchbook.com', 'stackshare.io'
        ]

        // Medium credibility domains
        const mediumCredibilityDomains = [
            'medium.com', 'dev.to', 'hackernews.com', 'reddit.com',
            'quora.com', 'stackoverflow.com', 'github.com'
        ]

        // Check domain credibility
        for (const d of highCredibilityDomains) {
            if (domain.includes(d)) {
                score += 30
                break
            }
        }

        for (const d of mediumCredibilityDomains) {
            if (domain.includes(d)) {
                score += 15
                break
            }
        }

        // Check for data/statistics in title
        const dataKeywords = ['statistics', 'data', 'report', 'study', 'research', 'analysis', 'survey', 'market']
        for (const keyword of dataKeywords) {
            if (title.toLowerCase().includes(keyword)) {
                score += 10
                break
            }
        }

        // Check for recency in title
        if (title.includes(String(CURRENT_YEAR)) || title.includes(String(CURRENT_YEAR - 1))) {
            score += 10
        }

        return Math.min(100, score)
    }

    /**
     * Deduplicate sources by URL
     */
    private deduplicateSources(sources: ResearchSource[]): ResearchSource[] {
        const seen = new Set<string>()
        return sources.filter(source => {
            if (seen.has(source.url)) {
                return false
            }
            seen.add(source.url)
            return true
        }).sort((a, b) => b.credibilityScore - a.credibilityScore)
    }

    /**
     * Use LLM to synthesize research findings from sources
     */
    private async synthesizeFindings(
        topic: string,
        category: IdeaCategory,
        sources: ResearchSource[]
    ): Promise<ResearchFinding[]> {
        // Prepare source context
        const sourceContext = sources
            .slice(0, 20)
            .map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\nSnippet: ${s.snippet}\n${s.fullContent ? `Content: ${s.fullContent.slice(0, 1500)}` : ''}`)
            .join('\n\n')

        const prompt = `Analyze these research sources about "${topic}" in the ${category} space.

SOURCES:
${sourceContext}

Extract and synthesize findings into these categories:
1. TRENDS - What's trending, emerging technologies, market direction
2. COMPETITORS - Who are the main players, their strengths/weaknesses
3. OPPORTUNITIES - Market gaps, underserved needs, innovation opportunities
4. RISKS - Challenges, common failures, threats
5. MARKET-SIZE - Market size estimates, growth rates if mentioned
6. USER-BEHAVIOR - User needs, pain points, preferences

For each finding:
- Provide a clear, actionable insight
- Rate confidence as high/medium/low based on source quality
- Reference which source numbers support it

Respond in JSON:
{
    "findings": [
        {
            "insight": "Clear insight statement",
            "confidence": "high|medium|low",
            "category": "trend|competitor|opportunity|risk|market-size|user-behavior",
            "sourceRefs": [1, 3, 5]
        }
    ],
    "marketSizeEstimate": "$X billion" or null,
    "overallTrendDirection": "rising|stable|declining"
}`

        const messages: Message[] = [
            {
                id: uuidv4(),
                role: 'system',
                content: `You are a senior market research analyst. Synthesize research findings with citations. Be specific and data-driven. Always respond in valid JSON. Current year is ${CURRENT_YEAR}.`,
                timestamp: new Date()
            },
            {
                id: uuidv4(),
                role: 'user',
                content: prompt,
                timestamp: new Date()
            }
        ]

        try {
            const response = await this.llmService.chat(messages, 'gpt-4o-mini', undefined, 'openai')
            const parsed = this.parseSynthesisResponse(response.content, sources)
            return parsed.findings
        } catch (error) {
            this.logError(`Failed to synthesize findings: ${getErrorMessage(error as Error)}`)
            return []
        }
    }

    /**
     * Parse LLM synthesis response
     */
    private parseSynthesisResponse(content: string, sources: ResearchSource[]): {
        findings: ResearchFinding[]
        marketSizeEstimate?: string
    } {
        try {
            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/)?.[0]
            if (!jsonMatch) {
                throw new Error('No JSON found in response')
            }

            const data = safeJsonParse(jsonMatch, {
                findings: [{
                    insight: 'Research data unavailable',
                    confidence: 'low',
                    category: 'opportunity',
                    sourceRefs: []
                }],
                marketSizeEstimate: 'Unable to estimate market size'
            })

            const findings: ResearchFinding[] = (data.findings ?? []).map(f => ({
                insight: f.insight,
                confidence: (f.confidence || 'medium') as 'low' | 'medium' | 'high',
                category: (f.category || 'opportunity') as ResearchFinding['category'],
                sources: (f.sourceRefs ?? [])
                    .filter((ref: any) => ref > 0 && ref <= sources.length)
                    .map((ref: any) => sources[ref - 1])
            }))

            return {
                findings,
                marketSizeEstimate: data.marketSizeEstimate ?? undefined
            }
        } catch (error) {
            this.logWarn(`Failed to parse synthesis response: ${getErrorMessage(error as Error)}`)
            return { findings: [] }
        }
    }

    /**
     * Calculate research metrics from findings
     */
    private calculateMetrics(findings: ResearchFinding[], _sources: ResearchSource[]): {
        marketSizeEstimate?: string
        trendMomentum: 'rising' | 'stable' | 'declining'
        competitorDensity: 'low' | 'medium' | 'high'
        opportunityScore: number
        riskFactors: string[]
    } {
        // Count findings by category
        const trendFindings = findings.filter(f => f.category === 'trend')
        const competitorFindings = findings.filter(f => f.category === 'competitor')
        const opportunityFindings = findings.filter(f => f.category === 'opportunity')
        const riskFindings = findings.filter(f => f.category === 'risk')
        const marketFindings = findings.filter(f => f.category === 'market-size')

        // Determine trend momentum
        let trendMomentum: 'rising' | 'stable' | 'declining' = 'stable'
        const positiveKeywords = ['growing', 'rising', 'increasing', 'booming', 'surge', 'expanding']
        const negativeKeywords = ['declining', 'falling', 'decreasing', 'shrinking', 'slowing']

        let positiveCount = 0
        let negativeCount = 0
        for (const finding of trendFindings) {
            const text = finding.insight.toLowerCase()
            if (positiveKeywords.some(k => text.includes(k))) {positiveCount++}
            if (negativeKeywords.some(k => text.includes(k))) {negativeCount++}
        }

        if (positiveCount > negativeCount + 1) {trendMomentum = 'rising'}
        else if (negativeCount > positiveCount + 1) {trendMomentum = 'declining'}

        // Determine competitor density
        let competitorDensity: 'low' | 'medium' | 'high' = 'medium'
        if (competitorFindings.length >= 5) {competitorDensity = 'high'}
        else if (competitorFindings.length <= 2) {competitorDensity = 'low'}

        // Calculate opportunity score
        const highConfidenceOpportunities = opportunityFindings.filter(f => f.confidence === 'high').length
        const opportunityScore = Math.min(100, Math.round(
            (opportunityFindings.length * 15) +
            (highConfidenceOpportunities * 20) +
            (trendMomentum === 'rising' ? 20 : 0) +
            (competitorDensity === 'low' ? 15 : 0) -
            (riskFindings.length * 5)
        ))

        // Extract market size estimate
        let marketSizeEstimate: string | undefined
        for (const finding of marketFindings) {
            const match = finding.insight.match(/\$[\d.]+\s*(billion|million|trillion)/i)
            if (match) {
                marketSizeEstimate = match[0]
                break
            }
        }

        // Extract risk factors
        const riskFactors = riskFindings
            .filter(f => f.confidence !== 'low')
            .map(f => f.insight)
            .slice(0, 5)

        return {
            marketSizeEstimate,
            trendMomentum,
            competitorDensity,
            opportunityScore,
            riskFactors
        }
    }

    /**
     * Extract domain from URL
     */
    private extractDomain(url: string): string {
        try {
            return new URL(url).hostname.replace('www.', '')
        } catch {
            return url
        }
    }

    /**
     * Get context string for category
     */
    private getCategoryContext(category: IdeaCategory): string {
        const contexts: Record<IdeaCategory, string> = {
            'website': 'web application SaaS',
            'mobile-app': 'mobile app iOS Android',
            'game': 'video game gaming',
            'cli-tool': 'developer tool CLI command line',
            'desktop': 'desktop application software',
            'other': 'software application'
        }
        return contexts[category]
    }

    /**
     * Validate and score an idea based on research
     */
    async validateIdea(
        ideaTitle: string,
        ideaDescription: string,
        category: IdeaCategory
    ): Promise<{
        feasibilityScore: number
        marketFitScore: number
        competitionLevel: 'low' | 'medium' | 'high'
        recommendations: string[]
        concerns: string[]
    }> {
        this.logInfo(`Validating idea: ${ideaTitle}`)

        // Perform targeted research for this specific idea
        const research = await this.performDeepResearch(
            `${ideaTitle} ${ideaDescription.slice(0, 100)}`,
            category
        )

        // Use LLM to analyze fit
        const prompt = `Evaluate this project idea based on market research:

IDEA:
Title: ${ideaTitle}
Category: ${category}
Description: ${ideaDescription}

RESEARCH FINDINGS:
${research.findings.map(f => `- [${f.category}/${f.confidence}] ${f.insight}`).join('\n')}

MARKET METRICS:
- Trend Momentum: ${research.trendMomentum}
- Competitor Density: ${research.competitorDensity}
- Opportunity Score: ${research.opportunityScore}/100
- Market Size: ${research.marketSizeEstimate ?? 'Unknown'}

Analyze and provide:
1. Feasibility score (0-100): Can this be built and succeed?
2. Market fit score (0-100): Does the market need this?
3. Competition level: low/medium/high
4. 3-5 actionable recommendations to improve chances of success
5. 2-4 concerns or risks to address

Respond in JSON:
{
    "feasibilityScore": 75,
    "marketFitScore": 80,
    "competitionLevel": "medium",
    "recommendations": ["...", "..."],
    "concerns": ["...", "..."]
}`

        const messages: Message[] = [
            {
                id: uuidv4(),
                role: 'system',
                content: 'You are a startup advisor and market analyst. Provide honest, actionable feedback. Always respond in valid JSON.',
                timestamp: new Date()
            },
            {
                id: uuidv4(),
                role: 'user',
                content: prompt,
                timestamp: new Date()
            }
        ]

        try {
            const response = await this.llmService.chat(messages, 'gpt-4o-mini', undefined, 'openai')
            return this.parseValidationResponse(response.content)
        } catch (error) {
            this.logError(`Failed to validate idea: ${getErrorMessage(error as Error)}`)
            return {
                feasibilityScore: 50,
                marketFitScore: 50,
                competitionLevel: 'medium',
                recommendations: ['Unable to fully analyze - try again'],
                concerns: ['Validation could not be completed']
            }
        }
    }

    /**
     * Parse validation response
     */
    private parseValidationResponse(content: string): {
        feasibilityScore: number
        marketFitScore: number
        competitionLevel: 'low' | 'medium' | 'high'
        recommendations: string[]
        concerns: string[]
    } {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/)?.[0]
            if (!jsonMatch) {throw new Error('No JSON found')}

            const data = safeJsonParse(jsonMatch, {
                feasibilityScore: 50,
                marketFitScore: 50,
                competitionLevel: 'medium' as const,
                recommendations: [],
                concerns: []
            })

            return {
                feasibilityScore: Math.max(0, Math.min(100, data.feasibilityScore ?? 50)),
                marketFitScore: Math.max(0, Math.min(100, data.marketFitScore ?? 50)),
                competitionLevel: data.competitionLevel ?? 'medium',
                recommendations: data.recommendations ?? [],
                concerns: data.concerns ?? []
            }
        } catch {
            return {
                feasibilityScore: 50,
                marketFitScore: 50,
                competitionLevel: 'medium',
                recommendations: [],
                concerns: []
            }
        }
    }

    /**
     * Clear the research cache
     */
    clearCache(): void {
        this.researchCache.clear()
        this.logInfo('Research cache cleared')
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}
