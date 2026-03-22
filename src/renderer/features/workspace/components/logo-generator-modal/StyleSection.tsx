import React from 'react';

import { cn } from '@/lib/utils';

const STYLE_OPTIONS = [
    { value: 'Minimalist', labelKey: 'workspaces.logoStyles.minimalist' },
    { value: 'Cyberpunk', labelKey: 'workspaces.logoStyles.cyberpunk' },
    { value: 'Modern', labelKey: 'workspaces.logoStyles.modern' },
    { value: 'Retro', labelKey: 'workspaces.logoStyles.retro' },
    { value: 'Modern gradient', labelKey: 'workspaces.logoStyles.modernGradient' },
    { value: '3D Render', labelKey: 'workspaces.logoStyles.render3d' },
] as const;

interface StyleSectionProps {
    style: string
    setStyle: (value: string) => void
    translateKey: (key: string) => string
}

export const StyleSection: React.FC<StyleSectionProps> = ({
    style,
    setStyle,
    translateKey
}) => {
    return (
        <div className="space-y-2">
            <label className="text-xxs font-bold uppercase text-muted-foreground tracking-widest">
                {translateKey('workspaces.style')}
            </label>
            <div className="grid grid-cols-3 gap-2">
                {STYLE_OPTIONS.map(option => (
                    <button
                        key={option.value}
                        onClick={() => setStyle(option.value)}
                        className={cn(
                            "px-2 py-2.5 rounded-xl text-xxxs font-black uppercase tracking-tight border transition-all text-center truncate",
                            style === option.value
                                ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]"
                                : "bg-muted/30 border-border/50 text-muted-foreground hover:border-border/80 hover:bg-muted/40"
                        )}
                    >
                        {translateKey(option.labelKey)}
                    </button>
                ))}
            </div>
        </div>
    );
};
