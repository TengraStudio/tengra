import { IdeaCategory } from '@shared/types/ideas';

const CURRENT_YEAR = new Date().getFullYear();

export const IDEA_PROMPTS = {
    SEED_SYSTEM: (brainContext?: string) => `You are an elite startup advisor and venture capital strategist with 20+ years of experience identifying breakthrough ideas.

Your task is to generate a UNIQUE, INNOVATIVE initial concept (seed idea) based on deep category research.

Key principles:
1. CATEGORY-FIRST: You have thoroughly researched the category before proposing any idea
2. UNIQUENESS: Every idea must be distinctly different from existing solutions
3. SPECIFICITY: Target specific user pain points with concrete solutions
4. FEASIBILITY: Ideas should be buildable by a small team within 6-12 months
5. TIMELY: Leverage ${CURRENT_YEAR} technology trends and market conditions

This is ONLY the seed idea. It will be further researched and refined in subsequent stages.

Always respond in valid JSON format.
                
CRITICAL RULE: You MUST strictly adhere to the user's selected category. Do NOT pivot to AI, machine learning, or unrelated trends unless they are the primary category or specifically requested. If the category is "game", focus on gameplay, mechanics, and fun, NOT just "AI-driven NPCs".${brainContext ? `\n\n${brainContext}` : ''}`,

    SEED_GENERATION: (options: {
        category: IdeaCategory
        categoryNames: Record<IdeaCategory, string>
        categoryResearch: string
        previousIdeasContext: string
        sessionContext: string
        ideaIndex: number
        attemptGuidance: string
        creativityHint: string
        customPrompt?: string
    }) => `Generate a SEED IDEA for a ${options.categoryNames[options.category]} (#${options.ideaIndex}).
${options.attemptGuidance}
=== DEEP CATEGORY RESEARCH (${CURRENT_YEAR}) ===
${options.categoryResearch}
${options.previousIdeasContext}${options.sessionContext}
=== SEED IDEA REQUIREMENTS ===
This is the FINAL INITIAL concept (seed idea) that will be further researched and developed.

1. UNIQUE: Must be distinctly different from any existing or previously generated ideas.
2. SPECIFIC: Target a clear, specific user pain point.
3. NOVEL: Not a clone of existing products - bring something new.
4. TIMELY: Relevant to ${CURRENT_YEAR} market conditions and technology.
5. RELEVANT: Strictly stay within the ${options.categoryNames[options.category]} category. Do NOT focus on AI/ML unless it is essential to the core functionality of this specific category.

💡 Creative direction: ${options.creativityHint}
${options.customPrompt ? `\n\n=== USER CONSTRAINTS ===\n${options.customPrompt}\n` : ''}
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
}`,

    PERSONAS: (title: string, description: string, context?: string) => `Create 3 detailed user personas and a 4-step journey map for:
Title: ${title}
Description: ${description}
Context: ${context}

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
}`,

    BUSINESS_STRATEGY: (title: string, targetMarket: string) => `Develop a SWOT analysis and business model for:
Title: ${title}
Target Market: ${targetMarket}

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
}`,

    GTM_PLAN: (title: string, valueProp?: string) => `Create a Go-To-Market plan for:
Title: ${title}
Value Prop: ${valueProp}

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
}`,

    MARKET_PREVIEW: (category: IdeaCategory) => `Provide a BRIEF market overview for ${category} development in ${CURRENT_YEAR}.

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
}`,

    IDEA_RESEARCH: (options: { title: string, description: string, category: string }) => `Perform targeted market research for the following project idea:
Title: ${options.title}
Description: ${options.description}
Category: ${options.category}

Identify:
- Specific target audience segments
- Unique selling points (USPs)
- Potential technical or market challenges
- Direct and indirect competitors not previously identified

Format the research as a structured context for further development.`,

    COMPETITOR_ANALYSIS: (options: { title: string, description: string, research: string }) => `Analyze the competitive landscape for:
Title: ${options.title}
Idea Context: ${options.research}

Identify:
- 3-5 specific competitors with strengths and weaknesses
- Specific opportunities for differentiation
- List our project's competitive advantages (USPs)

Respond in JSON:
{
    "competitors": [
        { "name": "...", "description": "...", "strengths": ["..."], "weaknesses": ["..."], "missingFeatures": ["..."], "differentiationOpportunity": "..." }
    ],
    "advantages": ["..."]
}`
};
