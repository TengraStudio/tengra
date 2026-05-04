/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { JsonValue } from '@shared/types/common';
import { LocalePack } from '@shared/types/system/locale';
import { z } from 'zod';

import { invokeTypedIpc, type IpcContractMap } from '@/lib/ipc-client';

type LocaleIpcContract = IpcContractMap & {
    'locale:runtime:getAll': {
        args: [];
        response: LocalePack[];
    };
};

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(jsonValueSchema),
        z.record(z.string(), jsonValueSchema),
    ])
);

const localePackSchema: z.ZodType<LocalePack> = z.object({
    id: z.string(),
    locale: z.string(),
    displayName: z.string(),
    nativeName: z.string(),
    version: z.string(),
    description: z.string().optional(),
    author: z.string().optional(),
    baseLocale: z.string().optional(),
    rtl: z.boolean().optional(),
    coverage: z.number().optional(),
    schemaVersion: z.string().optional(),
    translations: jsonValueSchema,
});

const localePackListSchema = z.array(localePackSchema);

export const localeIpc = {
    async getAllLocalePacks(): Promise<LocalePack[]> {
        return invokeTypedIpc<LocaleIpcContract, 'locale:runtime:getAll'>('locale:runtime:getAll', [], {
            responseSchema: localePackListSchema,
        });
    },
};
