/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { SSHConnection } from '@shared/types/ssh';
import { z } from 'zod';

const nonEmptyTextSchema = z.string().trim().min(1);
const profilePortSchema = z.number().int().min(1).max(65535);

const sshConnectionFormSchema = z.object({
    host: nonEmptyTextSchema.max(255),
    port: profilePortSchema,
    username: nonEmptyTextSchema.max(128),
    password: z.string().optional(),
    privateKey: z.string().optional(),
    name: z.string().trim().max(128).optional(),
    jumpHost: z.string().trim().max(512).optional(),
});

const sshProfileSchema = z.object({
    id: nonEmptyTextSchema.max(128),
    host: nonEmptyTextSchema.max(255),
    port: profilePortSchema,
    username: nonEmptyTextSchema.max(128),
    name: z.string().trim().max(128).optional(),
    password: z.string().optional(),
    privateKey: z.string().optional(),
    jumpHost: z.string().trim().max(512).optional(),
    error: z.string().optional(),
    status: z.enum(['connected', 'disconnected', 'connecting', 'error']).optional(),
});

export const sshManagerErrorCodes = {
    validation: 'SSH_MANAGER_VALIDATION_ERROR',
    loadFailed: 'SSH_MANAGER_LOAD_FAILED',
    connectFailed: 'SSH_MANAGER_CONNECT_FAILED',
    testFailed: 'SSH_MANAGER_TEST_FAILED',
    saveProfileFailed: 'SSH_MANAGER_SAVE_PROFILE_FAILED',
    deleteProfileFailed: 'SSH_MANAGER_DELETE_PROFILE_FAILED',
} as const;

export interface SSHConnectionFormInput {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
    name?: string;
    jumpHost?: string;
}

export interface SSHManagerValidationFailure {
    success: false;
    errorCode: string;
    messageKey: string;
    uiState: 'failure';
}

export interface SSHManagerValidationSuccess {
    success: true;
    normalized: SSHConnectionFormInput;
    uiState: 'ready';
}

export type SSHManagerValidationResult =
    | SSHManagerValidationSuccess
    | SSHManagerValidationFailure;

export type ParsedSSHProfileResult =
    | { success: true; profile: SSHConnection }
    | { success: false; errorCode: string };

function toValidationFailure(errorCode: string): SSHManagerValidationFailure {
    return {
        success: false,
        errorCode,
        messageKey: 'errors.unexpected',
        uiState: 'failure',
    };
}

function hasAuthMethod(value: SSHConnectionFormInput): boolean {
    const hasPassword = (value.password ?? '').trim().length > 0;
    const hasKey = (value.privateKey ?? '').trim().length > 0;
    return hasPassword || hasKey;
}

/**
 * Validates and normalizes SSH connection form values.
 */
export function validateSSHConnectionForm(
    input: SSHConnectionFormInput
): SSHManagerValidationResult {
    const parsed = sshConnectionFormSchema.safeParse(input);
    if (!parsed.success) {
        return toValidationFailure(sshManagerErrorCodes.validation);
    }

    const normalized: SSHConnectionFormInput = {
        host: parsed.data.host.trim(),
        port: parsed.data.port,
        username: parsed.data.username.trim(),
        password: parsed.data.password?.trim() || undefined,
        privateKey: parsed.data.privateKey?.trim() || undefined,
        name: parsed.data.name?.trim() || undefined,
        jumpHost: parsed.data.jumpHost?.trim() || undefined,
    };

    if (!hasAuthMethod(normalized)) {
        return toValidationFailure(sshManagerErrorCodes.validation);
    }

    return {
        success: true,
        normalized,
        uiState: 'ready',
    };
}

/**
 * Parses a raw SSH profile payload into a strict renderer-safe shape.
 */
export function parseSSHProfile(raw: RendererDataValue): ParsedSSHProfileResult {
    const parsed = sshProfileSchema.safeParse(raw);
    if (!parsed.success) {
        return { success: false, errorCode: sshManagerErrorCodes.validation };
    }

    const profile: SSHConnection = {
        id: parsed.data.id,
        host: parsed.data.host,
        port: parsed.data.port,
        username: parsed.data.username,
        name: parsed.data.name?.trim() || parsed.data.host,
        authType: parsed.data.privateKey ? 'key' : 'password',
        status: parsed.data.status ?? 'disconnected',
    };

    if (parsed.data.password) {
        profile.password = parsed.data.password;
    }
    if (parsed.data.privateKey) {
        profile.privateKey = parsed.data.privateKey;
    }
    if (parsed.data.jumpHost) {
        profile.jumpHost = parsed.data.jumpHost;
    }
    if (parsed.data.error) {
        profile.error = parsed.data.error;
    }

    return { success: true, profile };
}
