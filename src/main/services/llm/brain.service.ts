/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * IconBrain Service - User-Focused Memory System
 * 
 * Stores ONLY user-related information:
 * - User preferences (language, style, formatting)
 * - User skills and expertise
 * - User goals and workspaces
 * - User context (timezone, tools, workflow)
 * 
 * Design Philosophy:
 * - NO conversation history (that's episodic memory)
 * - NO workspace-specific details (that's workspace context)
 * - NO temporary facts (only persistent user traits)
 * - YES user identity, preferences, skills, goals
 */

import * as crypto from 'crypto';

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { DatabaseService, SemanticFragment } from '@main/services/data/database.service';
import { BackgroundModelResolver } from '@main/services/llm/background-model-resolver.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { LLMService } from '@main/services/llm/llm.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { RuntimeValue } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';

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
    private lastExtractionTime = 0;
    private readonly EXTRACTION_THROTTLE_MS = 30_000; // 30 seconds between fact extractions

    constructor(
        private db: DatabaseService,
        private embedding: EmbeddingService,
        private llmService: LLMService,
        _processManager: ProcessManagerService,
        private backgroundModelResolver?: BackgroundModelResolver
    ) { }

    async initialize(): Promise<void> {
        if (this.isInitialized) { return; }

        // IconBrain service uses DB fallback only (doesn't need native service)
        // This avoids conflicts with memory-service which uses the same executable
        appLogger.info('BrainService', 'Initializing brain service with DB fallback');

        this.isInitialized = true;
    }

    /** Resets initialization state. */
    async cleanup(): Promise<void> {
        this.isInitialized = false;
        appLogger.info('BrainService', 'IconBrain service cleaned up');
    }

    /**
     * Learn a fact about the user
     */
    @ipc('brain:learn')
    async learnUserFactIpc(category: UserFact['category'], content: string, confidence: number = 0.8): Promise<RuntimeValue> {
        const result = await this.learnUserFact(category, content, confidence);
        return serializeToIpc(result);
    }

    async learnUserFact(
        category: UserFact['category'],
        content: string,
        confidence: number = 0.8
    ): Promise<UserFact> {
        // Validate it's actually user-related
        if (!this.isUserFact(content)) {
            appLogger.warn('BrainService', `Rejected non-user fact: "${content}"`);
            throw new Error('IconBrain only stores user-related information');
        }

        const embedding = await this.embedding.generateEmbedding(content);
        const id = `user-fact-${crypto.randomUUID()}`;
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

        appLogger.info('BrainService', `Learned: [${category}] ${content.substring(0, 50)}...`);
        return fact;
    }

    /**
     * Recall relevant user facts for a given query/context
     */
    @ipc('brain:recall')
    async recallUserFactsIpc(query: string, limit: number = 5): Promise<RuntimeValue> {
        const result = await this.recallUserFacts(query, limit);
        return serializeToIpc(result);
    }

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
    @ipc('brain:get-by-category')
    async getUserFactsByCategoryIpc(category: UserFact['category']): Promise<RuntimeValue> {
        const result = await this.getUserFactsByCategory(category);
        return serializeToIpc(result);
    }

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
    @ipc('brain:get-context')
    async getBrainContextIpc(query?: string): Promise<RuntimeValue> {
        const result = await this.getBrainContext(query);
        return serializeToIpc(result);
    }

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
    @ipc('brain:extract-from-message')
    async extractUserFactsFromMessageIpc(message: string, userId: string = this.userId): Promise<RuntimeValue> {
        const result = await this.extractUserFactsFromMessage(message, userId);
        return serializeToIpc(result);
    }

    async extractUserFactsFromMessage(message: string, _userId: string = this.userId): Promise<UserFact[]> {
        const now = Date.now();
        if (now - this.lastExtractionTime < this.EXTRACTION_THROTTLE_MS) {
            appLogger.debug('BrainService', 'Skipping fact extraction: throttled');
            return [];
        }
        this.lastExtractionTime = now;

        // Sanitize message to prevent prompt injection
        const sanitizedMessage = message
            .replace(/```/g, '') // Remove code block markers
            .replace(/(\r?\n){3,}/g, '\n\n') // Limit excessive newlines
            .slice(0, 5000); // Limit length to prevent prompt overflow

        const prompt = `Extract ONLY user-related facts from this message. Focus on:
- User identity (name, role, company)
- User preferences (likes, dislikes, styles)
- User skills (programming, domains, expertise)
- User goals (what they're building, learning)
- User context (timezone, tools, platform)

Message: "${sanitizedMessage}"

Return ONLY facts about the USER (not about workspaces, not about conversations).
Preserve the original language of the user's message when writing "content".
Format as JSON array:
[
  { "category": "identity|preference|skill|goal|context", "content": "The user...", "confidence": 0.0-1.0 }
]

If NO user facts found, return: []`;

        try {
            const backgroundModel = await this.backgroundModelResolver?.resolve();
            if (!backgroundModel) {
                appLogger.debug('BrainService', 'Skipping fact extraction: no background model available');
                return [];
            }

            const response = await this.llmService.chat(
                [
                    { id: `${Date.now()}`, role: 'system', content: 'You extract user facts. Return ONLY JSON array. Be conservative - only extract clear user facts.', timestamp: new Date() },
                    { id: `${Date.now() + 1}`, role: 'user', content: prompt, timestamp: new Date() }
                ],
                backgroundModel.model,
                undefined,
                backgroundModel.provider
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
    @ipc('brain:forget')
    async forgetUserFactIpc(factId: string): Promise<boolean> {
        await this.forgetUserFact(factId);
        return true;
    }

    async forgetUserFact(factId: string): Promise<void> {
        await this.db.deleteSemanticFragment(factId);
        appLogger.info('BrainService', `Forgot fact: ${factId}`);
    }

    /**
     * Update fact confidence (e.g., when user corrects it)
     */
    @ipc('brain:update-confidence')
    async updateFactConfidenceIpc(factId: string, confidence: number): Promise<boolean> {
        await this.updateFactConfidence(factId, confidence);
        return true;
    }

    async updateFactConfidence(factId: string, confidence: number): Promise<void> {
        const fragments = await this.db.getSemanticFragmentsByIds([factId]);
        const fragment = fragments[0];
        if (fragment?.source === 'user-brain') {
            fragment.importance = confidence;
            fragment.tags = fragment.tags.filter((t: string) => !t.startsWith('confidence:'));
            fragment.tags.push(`confidence:${confidence}`);
            fragment.updatedAt = Date.now();
            await this.db.storeSemanticFragment(fragment);
        }
    }

    // Helper methods

    private isUserFact(content: string): boolean {
        const lowerContent = content.toLowerCase().trim();

        // Skip very short content (likely noise)
        if (lowerContent.length < 10) {
            return false;
        }

        // Must contain user-related indicators with stronger patterns
        const userPatterns = [
            /\bi am\b/, /\bi'm\b/, /\bi prefer\b/, /\bi like\b/, /\bi use\b/, /\bi know\b/,
            /\bi can\b/, /\bi want\b/, /\bi work\b/, /\bi need\b/, /\bi have\b/, /\bi enjoy\b/,
            /\bmy name is\b/, /\bmy role is\b/, /\bmy job is\b/, /\bmy skill\b/, /\bmy goal\b/,
            /\bmy preference\b/, /\bmy expertise\b/, /\bmy background\b/, /\bmy experience\b/,
            /\bben\b/, /\bbenim\b/, /\btercih ederim\b/, /\bseviyorum\b/, /\bkullan.yorum\b/,
            /\bistiyorum\b/, /\bbiliyorum\b/, /\byapabiliyorum\b/,
            /\bich bin\b/, /\bich bevorzuge\b/, /\bich mag\b/, /\bich nutze\b/,
            /\bich will\b/, /\bich brauche\b/, /\bmein name\b/, /\bmeine erfahrung\b/,
            /\bje suis\b/, /\bje pr.f.re\b/, /\bj'aime\b/, /\bj'utilise\b/,
            /\bje veux\b/, /\bmon nom\b/, /\bmon r.le\b/, /\bma comp.tence\b/,
            /\byo soy\b/, /\bme llamo\b/, /\bprefiero\b/, /\bme gusta\b/, /\buso\b/,
            /\bquiero\b/, /\bnecesito\b/, /\bmi nombre\b/, /\bmi trabajo\b/,
            /\beu sou\b/, /\bmeu nome\b/, /\bprefiro\b/, /\bgosto\b/,
            /\bio sono\b/, /\bmi chiamo\b/, /\bpreferisco\b/, /\bmi piace\b/,
            /\bik ben\b/, /\bik gebruik\b/, /\bik wil\b/, /\bmijn naam\b/,
        ];

        // Must NOT contain workspace/conversation/temporal indicators
        const excludePatterns = [
            /\bthe workspace\b/, /\bthis workspace\b/, /\bthe feature\b/, /\bthis feature\b/,
            /\bwe discussed\b/, /\bconversation about\b/, /\bin the chat\b/, /\bthe file\b/,
            /\bthe code\b/, /\berror in\b/, /\bbug in\b/, /\bissue with\b/, /\bproblem with\b/,
            /\bthe function\b/, /\bthe class\b/, /\bthe method\b/, /\bthe variable\b/,
            /\bthe api\b/, /\bthe database\b/, /\bthe server\b/, /\bthe client\b/,
            /\bthis conversation\b/, /\byou said\b/, /\bi was told\b/, /\bmentioned earlier\b/,
            /\byesterday\b/, /\btomorrow\b/, /\blast week\b/, /\bnext week\b/, /\bjust now\b/,
            /\bproje\b/, /\b.zellik\b/, /\bsohbet\b/, /\bdosya\b/, /\bkod\b/, /\bhata\b/,
            /\bprojekt\b/, /\bfeature\b/, /\bchat\b/, /\bdatei\b/, /\bcode\b/, /\bfehler\b/,
            /\bprojet\b/, /\bfonctionnalit.\b/, /\bdiscussion\b/, /\bfichier\b/, /\berreur\b/,
            /\bproyecto\b/, /\bfuncionalidad\b/, /\bconversaci.n\b/, /\barchivo\b/, /\bc.digo\b/,
            /\berror\b/
        ];

        // Check for exclusion patterns first
        for (const pattern of excludePatterns) {
            if (pattern.test(lowerContent)) {
                return false;
            }
        }

        // Check for user patterns - must match at least one
        for (const pattern of userPatterns) {
            if (pattern.test(lowerContent)) {
                return true;
            }
        }

        return false;
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
    @ipc('brain:get-stats')
    async getBrainStatsIpc(): Promise<RuntimeValue> {
        const result = await this.getBrainStats();
        return serializeToIpc(result);
    }

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
