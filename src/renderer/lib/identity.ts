import { buildSystemPrompt, toLocalePromptMetadata } from '@shared/instructions';

import type { Language } from '@/i18n';
import { localeRegistry } from '@/i18n/locale-registry.service';

export interface BrandConfig {
    name: string
    fullName: string
    tagline: string
    description: string
}

export const TENGRA_BRAND: BrandConfig = {
    name: 'TENGRA',
    fullName: 'TENGRA AI Assistant',
    tagline: 'Intelligence in Motion',
    description: 'A high-performance, intelligent OS Assistant with deep local system integration.'
};

export function getSystemPrompt(language: Language = 'en', _personaPrompt?: string, provider?: string, model?: string) {
    const localePack = localeRegistry.getLocalePack(language);
    return buildSystemPrompt({
        language,
        localeMetadata: toLocalePromptMetadata(localePack),
        provider,
        model
    });
}


