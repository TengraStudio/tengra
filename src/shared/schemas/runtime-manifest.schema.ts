/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    RUNTIME_ARCH_VALUES,
    RUNTIME_ARCHIVE_FORMAT_VALUES,
    RUNTIME_COMPONENT_KIND_VALUES,
    RUNTIME_COMPONENT_REQUIREMENT_VALUES,
    RUNTIME_COMPONENT_SOURCE_VALUES,
    RUNTIME_INSTALL_SUBDIRECTORY_VALUES,
    RUNTIME_PLATFORM_VALUES,
} from '@shared/constants/runtime-manifest';
import { z } from 'zod';

function isSafeRelativePath(value: string): boolean {
    if (!value || value.startsWith('/') || value.startsWith('\\')) {
        return false;
    }

    const normalized = value.replace(/\\/g, '/');
    if (normalized.includes('../') || normalized === '..') {
        return false;
    }

    return !/^[A-Za-z]:/.test(value);
}

export const RuntimePlatformSchema = z.enum(RUNTIME_PLATFORM_VALUES);
export const RuntimeArchSchema = z.enum(RUNTIME_ARCH_VALUES);
export const RuntimeComponentSourceSchema = z.enum(RUNTIME_COMPONENT_SOURCE_VALUES);
export const RuntimeComponentRequirementSchema = z.enum(RUNTIME_COMPONENT_REQUIREMENT_VALUES);
export const RuntimeComponentKindSchema = z.enum(RUNTIME_COMPONENT_KIND_VALUES);
export const RuntimeArchiveFormatSchema = z.enum(RUNTIME_ARCHIVE_FORMAT_VALUES);
export const RuntimeInstallSubdirectorySchema = z.enum(RUNTIME_INSTALL_SUBDIRECTORY_VALUES);

export const RuntimeManifestTargetSchema = z.object({
    platform: RuntimePlatformSchema,
    arch: RuntimeArchSchema,
    assetName: z.string().trim().min(1).max(200),
    downloadUrl: z.string().url().refine(value => value.startsWith('https://'), {
        message: 'Runtime manifest downloads must use https',
    }),
    archiveFormat: RuntimeArchiveFormatSchema,
    sha256: z.string().trim().regex(/^[a-fA-F0-9]{64}$/, 'Runtime manifest checksum must be a SHA-256 hex digest'),
    executableRelativePath: z.string().trim().min(1).max(260).refine(isSafeRelativePath, {
        message: 'Runtime manifest executableRelativePath must be a safe relative path',
    }),
    installSubdirectory: RuntimeInstallSubdirectorySchema,
    sizeBytes: z.number().int().positive().optional(),
});

export const RuntimeManifestComponentSchema = z.object({
    id: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Runtime component ids must be kebab-case'),
    displayName: z.string().trim().min(1).max(120),
    version: z.string().trim().min(1).max(100),
    kind: RuntimeComponentKindSchema,
    source: RuntimeComponentSourceSchema,
    requirement: RuntimeComponentRequirementSchema,
    description: z.string().trim().max(500).optional(),
    installUrl: z.string().url().optional(),
    targets: z.array(RuntimeManifestTargetSchema).max(32),
    supportedPlatforms: z.array(RuntimePlatformSchema).max(8).optional(),
    supportedArches: z.array(RuntimeArchSchema).max(8).optional(),
}).superRefine((component, ctx) => {
    if (component.source === 'managed' && component.targets.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Managed runtime components must declare at least one target',
            path: ['targets'],
        });
    }
});

export const RuntimeManifestSchema = z.object({
    schemaVersion: z.literal(1),
    releaseTag: z.string().trim().min(1).max(100),
    generatedAt: z.string().datetime(),
    components: z.array(RuntimeManifestComponentSchema).max(128),
});

