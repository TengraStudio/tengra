import { OllamaService } from '@main/services/llm/ollama.service';
import { LLMService } from '@main/services/llm/llm.service';
import { LlamaService } from '@main/services/llm/llama.service';
import { SettingsService } from '@main/services/settings.service';

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
        this.initializeProvider()
    }

    private initializeProvider() {
        const settings = this.settingsService.getSettings()
        if (settings.embeddings) {
            this.setProvider(settings.embeddings.provider, settings.embeddings.model)
        }
    }

    setProvider(provider: EmbeddingProvider, model?: string) {
        this.currentProvider = provider;
        if (model) this.model = model;
    }

    getCurrentProvider(): EmbeddingProvider {
        // Ensure settings are synced
        const settings = this.settingsService.getSettings();
        if (settings.embeddings?.provider) {
            return settings.embeddings.provider;
        }
        return this.currentProvider;
    }

    async generateEmbedding(text: string): Promise<number[]> {
        // Always check latest settings before generating
        const settings = this.settingsService.getSettings();
        if (settings.embeddings?.provider) {
            this.currentProvider = settings.embeddings.provider;
            if (settings.embeddings.model) this.model = settings.embeddings.model;
        }

        switch (this.currentProvider) {
            case 'ollama':
                return await this.ollama.getEmbeddings(this.model, text);
            case 'openai':
                return await this.llm.getEmbeddings(text, this.model);
            case 'llama':
                return await this.llama.getEmbeddings(text);
            case 'none':
                return [];
            default:
                throw new Error('Unsupported embedding provider');
        }
    }

    // Indexing and Search moved to CodeIntelligenceService / RAGService
}
