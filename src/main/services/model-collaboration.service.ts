/**
 * Model Collaboration Service
 * Enables multiple LLMs to work together on the same task
 */

import { Message } from '../../shared/types/chat'
import { LLMService } from './llm/llm.service'
// Note: multiLLMOrchestrator could be used for task management in the future

export interface CollaborationRequest {
    messages: Message[]
    models: Array<{ provider: string; model: string }>
    strategy: 'consensus' | 'vote' | 'best-of-n' | 'chain-of-thought'
    options?: {
        temperature?: number
        maxTokens?: number
    }
}

export interface CollaborationResult {
    responses: Array<{
        provider: string
        model: string
        content: string
        latency: number
        tokens?: number
    }>
    consensus?: string
    votes?: Record<string, number>
    bestResponse?: {
        provider: string
        model: string
        content: string
    }
}

/**
 * Service for coordinating multiple LLMs to work together
 */
export class ModelCollaborationService {
    constructor(private llmService: LLMService) {}

    /**
     * Run multiple models in parallel and combine results
     */
    async collaborate(request: CollaborationRequest): Promise<CollaborationResult> {
        const { messages, models, strategy, options } = request

        // Execute all models in parallel
        const promises = models.map(({ provider, model }) =>
            this.executeModel(provider, model, messages, options)
        )

        const responses = await Promise.allSettled(promises)
        
        const results = responses
            .map((result, index) => {
                if (result.status === 'fulfilled') {
                    return {
                        provider: models[index].provider,
                        model: models[index].model,
                        ...result.value
                    }
                }
                return null
            })
            .filter((r): r is NonNullable<typeof r> => r !== null)

        // Apply strategy to combine results
        const collaborationResult: CollaborationResult = {
            responses: results
        }

        switch (strategy) {
            case 'consensus':
                collaborationResult.consensus = this.buildConsensus(results)
                break
            case 'vote':
                collaborationResult.votes = this.voteOnResponses(results)
                break
            case 'best-of-n':
                collaborationResult.bestResponse = this.selectBestResponse(results)
                break
            case 'chain-of-thought':
                collaborationResult.consensus = this.chainOfThought(results, messages)
                break
        }

        return collaborationResult
    }

    /**
     * Execute a single model
     */
    private async executeModel(
        provider: string,
        model: string,
        messages: Message[],
        _options?: { temperature?: number; maxTokens?: number }
    ): Promise<{ content: string; latency: number; tokens?: number }> {
        const startTime = Date.now()
        
        try {
            const response = await this.llmService.chat(
                messages,
                model,
                undefined,
                provider
            )
            
            const latency = Date.now() - startTime
            const content = response.content || ''
            
            return {
                content,
                latency,
                tokens: response.completionTokens
            }
        } catch (error) {
            console.error(`[ModelCollaboration] Error with ${provider}/${model}:`, error)
            throw error
        }
    }

    /**
     * Build consensus from multiple responses
     */
    private buildConsensus(responses: CollaborationResult['responses']): string {
        if (responses.length === 0) return ''
        if (responses.length === 1) return responses[0].content

        // Simple consensus: find common themes and combine
        const contents = responses.map(r => r.content)
        const words = contents.flatMap(c => c.split(/\s+/))
        
        // Count word frequencies
        const wordFreq = new Map<string, number>()
        words.forEach(word => {
            const normalized = word.toLowerCase().replace(/[^\w]/g, '')
            if (normalized.length > 3) { // Ignore short words
                wordFreq.set(normalized, (wordFreq.get(normalized) || 0) + 1)
            }
        })

        // Find consensus words (appear in multiple responses)
        const consensusWords = Array.from(wordFreq.entries())
            .filter(([_, count]) => count >= Math.ceil(responses.length / 2))
            .map(([word]) => word)

        // Build consensus text
        if (consensusWords.length === 0) {
            // Fallback: return the longest response
            return responses.reduce((best, current) =>
                current.content.length > best.content.length ? current : best
            ).content
        }

        // Return response that contains most consensus words
        const scored = responses.map(r => ({
            response: r,
            score: consensusWords.filter(word =>
                r.content.toLowerCase().includes(word)
            ).length
        }))

        return scored.reduce((best, current) =>
            current.score > best.score ? current : best
        ).response.content
    }

    /**
     * Vote on responses (simple majority)
     */
    private voteOnResponses(responses: CollaborationResult['responses']): Record<string, number> {
        const votes: Record<string, number> = {}
        
        responses.forEach((r) => {
            const key = `${r.provider}/${r.model}`
            votes[key] = (votes[key] || 0) + 1
        })

        return votes
    }

    /**
     * Select best response based on quality heuristics
     */
    private selectBestResponse(
        responses: CollaborationResult['responses']
    ): CollaborationResult['bestResponse'] {
        if (responses.length === 0) return undefined

        // Score responses based on:
        // 1. Length (not too short, not too long)
        // 2. Latency (faster is better)
        // 3. Token efficiency (if available)
        
        const scored = responses.map(r => {
            const lengthScore = Math.min(r.content.length / 500, 1) // Prefer ~500 chars
            const latencyScore = Math.max(0, 1 - r.latency / 10000) // Prefer <10s
            const tokenScore = r.tokens ? Math.max(0, 1 - r.tokens / 2000) : 0.5
            
            return {
                response: r,
                score: (lengthScore * 0.4 + latencyScore * 0.3 + tokenScore * 0.3)
            }
        })

        const best = scored.reduce((best, current) =>
            current.score > best.score ? current : best
        )

        return {
            provider: best.response.provider,
            model: best.response.model,
            content: best.response.content
        }
    }

    /**
     * Chain of thought: use one model's response as context for another
     */
    private chainOfThought(
        responses: CollaborationResult['responses'],
        _originalMessages: Message[]
    ): string {
        if (responses.length === 0) return ''
        if (responses.length === 1) return responses[0].content

        // For now, return combined responses
        // In a full implementation, this would call another model with the first response as context
        return responses.map(r => r.content).join('\n\n---\n\n')
    }
}
