import { z } from 'zod';

import { MountForm } from '@/types';

const nonEmptyStringSchema = z.string().trim().min(1);
const absolutePathSchema = z.string().regex(/^(?:[a-zA-Z]:[\\/]|\/|\\\\)/);
const portSchema = z
    .string()
    .trim()
    .regex(/^\d+$/)
    .transform(value => Number(value))
    .refine(value => value >= 1 && value <= 65535);

export const workspaceMountErrorCodes = {
    validation: 'WORKSPACE_MOUNT_VALIDATION_ERROR',
    persistFailed: 'WORKSPACE_MOUNT_PERSIST_FAILED',
    profileSaveFailed: 'WORKSPACE_MOUNT_PROFILE_SAVE_FAILED',
    testFailed: 'WORKSPACE_MOUNT_TEST_FAILED',
} as const;

export interface WorkspaceMountValidationResult {
    success: boolean;
    parsedPort: number;
    errorCode?: string;
    messageKey?: string;
    uiState: 'ready' | 'failure';
}

function failureResult(errorCode: string): WorkspaceMountValidationResult {
    return {
        success: false,
        parsedPort: 22,
        errorCode,
        messageKey: 'errors.unexpected',
        uiState: 'failure',
    };
}

function isValidHostValue(host: string): boolean {
    const trimmedHost = host.trim();
    if (trimmedHost.length === 0) {
        return false;
    }
    if (trimmedHost.includes(' ') || trimmedHost.includes('/')) {
        return false;
    }
    return true;
}

function isInlinePrivateKey(privateKey: string): boolean {
    return privateKey.includes('BEGIN') && privateKey.includes('PRIVATE KEY');
}

/**
 * Validates workspace mount form fields and normalizes SSH port value.
 */
export function validateWorkspaceMountForm(form: MountForm): WorkspaceMountValidationResult {
    if (form.type === 'local') {
        if (!nonEmptyStringSchema.safeParse(form.rootPath).success) {
            return failureResult(workspaceMountErrorCodes.validation);
        }
        return {
            success: true,
            parsedPort: 22,
            uiState: 'ready',
        };
    }

    if (!isValidHostValue(form.host)) {
        return failureResult(workspaceMountErrorCodes.validation);
    }
    if (!nonEmptyStringSchema.safeParse(form.username).success) {
        return failureResult(workspaceMountErrorCodes.validation);
    }

    const normalizedPort = form.port.trim() === '' ? '22' : form.port;
    const portParse = portSchema.safeParse(normalizedPort);
    if (!portParse.success) {
        return failureResult(workspaceMountErrorCodes.validation);
    }

    if (form.authType === 'password') {
        if (!nonEmptyStringSchema.safeParse(form.password).success) {
            return failureResult(workspaceMountErrorCodes.validation);
        }
    } else {
        if (!nonEmptyStringSchema.safeParse(form.privateKey).success) {
            return failureResult(workspaceMountErrorCodes.validation);
        }
        if (!isInlinePrivateKey(form.privateKey) && !absolutePathSchema.safeParse(form.privateKey).success) {
            return failureResult(workspaceMountErrorCodes.validation);
        }
    }

    return {
        success: true,
        parsedPort: portParse.data,
        uiState: 'ready',
    };
}
