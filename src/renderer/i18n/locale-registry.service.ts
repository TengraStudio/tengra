import { enLocalePack } from '@renderer/i18n/locales';
import { JsonValue } from '@shared/types/common';
import type { LocalePack, LocalePackManifest } from '@shared/types/locale';

import { localeIpc } from '@/utils/locale-ipc.util';
import { appLogger } from '@/utils/renderer-logger';

export interface AvailableLocale extends LocalePackManifest {
    builtIn: boolean;
}

type LocaleRegistryListener = () => void;

const BUILT_IN_LOCALES: LocalePack[] = [enLocalePack];

export class LocaleRegistryService {
    private readonly builtIns = new Map<string, LocalePack>();
    private readonly runtimeLocales = new Map<string, LocalePack>();
    private readonly listeners = new Set<LocaleRegistryListener>();
    private isLoaded = false;

    constructor() {
        for (const locale of BUILT_IN_LOCALES) {
            this.builtIns.set(locale.locale, locale);
        }

        if (window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.on('locale:runtime:updated', () => {
                void this.reloadLocales();
            });
        }
    }

    async loadLocales(): Promise<void> {
        try {
            const runtimeLocales = await localeIpc.getAllLocalePacks();
            this.runtimeLocales.clear();
            for (const locale of runtimeLocales) {
                this.runtimeLocales.set(locale.locale, locale);
            }
            this.isLoaded = true;
            this.emit();
        } catch (error) {
            appLogger.error('LocaleRegistry', 'Failed to load locale packs', error as Error);
            this.runtimeLocales.clear();
            this.isLoaded = true;
            this.emit();
        }
    }

    async reloadLocales(): Promise<void> {
        this.isLoaded = false;
        await this.loadLocales();
    }

    subscribe(listener: LocaleRegistryListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    isLocalesLoaded(): boolean {
        return this.isLoaded;
    }

    getLocalePack(locale: string): LocalePack | undefined {
        return this.runtimeLocales.get(locale) ?? this.builtIns.get(locale);
    }

    getTranslations(locale: string): JsonValue | null {
        return this.getLocalePack(locale)?.translations ?? null;
    }

    hasLocale(locale: string): boolean {
        return this.getLocalePack(locale) !== undefined;
    }

    resolveLocale(locale: string | null | undefined): string {
        const normalized = typeof locale === 'string' ? locale.trim() : '';
        if (normalized === '') {
            return 'en';
        }

        if (this.hasLocale(normalized)) {
            return normalized;
        }

        const caseInsensitiveMatch = this.getAvailableLocales().find(
            candidate => candidate.locale.toLowerCase() === normalized.toLowerCase()
        );
        if (caseInsensitiveMatch) {
            return caseInsensitiveMatch.locale;
        }

        const baseLocale = normalized.split('-')[0]?.toLowerCase() ?? '';
        if (baseLocale !== '' && this.hasLocale(baseLocale)) {
            return baseLocale;
        }

        return 'en';
    }

    isLocaleRtl(locale: string): boolean {
        return this.getLocalePack(this.resolveLocale(locale))?.rtl === true;
    }

    getAvailableLocales(): AvailableLocale[] {
        const localeMap = new Map<string, AvailableLocale>();

        for (const locale of this.builtIns.values()) {
            localeMap.set(locale.locale, {
                id: locale.id,
                locale: locale.locale,
                displayName: locale.displayName,
                nativeName: locale.nativeName,
                version: locale.version,
                description: locale.description,
                author: locale.author,
                baseLocale: locale.baseLocale,
                rtl: locale.rtl,
                coverage: locale.coverage,
                schemaVersion: locale.schemaVersion,
                builtIn: true,
            });
        }

        for (const locale of this.runtimeLocales.values()) {
            localeMap.set(locale.locale, {
                id: locale.id,
                locale: locale.locale,
                displayName: locale.displayName,
                nativeName: locale.nativeName,
                version: locale.version,
                description: locale.description,
                author: locale.author,
                baseLocale: locale.baseLocale,
                rtl: locale.rtl,
                coverage: locale.coverage,
                schemaVersion: locale.schemaVersion,
                builtIn: false,
            });
        }

        return Array.from(localeMap.values()).sort((left, right) =>
            left.nativeName.localeCompare(right.nativeName)
        );
    }

    private emit(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}

export const localeRegistry = new LocaleRegistryService();
