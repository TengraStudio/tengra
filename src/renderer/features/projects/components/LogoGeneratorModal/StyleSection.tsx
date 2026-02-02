import React from 'react';

import { cn } from '@/lib/utils';

const STYLE_OPTIONS = ['Minimalist', 'Cyberpunk', 'Modern', 'Retro', 'Modern gradient', '3D Render'];

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
            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                {translateKey('projects.style')}
            </label>
            <div className="grid grid-cols-3 gap-2">
                {STYLE_OPTIONS.map(s => (
                    <button
                        key={s}
                        onClick={() => setStyle(s)}
                        className={cn(
                            "px-2 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-tight border transition-all text-center truncate",
                            style === s
                                ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]"
                                : "bg-muted/30 border-border/50 text-muted-foreground hover:border-border/80 hover:bg-muted/40"
                        )}
                    >
                        {s}
                    </button>
                ))}
            </div>
        </div>
    );
};
