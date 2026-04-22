/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it } from 'vitest';

import {
    parseSSHProfile,
    sshManagerErrorCodes,
    validateSSHConnectionForm,
} from '@/features/ssh/utils/ssh-manager-validation';

describe('ssh-manager-validation', () => {
    it('normalizes a valid password-based connection form', () => {
        const result = validateSSHConnectionForm({
            host: ' 127.0.0.1 ',
            port: 22,
            username: ' mockuser ',
            password: ' mock-secret ',
            privateKey: '',
            name: '  production ',
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.normalized.host).toBe('127.0.0.1');
            expect(result.normalized.username).toBe('mockuser');
            expect(result.normalized.password).toBe('mock-secret');
            expect(result.normalized.name).toBe('production');
        }
    });

    it('fails validation when both password and key are missing', () => {
        const result = validateSSHConnectionForm({
            host: '127.0.0.1',
            port: 22,
            username: 'mockuser',
            password: '',
            privateKey: '',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.errorCode).toBe(sshManagerErrorCodes.validation);
        }
    });

    it('rejects malformed ssh profile payload', () => {
        const parsed = parseSSHProfile({
            id: '',
            host: '',
            port: 99999,
            username: '',
        });

        expect(parsed.success).toBe(false);
    });

    it('parses valid profile and applies defaults', () => {
        const parsed = parseSSHProfile({
            id: 'profile-1',
            host: 'server.internal',
            port: 22,
            username: 'root',
            privateKey: 'KEY',
        });

        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.profile.name).toBe('server.internal');
            expect(parsed.profile.authType).toBe('key');
            expect(parsed.profile.status).toBe('disconnected');
        }
    });
});
