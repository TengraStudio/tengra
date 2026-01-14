import { tr } from '@renderer/i18n/tr'
import { en } from '@renderer/i18n/en'
import { JsonValue } from '@shared/types/common'

export type Language = 'tr' | 'en'
export type TranslationKeys = typeof tr

const translations: Record<Language, TranslationKeys> = { tr, en }

/**
 * Hook for using translations in components.
 */
export function useTranslation(lang: Language = 'tr') {
    const t = translations[lang] || translations.en

    /**
     * Simple helper to get nested keys like 'sidebar.newChat' and support interpolation {{key}}
     */
    const get = (path: string, options?: Record<string, string | number>): string => {
        const parts = path.split('.')
        let current: JsonValue = t

        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = (current as Record<string, JsonValue>)[part]
            } else {
                return path
            }
        }

        if (typeof current === 'string') {
            if (options) {
                return Object.keys(options).reduce((acc, key) => {
                    return acc.replace(new RegExp(`{{${key}}}`, 'g'), String(options[key]))
                }, current)
            }
            return current
        }

        return path
    }

    return { t: get, translations: t }
}
