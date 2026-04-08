/**
 * Utility for validating shell commands against safety policies.
 */

export interface ValidationResult {
    allowed: boolean;
    reason?: string;
}

const MAX_COMMAND_LENGTH = 10000;
const MAX_SEGMENTS = 96;

const BLOCKED_TOKENS = [
    'rm -rf',
    'del /f',
    'format ',
    'shutdown',
    'poweroff',
    'reboot',
    'mkfs',
    'reg delete',
    'sudo ',
    'su ',
    'chown ',
    'chmod 777'
];

const BLOCKED_SHELL_EXPANSIONS = ['`', '$('];
const SEGMENT_SEPARATORS = ['&&', '||', ';'];
const SEGMENT_SPLIT_PATTERN = /&&|\|\||;|\r?\n/u;

function hasBlockedToken(input: string): boolean {
    return BLOCKED_TOKENS.some(token => input.includes(token));
}

function hasBlockedExpansion(input: string): boolean {
    return BLOCKED_SHELL_EXPANSIONS.some(token => input.includes(token));
}

function splitCommandSegments(command: string): string[] {
    const segments = command
        .split(SEGMENT_SPLIT_PATTERN)
        .map(segment => segment.trim())
        .filter(segment => segment.length > 0);
    return segments;
}

function hasMalformedSegment(segment: string): boolean {
    if (segment.length === 0) {
        return true;
    }
    if (segment === '|' || segment === '<' || segment === '>' || segment === '>>') {
        return true;
    }
    return false;
}

function validateSegment(segment: string): ValidationResult {
    const lower = segment.toLowerCase();
    if (hasBlockedToken(lower)) {
        return {
            allowed: false,
            reason: 'Command contains blocked operation (e.g., privilege escalation or destructive command)'
        };
    }
    if (hasBlockedExpansion(segment)) {
        return {
            allowed: false,
            reason: 'Command contains blocked shell expansion'
        };
    }
    if (segment.includes('\0')) {
        return {
            allowed: false,
            reason: 'Command contains invalid null control character'
        };
    }
    return { allowed: true };
}

/**
 * Validates a shell command string for safety.
 * @param command The command string to validate.
 * @returns A ValidationResult indicating whether the command is allowed.
 */
export function validateCommand(command: string): ValidationResult {
    if (!command || command.length > MAX_COMMAND_LENGTH) {
        return { allowed: false, reason: 'Command is empty or too long' };
    }

    const trimmed = command.trim();
    if (trimmed.length === 0) {
        return { allowed: false, reason: 'Command is empty or too long' };
    }
    if (hasBlockedExpansion(trimmed)) {
        return { allowed: false, reason: 'Command contains blocked shell expansion' };
    }

    const segments = splitCommandSegments(trimmed);
    if (segments.length === 0) {
        return { allowed: false, reason: 'Command is empty or too long' };
    }
    if (segments.length > MAX_SEGMENTS) {
        return { allowed: false, reason: 'Command contains too many chained segments' };
    }

    for (const segment of segments) {
        if (hasMalformedSegment(segment)) {
            return { allowed: false, reason: 'Command contains malformed segment' };
        }
        const segmentResult = validateSegment(segment);
        if (!segmentResult.allowed) {
            return segmentResult;
        }
    }

    for (const separator of SEGMENT_SEPARATORS) {
        if (trimmed.endsWith(separator)) {
            return { allowed: false, reason: 'Command ends with invalid separator' };
        }
    }

    return { allowed: true };
}
