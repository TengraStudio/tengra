import {
    validateWorkspaceMountForm,
    workspaceMountErrorCodes,
} from '@/features/projects/utils/workspace-mount-validation';
import { MountForm } from '@/types';
import { describe, expect, it } from 'vitest';

const baseSshForm: MountForm = {
    type: 'ssh',
    name: 'prod',
    rootPath: '/workspace',
    host: '10.0.0.4',
    port: '22',
    username: 'agnes',
    authType: 'password',
    password: 'secret',
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

    it('normalizes valid ssh form and exposes parsed port', () => {
        const result = validateWorkspaceMountForm(baseSshForm);

        expect(result.success).toBe(true);
        expect(result.parsedPort).toBe(22);
        expect(result.uiState).toBe('ready');
    });
});
