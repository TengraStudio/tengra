import type { ThemeManifest } from '@shared/types/theme';

import blackThemeManifestJson from '@/themes/manifests/black.theme.json';
import whiteThemeManifestJson from '@/themes/manifests/white.theme.json';

const BLACK_THEME_MANIFEST = blackThemeManifestJson as ThemeManifest;
const WHITE_THEME_MANIFEST = whiteThemeManifestJson as ThemeManifest;

export const BUILTIN_THEME_MANIFESTS: ThemeManifest[] = [
    {
        ...BLACK_THEME_MANIFEST,
        colors: { ...BLACK_THEME_MANIFEST.colors },
        vars: BLACK_THEME_MANIFEST.vars ? { ...BLACK_THEME_MANIFEST.vars } : undefined,
    },
    {
        ...WHITE_THEME_MANIFEST,
        colors: { ...WHITE_THEME_MANIFEST.colors },
        vars: WHITE_THEME_MANIFEST.vars ? { ...WHITE_THEME_MANIFEST.vars } : undefined,
    },
];

export const BUILTIN_THEME_IDS = new Set(BUILTIN_THEME_MANIFESTS.map(theme => theme.id));

