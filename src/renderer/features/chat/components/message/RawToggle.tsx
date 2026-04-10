import { Code2, Eye } from 'lucide-react';
import { memo } from 'react';

import { cn } from '@/lib/utils';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface RawToggleProps {
    active: boolean;
    onClick: () => void;
    t: TranslationFn;
}

/**
 * RawToggle component
 * 
 * A toggle switch to switch between rendered markdown and raw markdown text.
 */
export const RawToggle = memo(({ active, onClick, t }: RawToggleProps) => (
    <div className="flex items-center gap-2 mb-1">
        <button
            onClick={onClick}
            className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-lg typo-caption font-medium transition-colors',
                active
                    ? 'bg-primary/20 text-primary'
                    : 'bg-accent/30 text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
        >
            {active ? <Eye className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
            {active ? t('chat.render') : t('chat.raw')}
        </button>
    </div>
));

RawToggle.displayName = 'RawToggle';
