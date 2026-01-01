import { DatabaseService } from './database.service';
import { OllamaService } from './ollama.service';
import { OpenAIService } from './openai.service';
import { LlamaService } from './llama.service';

export type EmbeddingProvider = 'ollama' | 'openai' | 'llama';

export class EmbeddingService {
    private currentProvider: EmbeddingProvider = 'ollama';
    private model: string = 'all-minilm'; // Default for Ollama

    constructor(
        private db: DatabaseService,
        private ollama: OllamaService,
        private openai: OpenAIService,
        private llama: LlamaService
    ) { }

    setProvider(provider: EmbeddingProvider, model?: string) {
        this.currentProvider = provider;
        if (model) this.model = model;
    }

    async generateEmbedding(text: string): Promise<number[]> {
        switch (this.currentProvider) {
            case 'ollama':
                return await this.ollama.getEmbeddings(this.model, text);
            case 'openai':
                return await this.openai.getEmbeddings(text, this.model);
            case 'llama':
                return await this.llama.getEmbeddings(text);
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
