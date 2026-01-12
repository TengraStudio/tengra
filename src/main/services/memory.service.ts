// MemoryService - Refactored for Async DatabaseService
import { DatabaseService, SemanticFragment, EpisodicMemory, EntityKnowledge } from './data/database.service'
import { EmbeddingService } from './llm/embedding.service'
import { LLMService } from './llm/llm.service'
import { ChatMessage } from '../types/llm.types'

interface PersonalitySettings {
    traits: string[];
    responseStyle: 'formal' | 'casual' | 'professional' | 'playful';
    allowProfanity: boolean;
    customInstructions: string;
}

interface OllamaTagsResponse {
    models: { name: string }[];
}

export interface SummarizationResult {
    summary: string;
    title: string;
    topics: string[];
    pendingTasks: string[];
}

// Preferred models in order of priority (smallest first for speed)
const PREFERRED_OLLAMA_MODELS = [
    'llama3.2:1b',
    'llama3.2:3b',
    'phi3:mini',
    'gemma2:2b',
    'qwen2.5:0.5b',
    'qwen2.5:1.5b',
    'llama3.1:8b',
    'llama3:8b',
    'mistral:7b'
];

export class MemoryService {
    private cachedOllamaModel: string | null = null;

    constructor(
        private db: DatabaseService,
        private embedding: EmbeddingService,
        private llmService: LLMService
    ) { }

    // Semantic Memory
    async rememberFact(content: string, source: string = 'user', sourceId: string = 'global', tags: string[] = []): Promise<SemanticFragment> {
        const embedding = await this.embedding.generateEmbedding(content)
        const id = Math.random().toString(36).substring(2, 15)
        const now = Date.now()

        const fragment: SemanticFragment = {
            id,
            content,
            embedding,
            source,
            sourceId,
            tags,
            importance: 1,
            createdAt: now,
            updatedAt: now
        }

        await this.db.storeSemanticFragment(fragment)
        return fragment
    }

    async recallRelevantFacts(query: string, limit: number = 5): Promise<SemanticFragment[]> {
        if (this.embedding.getCurrentProvider() === 'none') {
            return await this.db.searchSemanticFragmentsByText(query, limit)
        }
        const queryEmbedding = await this.embedding.generateEmbedding(query)
        return await this.db.searchSemanticFragments(queryEmbedding, limit)
    }

    async forgetFact(factId: string): Promise<boolean> {
        return (await this.db.deleteSemanticFragment(factId))
    }

    // Episodic Memory (Conversation History)
    async summarizeChat(chatId: string, provider?: string, model?: string): Promise<SummarizationResult> {
        const messages = await this.db.getChatMessages(chatId);
        if (messages.length === 0) return { summary: '', title: 'Empty Chat', topics: [], pendingTasks: [] };

        const transcript = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
        const prompt = `Analyze the following chat transcript and provide:
1. A concise summary (max 3 sentences).
2. A short, descriptive title.
3. Key topics discussed (comma-separated).
4. Any unresolved tasks or questions.

Format the output as JSON:
{
  "summary": "...",
  "title": "...",
  "topics": ["...", "..."],
  "pendingTasks": ["...", "..."]
}

Transcript:
${transcript}`;

        try {
            const res = await this.callLLM(
                [{ role: 'system', content: 'You are an expert at analyzing and summarizing conversations.' }, { role: 'user', content: prompt }],
                model || 'gpt-4o-mini',
                provider
            );

            const data = JSON.parse(res.content.replace(/```json|```/g, '').trim());
            return data;
        } catch (error) {
            console.warn('[MemoryService] Advanced summarization failed, falling back to basic:', error);
            return {
                summary: `Conversation with ${messages.length} messages.`,
                title: `Chat Session ${new Date().toLocaleDateString()}`,
                topics: [],
                pendingTasks: []
            };
        }
    }

    async summarizeSession(chatId: string, provider?: string, model?: string): Promise<EpisodicMemory | null> {
        const messages = await this.db.getChatMessages(chatId);
        if (messages.length < 5) return null;

        const analysis = await this.summarizeChat(chatId, provider, model);

        const embedding = await this.embedding.generateEmbedding(analysis.summary);
        const id = Math.random().toString(36).substring(2, 15);
        const now = Date.now();

        const memory: EpisodicMemory = {
            id,
            title: analysis.title,
            summary: analysis.summary,
            embedding,
            startDate: messages[0].timestamp || now,
            endDate: messages[messages.length - 1].timestamp || now,
            chatId,
            participants: ['user', 'assistant'],
            createdAt: now
        };

        // Store topics as semantic fragments for better retrieval if needed
        if (analysis.topics && Array.isArray(analysis.topics)) {
            for (const topic of analysis.topics) {
                await this.rememberFact(`In chat "${analysis.title}", we discussed: ${topic}`, 'system', chatId, ['topic', ...analysis.topics]);
            }
        }

        await this.db.storeEpisodicMemory(memory);
        return memory;
    }

    async recallEpisodes(query: string, limit: number = 3): Promise<EpisodicMemory[]> {
        if (this.embedding.getCurrentProvider() === 'none') {
            return await this.db.searchEpisodicMemoriesByText(query, limit)
        }
        const queryEmbedding = await this.embedding.generateEmbedding(query)
        return await this.db.searchEpisodicMemories(queryEmbedding, limit)
    }

    // Entity Memory (Structured Facts)
    async setEntityFact(entityType: string, entityName: string, key: string, value: string): Promise<EntityKnowledge> {
        const id = `${entityType}:${entityName}:${key}`.replace(/\s+/g, '_').toLowerCase()
        const knowledge: EntityKnowledge = {
            id,
            entityType,
            entityName,
            key,
            value,
            confidence: 1.0,
            source: 'manual',
            updatedAt: Date.now()
        }
        await this.db.storeEntityKnowledge(knowledge)
        return knowledge
    }

    async getEntityFacts(entityName: string): Promise<EntityKnowledge[]> {
        return await this.db.getEntityKnowledge(entityName)
    }

    async removeEntityFact(id: string): Promise<boolean> {
        return await this.db.deleteEntityKnowledge(id)
    }

    // High-level "Think" method to gather context
    async gatherContext(query: string): Promise<string> {
        const facts = await this.recallRelevantFacts(query, 3)
        const episodes = await this.recallEpisodes(query, 2)

        let context = ''
        if (facts.length > 0) {
            context += 'Related Facts:\n' + facts.map(f => `- ${f.content}`).join('\n') + '\n\n'
        }
        if (episodes.length > 0) {
            context += 'Related Episodes:\n' + episodes.map(e => `- ${e.summary}`).join('\n')
        }
        return context
    }

    // Get all memories for UI display
    async getAllMemories(): Promise<{ facts: SemanticFragment[], episodes: EpisodicMemory[], entities: EntityKnowledge[] }> {
        const facts = await this.db.getAllSemanticFragments()
        const episodes = await this.db.getAllEpisodicMemories()
        const entities = await this.db.getAllEntityKnowledge()
        return { facts, episodes, entities }
    }

    // --- Personality Memory ---
    async getPersonality(): Promise<PersonalitySettings | null> {
        const value = await this.db.recallMemory('system:personality')
        if (value) {
            try {
                return JSON.parse(value) as PersonalitySettings
            } catch {
                console.error('[MemoryService] Failed to parse personality')
            }
        }
        return null
    }

    async updatePersonality(personality: PersonalitySettings): Promise<void> {
        await this.db.storeMemory('system:personality', JSON.stringify(personality))
        console.log('[MemoryService] Personality updated:', personality)
    }

    // --- Active Memory Implementation ---

    async extractFactsFromMessage(userId: string, content: string, provider?: string, model: string = 'gpt-4o'): Promise<SemanticFragment[]> {
        // 1. Detect Personality Changes first
        await this.detectPersonalityChange(content, provider, model);

        // 2. Extract specific facts
        const prompt = `Analyze the following user message and extract key facts, preferences, or important information about the user or their projects.
Return a valid JSON array of strings, where each string is a standalone fact.
If no relevant facts are found, return an empty array.

Message: "${content}"

Example Output:
["User prefers dark mode", "Working on Orbit project", "Wants to use LanceDB"]`

        try {
            const res = await this.callLLM(
                [{ role: 'system', content: 'You are a Fact Extraction Agent.' }, { role: 'user', content: prompt }],
                model,
                provider
            );

            const facts: string[] = JSON.parse(res.content.replace(/```json|```/g, '').trim() || '[]');
            const fragments: SemanticFragment[] = [];

            for (const fact of facts) {
                console.log('[Active Memory] Learned:', fact);
                const fragment = await this.rememberFact(fact, 'user', userId, ['auto-extracted']);
                fragments.push(fragment);
            }
            return fragments;
        } catch (error) {
            console.error('[Active Memory] Fact extraction failed:', error);
            return [];
        }
    }

    /**
     * Analyzes if the user is giving personality/style instructions to the AI
     */
    private async detectPersonalityChange(content: string, provider?: string, model: string = 'gpt-4o') {
        // Quick check for intent keywords to avoid unnecessary LLM calls
        const keywords = ['davran', 'ol', 'konuş', 'speak', 'act', 'be ', 'personality', 'kişilik', 'tarz', 'style'];
        const hasKeyword = keywords.some(k => content.toLowerCase().includes(k));
        if (!hasKeyword) return;

        const prompt = `Analyze if the user is giving instructions on how YOU (the AI) should behave, speak, or what personality YOU should have.
If they are, extract the new personality traits and response style.
Return a JSON object in this format (or null if no such request):
{
  "traits": ["trait1", "trait2"],
  "responseStyle": "formal" | "casual" | "professional" | "playful",
  "allowProfanity": boolean,
  "customInstructions": "full description of the persona"
}

User Message: "${content}"`;

        try {
            const res = await this.callLLM(
                [{ role: 'system', content: 'You are a Personality Analysis Agent.' }, { role: 'user', content: prompt }],
                model,
                provider
            );

            const update = JSON.parse(res.content.replace(/```json|```/g, '').trim() || 'null');
            if (update) {
                const current = await this.getPersonality() || { traits: [], customInstructions: '', allowProfanity: false, responseStyle: 'professional' };
                const merged = {
                    ...current,
                    ...update,
                    traits: Array.from(new Set([...(current.traits || []), ...(update.traits || [])]))
                };
                await this.updatePersonality(merged);
                console.log('[MemoryService] Personality auto-updated based on conversation');
            }
        } catch {
            console.warn('[MemoryService] Personality detection failed (might not be an update request)');
        }
    }

    /**
     * Get first available Ollama model from preferred list
     */
    private async getAvailableOllamaModel(): Promise<string | null> {
        if (this.cachedOllamaModel) return this.cachedOllamaModel;

        try {
            const res = await fetch('http://127.0.0.1:11434/api/tags');
            if (!res.ok) return null;

            const data = await res.json() as OllamaTagsResponse;
            const installedModels = (data.models || []).map((m) => m.name?.toLowerCase());

            // Find first preferred model that's installed
            for (const preferred of PREFERRED_OLLAMA_MODELS) {
                if (installedModels.some((m: string) => m.startsWith(preferred.split(':')[0]))) {
                    // Find exact match or closest
                    const match = installedModels.find((m: string) => m === preferred || m.startsWith(preferred));
                    if (match) {
                        this.cachedOllamaModel = match;
                        console.log(`[MemoryService] Auto-selected Ollama model: ${match}`);
                        return match;
                    }
                }
            }

            // Fallback: use first available model
            if (installedModels.length > 0) {
                this.cachedOllamaModel = installedModels[0];
                console.log(`[MemoryService] Fallback to first available model: ${installedModels[0]}`);
                return installedModels[0];
            }
        } catch (e) {
            console.error('[MemoryService] Failed to get Ollama models:', e);
        }
        return null;
    }

    /**
     * Unified LLM call for background memory tasks.
     * Auto-detects available Ollama model for free local processing.
     */
    private async callLLM(messages: ChatMessage[], _model: string, _provider?: string): Promise<{ content: string }> {
        const backgroundModel = await this.getAvailableOllamaModel();

        if (!backgroundModel) {
            console.log('[MemoryService] No Ollama model available, skipping background task');
            return { content: '[]' }; // Return empty for fact extraction
        }

        console.log(`[MemoryService] Background task using ${backgroundModel} via ollama`);
        const res = await this.llmService.chat(messages, backgroundModel, [], 'ollama');
        return { content: res.content };
    }
}
