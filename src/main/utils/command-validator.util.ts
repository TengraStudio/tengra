/**
 * Utility for validating shell commands against safety policies.
 */

export interface ValidationResult {
    allowed: boolean;
    reason?: string;
}

const MAX_COMMAND_LENGTH = 10000;

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

const DANGEROUS_OPERATORS = [';', '&&', '||', '>', '>>', '<', '|', '`', '$(' ];

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
    const lower = trimmed.toLowerCase();

    if (BLOCKED_TOKENS.some(token => lower.includes(token))) {
        return { allowed: false, reason: 'Command contains blocked operation (e.g., privilege escalation or destructive command)' };
    }

    if (DANGEROUS_OPERATORS.some(op => trimmed.includes(op))) {
        return { allowed: false, reason: 'Command contains shell control operators which are not allowed' };
    }

    return { allowed: true };
}
