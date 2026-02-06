import React from 'react';

interface CommandFooterProps {
    t: (key: string) => string;
}

export const CommandFooter: React.FC<CommandFooterProps> = ({ t }) => {
    return (
        <div className="px-4 py-3 border-t border-white/5 bg-muted/5 flex items-center gap-6 text-xxxs font-bold text-muted-foreground/40 uppercase tracking-widest">
            <span className="flex items-center gap-1.5">
                {t('commandPalette.navigate')}
            </span>
            <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded">↵</kbd>
                {t('commandPalette.select')}
            </span>
            <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded">Esc</kbd>
                {t('commandPalette.close')}
            </span>
            <div className="ml-auto flex items-center gap-2">
                <span>{t('commandPalette.engineLabel')}</span>
                <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
            </div>
        </div>
    );
};

