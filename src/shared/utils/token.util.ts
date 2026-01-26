/**
 * Estimates the number of tokens in a text string.
 * This is a rough estimation used as a fallback when the provider
 * does not return exact usage stats.
 * 
 * Heuristic: ~4 characters per token for English text.
 */
export function estimateTokens(text: string): number {
    if (!text) {return 0;}
    return Math.ceil(text.length / 4);
}
