import { DatabaseService } from '../data/database.service';
import { EmbeddingService } from './embedding.service';

export interface RetrievalResult {
    contextString: string;
    sources: string[];
}

export class ContextRetrievalService {

    constructor(
        private db: DatabaseService,
        private embedding: EmbeddingService
    ) { }

    async retrieveContext(query: string, _projectId?: string, limit: number = 5): Promise<RetrievalResult> {
        try {
            const vector = await this.embedding.generateEmbedding(query);

            // Parallel search
            const [symbols, fragments] = await Promise.all([
                this.db.searchCodeSymbols(vector),
                this.db.searchSemanticFragments(vector, limit)
            ]);

            const contextParts: string[] = [];
            const sources: string[] = [];

            if (symbols.length > 0) {
                contextParts.push("Relevant Code Symbols:");
                symbols.slice(0, 3).forEach(sym => {
                    contextParts.push(`- ${sym.kind} ${sym.name} (${sym.path}:${sym.line})\n  ${sym.signature}\n  ${sym.docstring || ''}`);
                    if (!sources.includes(sym.path)) sources.push(sym.path);
                });
            }

            if (fragments.length > 0) {
                contextParts.push("\nRelevant Context:");
                fragments.forEach(frag => {
                    contextParts.push(`- [${frag.source}] ${frag.content.trim().substring(0, 300)}...`);
                    if (!sources.includes(frag.sourceId)) sources.push(frag.sourceId);
                });
            }

            return {
                contextString: contextParts.join('\n'),
                sources
            };

        } catch (error) {
            console.error('[ContextRetrieval] Failed to retrieve context', error);
            return { contextString: '', sources: [] };
        }
    }
}
