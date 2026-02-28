/**
 * SEC-031: Configurable content filtering for LLM output.
 * Patterns are organized by category and can be extended at runtime.
 */
import { appLogger } from '@main/logging/logger';

/** Category of a content filter pattern */
export type FilterCategory =
    | 'script-injection'
    | 'private-key'
    | 'pii'
    | 'api-secret'
    | 'prompt-injection'
    | 'system-extraction';

/** A single content filter rule */
export interface ContentFilterPattern {
    /** Human-readable label for logging */
    readonly label: string;
    /** Category for grouping */
    readonly category: FilterCategory;
    /** Literal string match (checked via includes) */
    readonly literal?: string;
    /** Regex match (applied to truncated content) */
    readonly regex?: RegExp;
}

/** Result of content filtering */
export interface ContentFilterResult {
    /** Whether the content was blocked */
    readonly blocked: boolean;
    /** Original or replacement content */
    readonly content: string;
    /** Labels of all patterns that matched */
    readonly matchedPatterns: readonly string[];
}

const BLOCKED_MESSAGE = '[CONTENT BLOCKED BY SECURITY POLICY]';
const MAX_REGEX_CHECK_LENGTH = 50_000;

/** Script injection patterns */
function getScriptInjectionPatterns(): ContentFilterPattern[] {
    return [
        { label: 'script-tag', category: 'script-injection', literal: '<script>' },
        { label: 'script-tag-close', category: 'script-injection', literal: '</script>' },
        { label: 'javascript-uri', category: 'script-injection', literal: 'javascript:' },
        { label: 'vbscript-uri', category: 'script-injection', literal: 'vbscript:' },
        { label: 'event-handler-onerror', category: 'script-injection', regex: /\bon\s*error\s*=/i },
        { label: 'event-handler-onload', category: 'script-injection', regex: /\bon\s*load\s*=/i },
        { label: 'event-handler-onclick', category: 'script-injection', regex: /\bon\s*click\s*=/i },
        { label: 'event-handler-onmouseover', category: 'script-injection', regex: /\bon\s*mouseover\s*=/i },
        { label: 'data-uri-script', category: 'script-injection', regex: /data:\s*text\/html/i },
    ];
}

/** Private key patterns */
function getPrivateKeyPatterns(): ContentFilterPattern[] {
    return [
        { label: 'rsa-private-key', category: 'private-key', literal: '-----BEGIN RSA PRIVATE KEY-----' },
        { label: 'openssh-private-key', category: 'private-key', literal: '-----BEGIN OPENSSH PRIVATE KEY-----' },
        { label: 'pgp-private-key', category: 'private-key', literal: '-----BEGIN PGP PRIVATE KEY BLOCK-----' },
        { label: 'ec-private-key', category: 'private-key', literal: '-----BEGIN EC PRIVATE KEY-----' },
        { label: 'dsa-private-key', category: 'private-key', literal: '-----BEGIN DSA PRIVATE KEY-----' },
        { label: 'generic-private-key', category: 'private-key', literal: '-----BEGIN PRIVATE KEY-----' },
    ];
}

/** PII patterns (regex-based) */
function getPiiPatterns(): ContentFilterPattern[] {
    return [
        { label: 'email-address', category: 'pii', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i },
        { label: 'ssn', category: 'pii', regex: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/ },
        { label: 'credit-card', category: 'pii', regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/ },
        { label: 'bulk-email-list', category: 'pii', regex: /(?:[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\s*[,;\n]\s*){3,}/i },
    ];
}

/** API secret / token patterns */
function getApiSecretPatterns(): ContentFilterPattern[] {
    return [
        { label: 'api-secret-key', category: 'api-secret', regex: /\b(?:sk|pk)[-_](?:live|test|prod)[-_][A-Za-z0-9]{20,}\b/ },
        { label: 'aws-access-key', category: 'api-secret', regex: /\bAKIA[0-9A-Z]{16}\b/ },
        { label: 'github-pat', category: 'api-secret', regex: /\bghp_[A-Za-z0-9]{36}\b/ },
        { label: 'github-oauth', category: 'api-secret', regex: /\bgho_[A-Za-z0-9]{36}\b/ },
        { label: 'github-app-token', category: 'api-secret', regex: /\bghs_[A-Za-z0-9]{36}\b/ },
        { label: 'gitlab-pat', category: 'api-secret', regex: /\bglpat-[A-Za-z0-9\-_]{20,}\b/ },
        { label: 'slack-token', category: 'api-secret', regex: /\bxox[bpras]-[A-Za-z0-9\-]{10,}\b/ },
    ];
}

/** Prompt injection / jailbreak patterns */
function getPromptInjectionPatterns(): ContentFilterPattern[] {
    return [
        { label: 'ignore-previous', category: 'prompt-injection', regex: /ignore\s+(?:all\s+)?previous\s+instructions/i },
        { label: 'disregard-instructions', category: 'prompt-injection', regex: /disregard\s+(?:all\s+)?(?:previous\s+)?instructions/i },
        { label: 'dan-mode', category: 'prompt-injection', regex: /\bDAN\s+mode\b/i },
        { label: 'jailbreak-keyword', category: 'prompt-injection', regex: /\bjailbreak(?:ed)?\b/i },
        { label: 'developer-mode-override', category: 'prompt-injection', regex: /(?:enter|enable|activate)\s+developer\s+mode/i },
        { label: 'pretend-no-restrictions', category: 'prompt-injection', regex: /pretend\s+(?:you\s+)?(?:have\s+)?no\s+restrictions/i },
    ];
}

/** System prompt extraction attempts */
function getSystemExtractionPatterns(): ContentFilterPattern[] {
    return [
        { label: 'repeat-instructions', category: 'system-extraction', regex: /repeat\s+your\s+(?:system\s+)?instructions/i },
        { label: 'what-are-your-rules', category: 'system-extraction', regex: /what\s+are\s+your\s+(?:system\s+)?rules/i },
        { label: 'show-system-prompt', category: 'system-extraction', regex: /(?:show|print|output|display)\s+(?:your\s+)?system\s+prompt/i },
        { label: 'reveal-instructions', category: 'system-extraction', regex: /(?:reveal|leak|expose)\s+(?:your\s+)?(?:initial\s+)?instructions/i },
    ];
}

/** Returns the full default set of content filter patterns */
export function getDefaultFilterPatterns(): ContentFilterPattern[] {
    return [
        ...getScriptInjectionPatterns(),
        ...getPrivateKeyPatterns(),
        ...getPiiPatterns(),
        ...getApiSecretPatterns(),
        ...getPromptInjectionPatterns(),
        ...getSystemExtractionPatterns(),
    ];
}

/**
 * Checks content against a single pattern.
 * Returns true if the pattern matches.
 */
function matchesPattern(content: string, truncated: string, pattern: ContentFilterPattern): boolean {
    if (pattern.literal && content.includes(pattern.literal)) {
        return true;
    }
    if (pattern.regex && pattern.regex.test(truncated)) {
        return true;
    }
    return false;
}

/**
 * Filters content against a set of patterns.
 * Returns a result indicating whether content was blocked and which patterns matched.
 */
export function filterContent(
    content: string,
    patterns: readonly ContentFilterPattern[] = getDefaultFilterPatterns()
): ContentFilterResult {
    const truncated = content.length > MAX_REGEX_CHECK_LENGTH
        ? content.slice(0, MAX_REGEX_CHECK_LENGTH)
        : content;

    const matchedPatterns: string[] = [];

    for (const pattern of patterns) {
        if (matchesPattern(content, truncated, pattern)) {
            matchedPatterns.push(pattern.label);
        }
    }

    if (matchedPatterns.length > 0) {
        appLogger.warn(
            'ContentFilter',
            `Blocked content matching ${matchedPatterns.length} pattern(s): ${matchedPatterns.join(', ')}`
        );
        return { blocked: true, content: BLOCKED_MESSAGE, matchedPatterns };
    }

    return { blocked: false, content, matchedPatterns: [] };
}
