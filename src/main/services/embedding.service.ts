import { DatabaseService } from './database.service';
import { OllamaService } from './ollama.service';
import { OpenAIService } from './openai.service';
import { LlamaService } from './llama.service';
import { SettingsService } from './settings.service';

export type EmbeddingProvider = 'ollama' | 'openai' | 'llama' | 'none';

export class EmbeddingService {
    private currentProvider: EmbeddingProvider = 'ollama';
    private model: string = 'all-minilm'; // Default for Ollama

    constructor(
        private db: DatabaseService,
        private ollama: OllamaService,
        private openai: OpenAIService,
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
                return await this.openai.getEmbeddings(text, this.model);
            case 'llama':
                return await this.llama.getEmbeddings(text);
            case 'none':
                return [];
            default:
                throw new Error('Unsupported embedding provider');
        }
    }

    async indexChunks(path: string, chunks: string[]) {
        // Clear existing vectors for this file
        this.db.clearVectors(path);

        for (const chunk of chunks) {
            try {
                const embedding = await this.generateEmbedding(chunk);
                this.db.storeVector(path, chunk, embedding, { path });
            } catch (e) {
                console.error(`Failed to index chunk for ${path}:`, e);
            }
        }
    }

    async search(query: string, limit: number = 5) {
        const queryEmbedding = await this.generateEmbedding(query);
        return this.db.searchVectors(queryEmbedding, limit);
    }
}
