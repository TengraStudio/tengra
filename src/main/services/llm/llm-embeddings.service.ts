import { appLogger } from '@main/logging/logger';
import { HttpService } from '@main/services/external/http.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { ApiError, AuthenticationError, NetworkError } from '@shared/utils/error.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { ValidationError } from '@shared/utils/error.util';

/** Dependencies required by the embeddings service. */
export interface LLMEmbeddingsDeps {
    httpService: HttpService;
    keyRotationService: KeyRotationService;
}

/**
 * Service responsible for generating text embeddings via OpenAI-compatible APIs.
 */
export class LLMEmbeddingsService {
    constructor(
        private deps: LLMEmbeddingsDeps,
        private getOpenAIApiKey: () => string,
        private getOpenAIBaseUrl: () => string
    ) {}

    /**
     * Generates an embedding vector for the given input text.
     * @param input - The text to embed.
     * @param model - The embedding model to use.
     * @returns A numeric embedding vector.
     */
    async getEmbeddings(input: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
        const normalizedInput = input.trim();
        if (normalizedInput.length === 0) {
            throw new ValidationError('Embedding input must not be empty', { field: 'input' });
        }
        const normalizedModel = model.trim();
        if (normalizedModel.length === 0) {
            throw new ValidationError('Embedding model must not be empty', { field: 'model' });
        }

        const key = this.deps.keyRotationService.getCurrentKey('openai') ?? this.getOpenAIApiKey();
        const baseUrl = this.getOpenAIBaseUrl();

        if (!key && !baseUrl.match(/(localhost|127\.0\.0\.1)/)) {
            throw new AuthenticationError('OpenAI API Key not set');
        }

        try {
            const response = await this.deps.httpService.fetch(`${baseUrl}/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify({ model: normalizedModel, input: normalizedInput }),
                retryCount: 3
            });

            return await this.processEmbeddingResponse(response);
        } catch (error) {
            throw this.handleEmbeddingError(error);
        }
    }

    /**
     * Processes the embedding API response.
     * @param response - The fetch response to process.
     */
    private async processEmbeddingResponse(response: Response): Promise<number[]> {
        if (!response.ok) {
            const errorText = await response.text();
            throw new ApiError(errorText, 'openai-embeddings', response.status);
        }

        const json = await response.json() as { data: Array<{ embedding: number[] }> };
        return json.data[0].embedding;
    }

    /**
     * Wraps embedding errors in appropriate error types.
     * @param error - The caught error.
     */
    private handleEmbeddingError(error: unknown): Error {
        appLogger.error('LLMEmbeddingsService', `Embedding Error: ${getErrorMessage(error as Error)}`);
        if (error instanceof ApiError) { return error; }
        return new NetworkError(
            error instanceof Error ? error.message : String(error),
            { provider: 'openai-bindings' }
        );
    }
}
