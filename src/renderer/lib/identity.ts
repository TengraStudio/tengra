import { buildSystemPrompt, SupportedLanguage } from '@shared/instructions';

export interface BrandConfig {
    name: string
    fullName: string
    tagline: string
    description: string
}

export const TANDEM_BRAND: BrandConfig = {
    name: 'TANDEM',
    fullName: 'TANDEM AI Assistant',
    tagline: 'Intelligence in Motion',
    description: 'A high-performance, intelligent OS Assistant with deep local system integration.'
};

export function getSystemPrompt(language: 'tr' | 'en' = 'tr', _personaPrompt?: string, provider?: string, model?: string) {
    return buildSystemPrompt({
        language: language as SupportedLanguage,
        provider,
        model
    });
}

