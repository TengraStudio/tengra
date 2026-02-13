import React from 'react';

interface PaletteProps {
    palette: string[]
    onColorSelect: (color: string) => void
    translateKey: (key: string) => string
}

export const PaletteSection: React.FC<PaletteProps> = ({
    palette,
    onColorSelect,
    translateKey
}) => {
    if (palette.length === 0) {
        return null;
    }

    return (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <label className="text-xxs font-bold uppercase text-muted-foreground tracking-widest">
                {translateKey('projects.suggestedPalette')}
            </label>
            <div className="flex items-center gap-2 pt-1">
                {palette.map((c, i) => (
                    <button
                        key={i}
                        onClick={() => onColorSelect(c)}
                        className="group relative"
                        title={c}
                    >
                        <div
                            className="w-8 h-8 rounded-full border border-border/50 shadow-md transition-transform hover:scale-110 active:scale-90"
                            style={{ backgroundColor: c }}
                        />
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-background text-xxxs px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                            {c}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
