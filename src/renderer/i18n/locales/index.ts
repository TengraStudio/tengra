import enLocalePackData from '@renderer/i18n/locales/en.locale.json';
import type { LocalePack } from '@shared/types/locale';

export const enLocalePack = enLocalePackData satisfies LocalePack;
export const en = enLocalePackData.translations;
