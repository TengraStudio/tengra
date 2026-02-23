import type { Language } from '@renderer/i18n';

export const SUPPORTED_PROMPT_LANGUAGES: Language[] = [
    'en',
    'tr',
    'de',
    'fr',
    'es',
    'ja',
    'zh',
    'ar',
];

export type LanguageSelectionPromptErrorCode =
    | 'LANGUAGE_PROMPT_INVALID_LANGUAGE'
    | 'LANGUAGE_PROMPT_SAVE_FAILED';

export function sanitizePromptLanguage(raw: unknown): Language | null {
    if (typeof raw !== 'string') {
        return null;
    }
    const normalized = raw.trim().toLowerCase();
    return SUPPORTED_PROMPT_LANGUAGES.find(language => language === normalized) ?? null;
}
