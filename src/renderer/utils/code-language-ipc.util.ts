/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { MarketplaceCodeLanguagePack } from '@shared/types/marketplace';
import { z } from 'zod';

import { invokeTypedIpc, type IpcContractMap } from '@/lib/ipc-client';

type CodeLanguageIpcContract = IpcContractMap & {
    'code-language:runtime:getAll': {
        args: [];
        response: MarketplaceCodeLanguagePack[];
    };
};

const codeLanguagePackSchema: z.ZodType<MarketplaceCodeLanguagePack> = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    author: z.string(),
    version: z.string(),
    downloadUrl: z.string().url(),
    previewUrl: z.string().url().optional(),
    itemType: z.literal('code-language-pack'),
    installed: z.boolean().optional(),
    installedVersion: z.string().optional(),
    updateAvailable: z.boolean().optional(),
    removable: z.boolean().optional(),
    category: z.string().optional(),
    languages: z.array(z.object({
        id: z.string(),
        displayName: z.string(),
        aliases: z.array(z.string()).optional(),
        extensions: z.array(z.string()).optional(),
        filenames: z.array(z.string()).optional(),
        monacoLanguage: z.string().optional(),
        textMateScope: z.string().optional(),
        configuration: z.record(z.string(), z.unknown()).optional(),
        monarch: z.record(z.string(), z.unknown()).optional(),
    })).min(1),
});

const codeLanguagePackListSchema = z.array(codeLanguagePackSchema);

export const codeLanguageIpc = {
    async getAllCodeLanguagePacks(): Promise<MarketplaceCodeLanguagePack[]> {
        return invokeTypedIpc<CodeLanguageIpcContract, 'code-language:runtime:getAll'>(
            'code-language:runtime:getAll',
            [],
            { responseSchema: codeLanguagePackListSchema }
        );
    },
};
