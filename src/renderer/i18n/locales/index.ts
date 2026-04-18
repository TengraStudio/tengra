/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import enLocalePackData from '@renderer/i18n/locales/en.locale.json';
import type { LocalePack } from '@shared/types/locale';

export const enLocalePack = enLocalePackData satisfies LocalePack;
export const en = enLocalePackData.translations;
