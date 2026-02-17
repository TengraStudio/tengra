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
 * Validates prompt against common injection patterns and size limits
 */
export function validatePromptSafety(content: string): { safe: boolean; reason?: string } {
    if (!content) {
        return { safe: true };
    }

    if (content.length > MAX_PROMPT_LENGTH) {
        return { safe: false, reason: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters` };
    }

    const DANGEROUS_PATTERNS = [
        // Basic XSS
        /<script\b[^>]*>([\s\S]*?)<\/script>/gim,
        /javascript:/gim,
        /vbscript:/gim,
        /onload=/gim,
        /onerror=/gim,

        // Prompt Injection attempts
        /ignore (previous )?instructions/gim,
        /you are now (an? )?[\w\s]{1,50}/gim,
        /\bSYSTEM:\s*/gi,
        /\bASSISTANT:\s*/gi,
        /\bHUMAN:\s*/gi,

        // Basic PII patterns
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails
        /\b(?:\d[ -]*?){13,16}\b/g, // Potential Credit Cards

        // Shell injection patterns
        /;\s*(?:rm|sudo|ls|cat|cp|mv|chmod|chown)\s+/gi,
        /\$\([\w\s-]+\)/gi,
        /`[\w\s-]+`/gi
    ];

    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(content)) {
            return { safe: false, reason: 'Potential injection or sensitive data pattern detected' };
        }
    }

    return { safe: true };
}

