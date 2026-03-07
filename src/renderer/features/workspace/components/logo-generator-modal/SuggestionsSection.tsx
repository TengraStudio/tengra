import React from 'react';

interface SuggestionsProps {
    suggestions: string[]
    onSelectIdea: (idea: string) => void
    translateKey: (key: string) => string
}

export const SuggestionsSection: React.FC<SuggestionsProps> = ({
    suggestions,
    onSelectIdea,
    translateKey
}) => {
    if (suggestions.length === 0) {
        return null;
    }

    return (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <label className="text-xxs font-bold uppercase text-muted-foreground tracking-widest">
                {translateKey('workspaces.ideas')}
            </label>
            <div className="flex flex-col gap-2">
                {suggestions.map((s, i) => (
                    <button
                        key={i}
                        onClick={() => onSelectIdea(s)}
                        className="text-left p-2 bg-muted/20 hover:bg-muted/30 rounded-lg text-xxs text-muted-foreground/60 hover:text-foreground transition-all border border-transparent hover:border-border/50"
                    >
                        {s}
                    </button>
                ))}
            </div>
        </div>
    );
};
