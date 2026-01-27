/**
 * Brain Service - User-Focused Memory System
 * 
 * Stores ONLY user-related information:
 * - User preferences (language, style, formatting)
 * - User skills and expertise
 * - User goals and projects
 * - User context (timezone, tools, workflow)
 * 
 * Design Philosophy:
 * - NO conversation history (that's episodic memory)
 * - NO project-specific details (that's project context)
 * - NO temporary facts (only persistent user traits)
 * - YES user identity, preferences, skills, goals
 */

import path from 'path';

import { appLogger } from '@main/logging/logger';
import { DatabaseService, SemanticFragment } from '@main/services/data/database.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { LLMService } from '@main/services/llm/llm.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { app } from 'electron';

export interface UserFact {
    id: string
    category: 'preference' | 'skill' | 'goal' | 'context' | 'identity'
    content: string
    confidence: number // 0-1, how confident are we in this fact
    embedding: number[]
    createdAt: number
    updatedAt: number
    lastVerified?: number
}

export interface BrainContext {
    identity: string[] // "I am a...", "My name is..."
    preferences: string[] // "I prefer...", "I like..."
    skills: string[] // "I know...", "I can..."
    goals: string[] // "I want to...", "I'm working on..."
    context: string[] // "I use...", "I work in..."
}


export class BrainService {
    private isInitialized = false;
    private userId = 'default-user'; // Can be expanded to multi-user

    constructor(
        private db: DatabaseService,
        private embedding: EmbeddingService,
        private llmService: LLMService,
        private processManager: ProcessManagerService
    ) { }

    async initialize(): Promise<void> {
        if (this.isInitialized) { return; }

        const dbPath = path.join(app.getPath('userData'), 'brain.db');

        void this.processManager.startService({
            name: 'brain-service',
            executable: 'orbit-memory-service', // Reuse memory service for vectors
            persistent: true
        });

        try {
            await this.processManager.sendRequest('brain-service', {
                type: 'Init',
                path: dbPath
            });
            this.isInitialized = true;
            appLogger.info('BrainService', `Initialized user brain at: ${dbPath}`);
        } catch (error) {
            appLogger.warn('BrainService', `Native service unavailable, using DB fallback: ${error}`);
        }

        this.isInitialized = true;
    }

    /**
     * Learn a fact about the user
     */
    async learnUserFact(
        category: UserFact['category'],
        content: string,
        confidence: number = 0.8
    ): Promise<UserFact> {
        // Validate it's actually user-related
        if (!this.isUserFact(content)) {
            appLogger.warn('BrainService', `Rejected non-user fact: "${content}"`);
            throw new Error('Brain only stores user-related information');
        }

        const embedding = await this.embedding.generateEmbedding(content);
        const id = `user-fact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = Date.now();

        const fact: UserFact = {
            id,
            category,
            content,
            confidence,
            embedding,
            createdAt: now,
            updatedAt: now
        };

        // Store in DB as semantic fragment with special tags
        const fragment: SemanticFragment = {
            id: fact.id,
            content: fact.content,
            embedding: fact.embedding,
            source: 'user-brain',
            sourceId: this.userId,
            tags: [category, 'user-fact', `confidence:${confidence}`],
            importance: confidence,
            createdAt: fact.createdAt,
            updatedAt: fact.updatedAt
        };

        await this.db.storeSemanticFragment(fragment);

        // Store in native vector store
        if (this.isInitialized) {
            await this.processManager.sendRequest('brain-service', {
                type: 'InsertVector',
                id: fact.id,
                content: fact.content,
                embedding: fact.embedding,
                metadata: JSON.stringify({ category, userId: this.userId, confidence })
            }).catch(e => appLogger.error('BrainService', `Native insert failed: ${e}`));
        }

        appLogger.info('BrainService', `Learned: [${category}] ${content.substring(0, 50)}...`);
        return fact;
    }

    /**
     * Recall relevant user facts for a given query/context
     */
    async recallUserFacts(query: string, limit: number = 5): Promise<UserFact[]> {
        const queryEmbedding = await this.embedding.generateEmbedding(query);

        // Search semantic fragments with user-brain source
        const fragments = await this.db.searchSemanticFragments(queryEmbedding, limit);
        const userFragments = fragments.filter(f => f.source === 'user-brain' && f.sourceId === this.userId);

        return userFragments.map(f => this.fragmentToUserFact(f));
    }

    /**
     * Get all facts by category
     */
    async getUserFactsByCategory(category: UserFact['category']): Promise<UserFact[]> {
        const fragments = await this.db.searchSemanticFragmentsByText(this.userId, '');
        const userFragments = fragments.filter(f =>
            f.source === 'user-brain' &&
            f.sourceId === this.userId &&
            f.tags.includes(category)
        );

        return userFragments.map(f => this.fragmentToUserFact(f));
    }

    /**
     * Get structured brain context for AI injection
     */
    async getBrainContext(query?: string): Promise<BrainContext> {
        const identity = await this.getUserFactsByCategory('identity');
        const preferences = await this.getUserFactsByCategory('preference');
        const skills = await this.getUserFactsByCategory('skill');
        const goals = await this.getUserFactsByCategory('goal');
        const context = await this.getUserFactsByCategory('context');

        // If query provided, also get relevant facts
        const relevant = query ? await this.recallUserFacts(query, 5) : [];

        return {
            identity: identity.map(f => f.content),
            preferences: [...preferences.map(f => f.content), ...relevant.filter(f => f.category === 'preference').map(f => f.content)],
            skills: [...skills.map(f => f.content), ...relevant.filter(f => f.category === 'skill').map(f => f.content)],
            goals: [...goals.map(f => f.content), ...relevant.filter(f => f.category === 'goal').map(f => f.content)],
            context: [...context.map(f => f.content), ...relevant.filter(f => f.category === 'context').map(f => f.content)]
        };
    }

    /**
     * Format brain context for injection into AI prompts
     */
    formatBrainContext(context: BrainContext): string {
        const sections: string[] = [];

        if (context.identity.length > 0) {
            sections.push(`**User Identity:**\n${context.identity.map(f => `- ${f}`).join('\n')}`);
        }

        if (context.preferences.length > 0) {
            sections.push(`**User Preferences:**\n${context.preferences.map(f => `- ${f}`).join('\n')}`);
        }

        if (context.skills.length > 0) {
            sections.push(`**User Skills:**\n${context.skills.map(f => `- ${f}`).join('\n')}`);
        }

        if (context.goals.length > 0) {
            sections.push(`**User Goals:**\n${context.goals.map(f => `- ${f}`).join('\n')}`);
        }

        if (context.context.length > 0) {
            sections.push(`**User Context:**\n${context.context.map(f => `- ${f}`).join('\n')}`);
        }

        return sections.length > 0
            ? `## About the User\n\n${sections.join('\n\n')}`
            : '';
    }

    /**
     * Auto-extract user facts from conversation
     */
    async extractUserFactsFromMessage(message: string, _userId: string = this.userId): Promise<UserFact[]> {
        const prompt = `Extract ONLY user-related facts from this message. Focus on:
- User identity (name, role, company)
- User preferences (likes, dislikes, styles)
- User skills (programming, domains, expertise)
- User goals (what they're building, learning)
- User context (timezone, tools, platform)

Message: "${message}"

Return ONLY facts about the USER (not about projects, not about conversations).
Format as JSON array:
[
  { "category": "identity|preference|skill|goal|context", "content": "The user...", "confidence": 0.0-1.0 }
]

If NO user facts found, return: []`;

        try {
            const response = await this.llmService.chat(
                [
                    { id: `${Date.now()}`, role: 'system', content: 'You extract user facts. Return ONLY JSON array. Be conservative - only extract clear user facts.', timestamp: new Date() },
                    { id: `${Date.now() + 1}`, role: 'user', content: prompt, timestamp: new Date() }
                ],
                'gpt-4o-mini',
                undefined,
                'openai'
            );

            const facts = safeJsonParse<Array<{ category: UserFact['category']; content: string; confidence: number }>>(
                response.content.replace(/```json|```/g, '').trim(),
                []
            );

            const learned: UserFact[] = [];
            for (const fact of facts) {
                if (this.isValidCategory(fact.category) && this.isUserFact(fact.content)) {
                    const userFact = await this.learnUserFact(fact.category, fact.content, fact.confidence);
                    learned.push(userFact);
                }
            }

            return learned;
        } catch (error) {
            appLogger.error('BrainService', `Fact extraction failed: ${error}`);
            return [];
        }
    }

    /**
     * Forget a user fact
     */
    async forgetUserFact(factId: string): Promise<void> {
        await this.db.deleteSemanticFragment(factId);
        appLogger.info('BrainService', `Forgot fact: ${factId}`);
    }

    /**
     * Update fact confidence (e.g., when user corrects it)
     */
    async updateFactConfidence(factId: string, confidence: number): Promise<void> {
        const fragments = await this.db.getSemanticFragmentsByIds([factId]);
        const fragment = fragments[0];
        if (fragment.source === 'user-brain') {
            fragment.importance = confidence;
            fragment.tags = fragment.tags.filter((t: string) => !t.startsWith('confidence:'));
            fragment.tags.push(`confidence:${confidence}`);
            fragment.updatedAt = Date.now();
            await this.db.storeSemanticFragment(fragment);
        }
    }

    // Helper methods

    private isUserFact(content: string): boolean {
        const lowerContent = content.toLowerCase();

        // Must contain user-related indicators
        const userIndicators = [
            'user', 'i am', 'my', 'i prefer', 'i like', 'i use',
            'i know', 'i can', 'i want', 'i work', 'i need'
        ];

        // Must NOT contain project/conversation indicators
        const excludeIndicators = [
            'the project', 'this feature', 'we discussed', 'conversation about',
            'in the chat', 'the file', 'the code', 'error in'
        ];

        const hasUserIndicator = userIndicators.some(indicator => lowerContent.includes(indicator));
        const hasExcludeIndicator = excludeIndicators.some(indicator => lowerContent.includes(indicator));

        return hasUserIndicator && !hasExcludeIndicator;
    }

    private isValidCategory(category: string): category is UserFact['category'] {
        return ['identity', 'preference', 'skill', 'goal', 'context'].includes(category);
    }

    private fragmentToUserFact(fragment: SemanticFragment): UserFact {
        const confidenceTag = fragment.tags.find(t => t.startsWith('confidence:'));
        const confidence = confidenceTag ? parseFloat(confidenceTag.split(':')[1]) : fragment.importance;

        const category = fragment.tags.find(t => this.isValidCategory(t)) as UserFact['category'];

        return {
            id: fragment.id,
            category,
            content: fragment.content,
            confidence,
            embedding: fragment.embedding,
            createdAt: fragment.createdAt,
            updatedAt: fragment.updatedAt
        };
    }

    /**
     * Get brain summary stats
     */
    async getBrainStats(): Promise<{
        totalFacts: number
        byCategory: Record<string, number>
        lastUpdated: number
    }> {
        const fragments = await this.db.searchSemanticFragmentsByText(this.userId, '');
        const userFragments = fragments.filter(f => f.source === 'user-brain' && f.sourceId === this.userId);

        const byCategory: Record<string, number> = {
            identity: 0,
            preference: 0,
            skill: 0,
            goal: 0,
            context: 0
        };

        let lastUpdated = 0;

        for (const f of userFragments) {
            const category = f.tags.find(t => this.isValidCategory(t));
            if (category) {
                byCategory[category]++;
            }
            if (f.updatedAt > lastUpdated) {
                lastUpdated = f.updatedAt;
            }
        }

        return {
            totalFacts: userFragments.length,
            byCategory,
            lastUpdated
        };
    }
}
