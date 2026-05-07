/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { validateCommand } from '@main/utils/command-validator.util';
import { describe, expect, it } from 'vitest';

describe('command-validator.util', () => {
    it('blocks destructive commands', () => {
        const result = validateCommand('rm -rf /tmp/test');
        expect(result.allowed).toBe(false);
    });

    it('allows basic command chaining', () => {
        const result = validateCommand('echo hello && whoami');
        expect(result.allowed).toBe(true);
    });

    it('allows bounded multi-line PowerShell scripts', () => {
        const result = validateCommand('$path = "$env:USERPROFILE\\Desktop"\nif (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path }');
        expect(result.allowed).toBe(true);
    });

    it('allows safe commands', () => {
        const result = validateCommand('echo hello');
        expect(result.allowed).toBe(true);
    });

    it('blocks shell expansion operators', () => {
        const result = validateCommand('echo $(whoami)');
        expect(result.allowed).toBe(false);
    });

    it('blocks commands ending with separator', () => {
        const result = validateCommand('git status &&');
        expect(result.allowed).toBe(false);
    });
});

