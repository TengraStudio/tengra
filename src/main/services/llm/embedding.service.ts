import { appLogger } from '@main/logging/logger';
import { LlamaService } from '@main/services/llm/llama.service';
import { LLMService } from '@main/services/llm/llm.service';
import { OllamaService } from '@main/services/llm/ollama.service';
import { SettingsService } from '@main/services/system/settings.service';

export type EmbeddingProvider = 'ollama' | 'openai' | 'llama' | 'none';

export class EmbeddingService {
    private currentProvider: EmbeddingProvider = 'ollama';
    private model: string = 'all-minilm'; // Default for Ollama

    constructor(
        private ollama: OllamaService,
        private llm: LLMService,
        private llama: LlamaService,
        private settingsService: SettingsService
    ) {
        this.initializeProvider();
    }

    private initializeProvider() {
        const settings = this.settingsService.getSettings();
        this.setProvider(settings.embeddings.provider, settings.embeddings.model);
    }

    setProvider(provider: EmbeddingProvider, model?: string) {
        this.currentProvider = provider;
        if (model) { this.model = model; }
    }

    getCurrentProvider(): EmbeddingProvider {
        // Ensure settings are synced
        const settings = this.settingsService.getSettings();
        return settings.embeddings.provider;
    }

    async generateEmbedding(text: string): Promise<number[]> {
        // Always check latest settings before generating
        const settings = this.settingsService.getSettings();
        this.currentProvider = settings.embeddings.provider;
        if (settings.embeddings.model) { this.model = settings.embeddings.model; }

        let vector: number[] | undefined;

        try {
            switch (this.currentProvider) {
                case 'ollama':
                    vector = await this.ollama.getEmbeddings(this.model, text);
                    break;
                case 'openai':
                    vector = await this.llm.getEmbeddings(text, this.model);
                    break;
                case 'llama':
                    vector = await this.llama.getEmbeddings(text);
                    break;
                case 'none':
                default:
                    // Return zero vector
                    break;
            }
        } catch (error) {
            appLogger.error('EmbeddingService', `Failed to generate embedding with ${this.currentProvider}`, error as Error);
        }

        // Final check: Guarantee non-empty vector with correct dimensions for the database
        // Currently migrations define vector(1536) for semantic storage
        const REQUIRED_DIMENSION = 1536;

        if (!vector || vector.length === 0) {
            return new Array(REQUIRED_DIMENSION).fill(0);
        }

        if (vector.length !== REQUIRED_DIMENSION) {
            appLogger.warn('EmbeddingService', `Dimension mismatch: Got ${vector.length}, expected ${REQUIRED_DIMENSION}. Returning zero vector fallback.`);
            // Note: Padding/Truncating is possible but risky for semantic quality.
            // For now, we return zero vector to ensure DB consistency.
            return new Array(REQUIRED_DIMENSION).fill(0);
        }

        return vector;
    }

    // Indexing and Search moved to CodeIntelligenceService / RAGService
}
