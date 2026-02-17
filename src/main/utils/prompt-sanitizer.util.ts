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
 * Validates prompt against common injection patterns
 */
export function validatePromptSafety(content: string): { safe: boolean; reason?: string } {
    const DANGEROUS_PATTERNS = [
        /<script\b[^>]*>([\s\S]*?)<\/script>/gim,
        /javascript:/gim,
        /vbscript:/gim,
        /onload=/gim,
        /onerror=/gim
    ];

    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(content)) {
            return { safe: false, reason: 'Potential XSS/Injection pattern detected' };
        }
    }

    return { safe: true };
}
