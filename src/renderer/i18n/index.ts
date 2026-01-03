import { tr } from './tr'
import { en } from './en'

export type Language = 'tr' | 'en'
export type TranslationKeys = typeof tr

const translations: Record<Language, TranslationKeys> = { tr, en }

export function useTranslation(lang: Language = 'tr') {
    const t = translations[lang] || translations.en

    // Simple helper to get nested keys like 'sidebar.newChat'
    const get = (path: string): string => {
        const parts = path.split('.')
        let current: any = t
        for (const part of parts) {
            if (current[part] === undefined) return path
            current = current[part]
        }
        return current
    }

    return { t: get, translations: t }
}
