import { appLogger } from '@main/logging/logger';
import { DatabaseService } from '@main/services/data/database.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';

export interface RetrievalResult {
    contextString: string;
    sources: string[];
}

export class ContextRetrievalService {

    constructor(
        private db: DatabaseService,
        private embedding: EmbeddingService
    ) { }

    async retrieveContext(query: string, projectId?: string, limit: number = 5): Promise<RetrievalResult> {
        try {
            let projectPath: string | undefined;
            if (projectId) {
                // Try to find project by ID to get its path
                const projects = await this.db.getProjects();
                const project = projects.find(p => p.id === projectId || p.path === projectId);
                projectPath = project?.path ?? projectId; // Fallback to projectId if it's already a path
            }

            const vector = await this.embedding.generateEmbedding(query);

            // Parallel search with partial-failure tolerance
            const [symbolsResult, fragmentsResult] = await Promise.allSettled([
                this.db.searchCodeSymbols(vector, projectPath),
                this.db.searchSemanticFragments(vector, limit, projectPath)
            ]);
            const symbols =
                symbolsResult.status === 'fulfilled' ? symbolsResult.value : [];
            const fragments =
                fragmentsResult.status === 'fulfilled' ? fragmentsResult.value : [];

            if (symbolsResult.status === 'rejected') {
                appLogger.warn(
                    'ContextRetrieval',
                    `Code symbol search failed: ${symbolsResult.reason instanceof Error ? symbolsResult.reason.message : String(symbolsResult.reason)}`
                );
            }
            if (fragmentsResult.status === 'rejected') {
                appLogger.warn(
                    'ContextRetrieval',
                    `Semantic fragment search failed: ${fragmentsResult.reason instanceof Error ? fragmentsResult.reason.message : String(fragmentsResult.reason)}`
                );
            }

            const contextParts: string[] = [];
            const sources: string[] = [];

            if (symbols.length > 0) {
                contextParts.push("Relevant Code Symbols:");
                symbols.slice(0, 3).forEach(sym => {
                    contextParts.push(`- ${sym.kind} ${sym.name} (${sym.path}:${sym.line})\n  ${sym.signature}\n  ${sym.docstring}`);
                    if (!sources.includes(sym.path)) { sources.push(sym.path); }
                });
            }

            if (fragments.length > 0) {
                contextParts.push("\nRelevant Context:");
                fragments.forEach(frag => {
                    contextParts.push(`- [${frag.source}] ${frag.content.trim().substring(0, 300)}...`);
                    if (!sources.includes(frag.sourceId)) { sources.push(frag.sourceId); }
                });
            }

            return {
                contextString: contextParts.join('\n'),
                sources
            };

        } catch (error) {
            appLogger.error('ContextRetrieval', 'Failed to retrieve context', error as Error);
            return { contextString: '', sources: [] };
        }
    }
}
