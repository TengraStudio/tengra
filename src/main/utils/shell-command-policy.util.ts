/**
 * AUD-2026-02-27-03: Shell command argument validation policy layer.
 * Validates per-executable arguments to prevent path traversal, injection, and abuse.
 */

export interface PolicyResult {
    allowed: boolean;
    reason?: string;
}

/** Maximum number of `..` segments allowed in a single argument */
const MAX_PARENT_TRAVERSALS = 0;

/**
 * Shell metacharacters that should never appear in arguments when shell is disabled.
 * Even with shell: false, some programs may interpret these.
 */
const SHELL_INJECTION_PATTERN = /[`|;<>&${}!\r\n\0]/;

/**
 * Subshell / command-substitution patterns (POSIX and Windows).
 */
const SUBSHELL_PATTERNS = [
    /\$\(/,       // $(...)
    /\$\{/,       // ${...}
    /`[^`]*`/,    // backtick substitution
];

/**
 * Git flags that can execute arbitrary commands.
 */
const GIT_DANGEROUS_FLAGS = new Set([
    '--exec',
    '--upload-pack',
    '--receive-pack',
    '-c',
]);

/**
 * Git flag prefixes that can execute arbitrary commands when used with = (e.g., --exec-path=...).
 */
const GIT_DANGEROUS_FLAG_PREFIXES = [
    '--exec-path=',
    '--upload-pack=',
    '--receive-pack=',
];

/**
 * Git subcommands that can be abused for remote code execution.
 */
const GIT_DANGEROUS_SUBCOMMANDS = new Set([
    'remote-http',
    'remote-https',
    'remote-ftp',
    'credential-store',
]);

/**
 * Executables that accept inline code evaluation.
 * Maps executable -> set of dangerous flags.
 */
const EVAL_FLAGS: Record<string, Set<string>> = {
    node: new Set(['-e', '--eval', '-p', '--print', '--input-type']),
    python: new Set(['-c', '-m']),
    python3: new Set(['-c', '-m']),
    pip: new Set(['install', '--index-url', '--extra-index-url', '-i']),
    pip3: new Set(['install', '--index-url', '--extra-index-url', '-i']),
};

/**
 * Checks a single argument for shell injection characters.
 */
function containsShellInjection(arg: string): boolean {
    if (SHELL_INJECTION_PATTERN.test(arg)) {
        return true;
    }
    for (const pattern of SUBSHELL_PATTERNS) {
        if (pattern.test(arg)) {
            return true;
        }
    }
    return false;
}

/**
 * Detects path traversal attempts in an argument.
 * Rejects any argument containing `..` path segments.
 */
function containsPathTraversal(arg: string): boolean {
    const normalized = arg.replace(/\\/g, '/');
    const segments = normalized.split('/');
    let parentCount = 0;
    for (const segment of segments) {
        if (segment === '..') {
            parentCount++;
        }
    }
    return parentCount > MAX_PARENT_TRAVERSALS;
}

/**
 * Validates arguments for the `git` executable.
 */
function validateGitArgs(args: string[]): PolicyResult {
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const lower = arg.toLowerCase();

        if (GIT_DANGEROUS_FLAGS.has(lower)) {
            return { allowed: false, reason: `Blocked git flag: ${arg}` };
        }

        // Block --flag=value forms for dangerous prefixes
        for (const prefix of GIT_DANGEROUS_FLAG_PREFIXES) {
            if (lower.startsWith(prefix)) {
                return { allowed: false, reason: `Blocked git flag: ${arg}` };
            }
        }

        // Block git config that can execute commands (e.g., -c core.pager=<cmd>)
        if (lower.startsWith('-c') && lower.length > 2) {
            return { allowed: false, reason: `Blocked git inline config: ${arg}` };
        }

        // First positional arg (subcommand) check
        if (i === 0 && !arg.startsWith('-')) {
            if (GIT_DANGEROUS_SUBCOMMANDS.has(lower)) {
                return { allowed: false, reason: `Blocked git subcommand: ${arg}` };
            }
        }
    }
    return { allowed: true };
}

/**
 * Validates arguments for executables that support inline code evaluation.
 */
function validateEvalArgs(executable: string, args: string[]): PolicyResult {
    const dangerousFlags = EVAL_FLAGS[executable];
    if (!dangerousFlags) {
        return { allowed: true };
    }

    for (const arg of args) {
        if (dangerousFlags.has(arg.toLowerCase())) {
            return { allowed: false, reason: `Blocked eval/exec flag for ${executable}: ${arg}` };
        }
    }
    return { allowed: true };
}

/**
 * Validates command arguments against the security policy.
 * Checks for shell injection, path traversal, and per-executable dangerous flags.
 *
 * @param executable - Normalized executable name (e.g., 'git', 'node')
 * @param args - Array of arguments to validate
 * @returns PolicyResult indicating if the arguments are allowed
 */
export function validateCommandArgs(executable: string, args: string[]): PolicyResult {
    // Universal checks across all executables
    for (const arg of args) {
        if (containsShellInjection(arg)) {
            return { allowed: false, reason: `Argument contains shell injection characters: ${arg.slice(0, 64)}` };
        }
        if (containsPathTraversal(arg)) {
            return { allowed: false, reason: `Argument contains path traversal: ${arg.slice(0, 64)}` };
        }
    }

    // Per-executable policy
    const execLower = executable.toLowerCase();

    if (execLower === 'git') {
        return validateGitArgs(args);
    }

    if (execLower in EVAL_FLAGS) {
        return validateEvalArgs(execLower, args);
    }

    return { allowed: true };
}
