import blackThemeManifestJson from '@renderer/themes/manifests/black.theme.json';
import whiteThemeManifestJson from '@renderer/themes/manifests/white.theme.json';

import type { ThemeColors, ThemeManifest, ThemeVars } from '@shared/types/theme';

const BLACK_THEME_MANIFEST = blackThemeManifestJson as ThemeManifest;
const WHITE_THEME_MANIFEST = whiteThemeManifestJson as ThemeManifest;

function cloneThemeColors(colors: ThemeColors): ThemeColors {
    return { ...colors };
}

function cloneThemeVars(vars?: ThemeVars): ThemeVars | undefined {
    return vars ? { ...vars } : undefined;
}

function createBuiltInThemeManifest({
    baseManifest,
    id,
    name,
    displayName,
    description,
    type,
    category,
    colors,
    preview,
    tags,
}: {
    baseManifest: ThemeManifest;
    id: string;
    name: string;
    displayName: string;
    description: string;
    type: ThemeManifest['type'];
    category: NonNullable<ThemeManifest['category']>;
    colors: ThemeColors;
    preview?: string;
    tags?: string[];
}): ThemeManifest {
    return {
        ...baseManifest,
        id,
        name,
        displayName,
        description,
        version: '1.0.0',
        type,
        category,
        preview: preview ?? baseManifest.preview,
        colors: cloneThemeColors(colors),
        vars: cloneThemeVars(baseManifest.vars),
        tags: tags ?? baseManifest.tags,
    };
}

export const BUILTIN_THEME_MANIFESTS: ThemeManifest[] = [
    createBuiltInThemeManifest({
        baseManifest: BLACK_THEME_MANIFEST,
        id: 'graphite',
        name: 'tengra-graphite',
        displayName: 'Graphite',
        description: 'Default dark Tengra theme',
        type: 'dark',
        category: 'elite-dark',
        colors: {
            ...BLACK_THEME_MANIFEST.colors,
            primary: '199 89% 48%',
            ring: '199 89% 48%',
        },
        tags: ['dark', 'default', 'graphite'],
    }),
    createBuiltInThemeManifest({
        baseManifest: BLACK_THEME_MANIFEST,
        id: 'obsidian',
        name: 'tengra-obsidian',
        displayName: 'Obsidian',
        description: 'Dark theme with violet accents',
        type: 'dark',
        category: 'elite-dark',
        colors: {
            ...BLACK_THEME_MANIFEST.colors,
            primary: '262 83% 58%',
            ring: '262 83% 58%',
        },
        tags: ['dark', 'violet', 'obsidian'],
    }),
    createBuiltInThemeManifest({
        baseManifest: BLACK_THEME_MANIFEST,
        id: 'midnight',
        name: 'tengra-midnight',
        displayName: 'Midnight',
        description: 'Dark theme with blue accents',
        type: 'dark',
        category: 'elite-dark',
        colors: {
            ...BLACK_THEME_MANIFEST.colors,
            primary: '217 91% 60%',
            ring: '217 91% 60%',
        },
        tags: ['dark', 'blue', 'midnight'],
    }),
    createBuiltInThemeManifest({
        baseManifest: WHITE_THEME_MANIFEST,
        id: 'snow',
        name: 'tengra-snow',
        displayName: 'Snow',
        description: 'Clean light Tengra theme',
        type: 'light',
        category: 'professional-light',
        colors: {
            ...WHITE_THEME_MANIFEST.colors,
            primary: '221 83% 53%',
            ring: '221 83% 53%',
        },
        tags: ['light', 'clean', 'snow'],
    }),
    {
        ...BLACK_THEME_MANIFEST,
        colors: cloneThemeColors(BLACK_THEME_MANIFEST.colors),
        vars: cloneThemeVars(BLACK_THEME_MANIFEST.vars),
    },
    {
        ...WHITE_THEME_MANIFEST,
        colors: cloneThemeColors(WHITE_THEME_MANIFEST.colors),
        vars: cloneThemeVars(WHITE_THEME_MANIFEST.vars),
    },
];

export const BUILTIN_THEME_IDS = new Set(BUILTIN_THEME_MANIFESTS.map(theme => theme.id));
