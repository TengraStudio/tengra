/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
    frontend?: JsonValue;
    backend?: JsonValue;
    translations?: JsonValue; // kept for backward-compat with third-party locale packs
}


