import { validateCommand } from '@main/utils/command-validator.util';
import { describe, expect, it } from 'vitest';

describe('command-validator.util', () => {
    it('blocks destructive commands', () => {
        const result = validateCommand('rm -rf /tmp/test');
        expect(result.allowed).toBe(false);
    });

    it('blocks shell control operators', () => {
        const result = validateCommand('echo hello && whoami');
        expect(result.allowed).toBe(false);
    });

    it('allows safe commands', () => {
        const result = validateCommand('echo hello');
        expect(result.allowed).toBe(true);
    });
});

