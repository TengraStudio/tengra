/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
