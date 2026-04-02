import { JsonValue } from '@shared/types/common';
import { LocalePack } from '@shared/types/locale';
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
