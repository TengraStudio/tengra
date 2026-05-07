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
    validateWorkspaceMountForm,
    workspaceMountErrorCodes,
} from '@/features/workspace/utils/workspace-mount-validation';
import { MountForm } from '@/types';

const baseSshForm: MountForm = {
    type: 'ssh',
    name: 'prod',
    rootPath: '/workspace',
    host: '127.0.0.1',
    port: '22',
    username: 'mockuser',
    authType: 'password',
    password: 'mock-secret',
    privateKey: '',
    passphrase: '',
    saveProfile: false,
};

describe('workspace mount validation', () => {
    it('fails for local mount without root path', () => {
        const result = validateWorkspaceMountForm({
            ...baseSshForm,
            type: 'local',
            rootPath: '',
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(workspaceMountErrorCodes.validation);
    });

    it('fails for ssh mount with invalid port', () => {
        const result = validateWorkspaceMountForm({
            ...baseSshForm,
            port: '70000',
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(workspaceMountErrorCodes.validation);
    });

    it('fails for ssh mount with invalid host value', () => {
        const result = validateWorkspaceMountForm({
            ...baseSshForm,
            host: 'invalid host/name',
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(workspaceMountErrorCodes.validation);
    });

    it('fails for key auth without private key', () => {
        const result = validateWorkspaceMountForm({
            ...baseSshForm,
            authType: 'key',
            privateKey: '',
            password: '',
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(workspaceMountErrorCodes.validation);
    });

    it('fails for key auth with non-absolute private key path', () => {
        const result = validateWorkspaceMountForm({
            ...baseSshForm,
            authType: 'key',
            password: '',
            privateKey: 'id_rsa',
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(workspaceMountErrorCodes.validation);
    });

    it('accepts key auth with inline private key content', () => {
        const result = validateWorkspaceMountForm({
            ...baseSshForm,
            authType: 'key',
            password: '',
            privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----test-----END OPENSSH PRIVATE KEY-----',
        });

        expect(result.success).toBe(true);
        expect(result.parsedPort).toBe(22);
    });

    it('normalizes valid ssh form and exposes parsed port', () => {
        const result = validateWorkspaceMountForm(baseSshForm);

        expect(result.success).toBe(true);
        expect(result.parsedPort).toBe(22);
        expect(result.uiState).toBe('ready');
    });
});

