import { JsonValue } from '@shared/types/common';

export interface LocalePackManifest {
    id: string;
    locale: string;
    displayName: string;
    nativeName: string;
    version: string;
    description?: string;
    author?: string;
    baseLocale?: string;
    rtl?: boolean;
    coverage?: number;
    schemaVersion?: string;
}

export interface LocalePack extends LocalePackManifest {
    translations: JsonValue;
}
