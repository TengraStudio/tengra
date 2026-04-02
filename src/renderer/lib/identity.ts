import { buildSystemPrompt } from '@shared/instructions';

import type { Language } from '@/i18n';

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
    return buildSystemPrompt({
        language,
        provider,
        model
    });
}


