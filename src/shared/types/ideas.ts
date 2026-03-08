import { JsonObject } from '@/types/common';

/**
 * Idea Generator Types
 * Types for the AI-powered workspace idea generation system
 */

// Category types for idea generation
export type IdeaCategory =
    | 'website'
    | 'mobile-app'
    | 'game'
    | 'cli-tool'
    | 'desktop'
    | 'other'

// Session status tracking
export type IdeaSessionStatus =
    | 'active'
    | 'researching'
    | 'generating'
    | 'completed'
    | 'cancelled'

// Individual idea status
export type IdeaStatus = 'pending' | 'approved' | 'rejected' | 'archived'

// Research pipeline stages (category-level)
export type ResearchStage =
    | 'idle'
    | 'understanding'
    | 'sector-analysis'
    | 'market-research'
    | 'competitor-analysis'
    | 'complete'

// Idea generation pipeline stages (per-idea)
export type IdeaGenerationStage =
    | 'idle'
    | 'seed-generation'        // Stage 2: Generate initial idea seed
    | 'idea-research'          // Stage 3: Targeted idea-specific research
    | 'naming'                 // Stage 4: Generate 10 workspace names
    | 'long-description'       // Stage 5: Long-form description
    | 'roadmap'                // Stage 6: Workspace roadmap
    | 'tech-stack'             // Stage 7: Technology stack
    | 'competitor-analysis'    // Stage 8: Idea-specific competitor analysis
    | 'personas'               // Stage 9: User personas & journey maps
    | 'business-strategy'      // Stage 10: SWOT & monetization
    | 'marketing-plan'         // Stage 11: GTM & first 100 users
    | 'finalizing'             // Stage 12: Final assembly
    | 'complete'

/**
 * Configuration for creating a new idea generation session
 */
export interface IdeaSessionConfig {
    model: string
    provider: string
    categories: IdeaCategory[]
    maxIdeas: number
    customPrompt?: string
}

/**
 * Idea generation session
 */
export interface IdeaSession {
    id: string
    model: string
    provider: string
    categories: IdeaCategory[]
    maxIdeas: number
    ideasGenerated: number
    status: IdeaSessionStatus
    researchData?: ResearchData
    customPrompt?: string
    goal?: string                      // Added for consistency
    createdAt: number
    updatedAt: number
}

/**
 * Market trend information from research
 */
export interface MarketTrend {
    title: string
    description: string
    source?: string
    url?: string
}

/**
 * Competitor analysis data
 */
export interface Competitor {
    name: string
    description: string
    url?: string
    strengths: string[]
    weaknesses: string[]
    marketShare?: string
}

/**
 * Product Hunt product data
 */
export interface ProductHuntProduct {
    id: string
    name: string
    tagline: string
    description?: string
    url: string
    votesCount: number
    topics: string[]
    launchedAt?: string
}

/**
 * Crunchbase company data
 */
export interface CrunchbaseCompany {
    name: string
    description: string
    url?: string
    fundingTotal?: string
    foundedOn?: string
    numEmployees?: string
    categories: string[]
}

/**
 * Combined research data from all sources
 */
export interface ResearchData {
    categoryAnalysis: string
    sectors: string[]
    marketTrends: MarketTrend[]
    competitors: Competitor[]
    opportunities: string[]
    productHuntProducts?: ProductHuntProduct[]
    crunchbaseCompanies?: CrunchbaseCompany[]
    webSearchResults?: WebSearchResult[]
}

/**
 * Web search result
 */
export interface WebSearchResult {
    title: string
    url: string
    snippet: string
}

/**
 * Market research data for an idea
 */
export interface MarketResearchResult {
    categoryAnalysis?: string
    sectors?: string[]
    trends: MarketTrend[]
    competitors: Competitor[]
    targetAudience?: string
    marketSize?: string
    growthPotential?: string
    opportunities: string[]
}

/**
 * User Persona data
 */
export interface UserPersona {
    name: string
    role: string
    avatarEmoji?: string
    painPoints: string[]
    goals: string[]
    techLiteracy: 'low' | 'medium' | 'high'
    reasoning: string
}

/**
 * User Journey Map step
 */
export interface JourneyStep {
    stage: 'discovery' | 'onboarding' | 'first-value' | 'retention'
    action: string
    emotion: 'frustrated' | 'neutral' | 'happy' | 'excited'
    benefit: string
}

/**
 * SWOT Analysis matrix
 */
export interface SWOTAnalysis {
    strengths: string[]
    weaknesses: string[]
    opportunities: string[]
    threats: string[]
}

/**
 * Business Model and pricing
 */
export interface BusinessModel {
    monetizationType: string
    revenueStreams: Array<{ name: string; description: string; pricePoint?: string }>
    costStructure: string[]
    breakEvenStrategy: string
}

/**
 * Marketing and GTM Plan
 */
export interface MarketingPlan {
    channels: string[]
    first100UsersActionableSteps: string[]
    contentStrategy: string
    launchChecklist: string[]
}

/**
 * Roadmap phase/milestone
 */
export interface RoadmapPhase {
    name: string
    description: string
    duration: string
    deliverables: string[]
    order: number
}

/**
 * Workspace roadmap
 */
export interface WorkspaceRoadmap {
    mvp: RoadmapPhase
    phases: RoadmapPhase[]
    totalDuration: string
}

/**
 * Technology stack recommendation
 */
export interface TechStack {
    frontend: TechChoice[]
    backend: TechChoice[]
    database: TechChoice[]
    infrastructure: TechChoice[]
    other: TechChoice[]
}

/**
 * Individual technology choice
 */
export interface TechChoice {
    name: string
    reason: string
    alternatives?: string[]
}

/**
 * Detailed competitor for idea-specific analysis
 */
export interface IdeaCompetitor {
    name: string
    description: string
    url?: string
    strengths: string[]
    weaknesses: string[]
    missingFeatures: string[]
    marketPosition?: string
    differentiationOpportunity: string
}

/**
 * Generated workspace idea
 */
export interface WorkspaceIdea {
    id: string
    sessionId: string
    title: string
    category: IdeaCategory
    description: string
    // Extended fields from multi-stage pipeline
    explanation?: string
    valueProposition?: string
    longDescription?: string           // Stage 5: Detailed professional description
    nameSuggestions?: string[]         // Stage 4: 10 workspace names
    competitiveAdvantages?: string[]
    roadmap?: WorkspaceRoadmap           // Stage 6: MVP and development phases
    techStack?: TechStack              // Stage 7: Technology recommendations
    ideaCompetitors?: IdeaCompetitor[] // Stage 8: Idea-specific competitor analysis
    personas?: UserPersona[]           // Stage 9: User profiles
    userJourney?: JourneyStep[]        // Stage 9: Journey map
    swot?: SWOTAnalysis                // Stage 10: Analysis matrix
    businessModel?: BusinessModel      // Stage 10: Monetization
    marketingPlan?: MarketingPlan      // Stage 11: GTM strategy
    marketResearch?: MarketResearchResult
    marketAnalysis?: string            // Added for consistency with DB and older code
    estimatedEffort?: string           // Added for consistency with DB
    // Pipeline tracking
    generationStage?: IdeaGenerationStage
    researchContext?: string           // Stage 3: Idea-specific research context
    // Status and references
    status: IdeaStatus
    workspaceId?: string
    logoPath?: string
    metadata?: JsonObject
    createdAt: number
    updatedAt: number
}

/**
 * Enriched workspace idea with all fields populated
 */
export interface EnrichedIdea extends WorkspaceIdea {
    explanation: string
    valueProposition: string
    longDescription: string
    nameSuggestions: string[]
    competitiveAdvantages: string[]
    roadmap: WorkspaceRoadmap
    techStack: TechStack
    ideaCompetitors: IdeaCompetitor[]
}

/**
 * Research progress event
 */
export interface ResearchProgress {
    sessionId: string
    stage: ResearchStage
    progress: number
    message?: string
    data?: Partial<ResearchData>
}

/**
 * Idea generation progress event
 */
export interface IdeaProgress {
    sessionId: string
    ideaIndex: number
    totalIdeas: number
    currentIdea?: Partial<WorkspaceIdea>
    stage: IdeaGenerationStage
    stageProgress?: number  // 0-100 progress within current stage
    stageMessage?: string   // Human-readable stage message
}

/**
 * Category metadata for UI display
 */
export interface CategoryMetadata {
    id: IdeaCategory
    label: string
    description: string
    icon: string
    color: string
    scaffoldTemplate: string
}
