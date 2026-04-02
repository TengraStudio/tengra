export type AppFontPresetId = 'system';
export type AppTypographyScale = 'compact' | 'balanced' | 'comfortable';

export interface AppFontPreset {
    id: AppFontPresetId
    label: string
    sans: string
    display: string
}

const APP_FONT_PRESETS: AppFontPreset[] = [
    {
        id: 'system',
        label: 'Segoe UI',
        sans: '"Segoe UI Variable", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Ubuntu", "Cantarell", "Noto Sans", sans-serif',
        display: '"Segoe UI Variable", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Ubuntu", "Cantarell", "Noto Sans", sans-serif',
    },
];

const APP_TYPOGRAPHY_SCALES: Record<AppTypographyScale, {
    lineHeight: string
    headingTracking: string
}> = {
    compact: {
        lineHeight: '1.5',
        headingTracking: '-0.028em',
    },
    balanced: {
        lineHeight: '1.58',
        headingTracking: '-0.035em',
    },
    comfortable: {
        lineHeight: '1.68',
        headingTracking: '-0.02em',
    },
};

export function getAppFontPresets(): AppFontPreset[] {
    return APP_FONT_PRESETS;
}

export function resolveAppFontPreset(fontFamily?: string): AppFontPreset {
    return APP_FONT_PRESETS.find(preset => preset.id === fontFamily) ?? APP_FONT_PRESETS[0];
}

export function resolveTypographyScale(scale?: string): {
    id: AppTypographyScale
    lineHeight: string
    headingTracking: string
} {
    const resolvedId: AppTypographyScale =
        scale === 'compact' || scale === 'comfortable' || scale === 'balanced'
            ? scale
            : 'balanced';
    return {
        id: resolvedId,
        ...APP_TYPOGRAPHY_SCALES[resolvedId],
    };
}
