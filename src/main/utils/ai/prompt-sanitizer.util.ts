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
 * Maximum allowed length for a single prompt to prevent memory issues and runaway costs.
 * 128k characters is a reasonable upper bound for most modern models.
 */
export const MAX_PROMPT_LENGTH = 128000;

/**
 * Sanitizes prompt content to remove potential HTML/JS injection vectors
 * while preserving legitimate text content.
 * 
 * @param content The raw prompt text
 * @returns Sanitized text safe for processing
 */
export function sanitizePrompt(content: string): string {
    if (!content) { return ''; }

    // For a developer tool, we must preserve code examples including HTML/JS.
    // Instead of stripping tags (which destroys code), we escape them.
    // This neutralizes execution vectors while keeping the text readable for the LLM.

    return content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Validates prompt against size limits only.
 * Safety patterns have been disabled per user request.
 */
export function validatePromptSafety(content: string): { safe: boolean; reason?: string } {
    if (!content) {
        return { safe: true };
    }

    if (content.length > MAX_PROMPT_LENGTH) {
        return { safe: false, reason: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters` };
    }

    return { safe: true };
}

