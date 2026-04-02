import type { JsonValue } from '@shared/types/common';
import type { LocalePack, LocalePackManifest } from '@shared/types/locale';
import { z } from 'zod';

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema.optional()),
]));

const localeCodeSchema = z
    .string()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);

const semverLikeSchema = z
    .string()
    .min(1)
    .max(32)
    .regex(/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/);

const localePackManifestObjectSchema = z.object({
    id: z.string().min(1).max(128),
    locale: localeCodeSchema,
    displayName: z.string().min(1).max(128),
    nativeName: z.string().min(1).max(128),
    version: semverLikeSchema,
    description: z.string().min(1).max(280).optional(),
    author: z.string().min(1).max(128).optional(),
    baseLocale: localeCodeSchema.optional(),
    rtl: z.boolean().optional(),
    coverage: z.number().min(0).max(100).optional(),
    schemaVersion: semverLikeSchema.optional(),
});

export const localePackManifestSchema = localePackManifestObjectSchema satisfies z.ZodType<LocalePackManifest>;

export const localePackSchema = localePackManifestObjectSchema.extend({
    translations: z.record(z.string(), jsonValueSchema.optional()),
}) satisfies z.ZodType<LocalePack>;

export const localePackArraySchema = z.array(localePackSchema);
