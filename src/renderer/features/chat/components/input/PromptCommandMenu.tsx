import { memo } from 'react';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

export interface PromptCommandMenuProps {
    show: boolean;
    prompts: Array<{ id: string; title: string; content: string }>;
    selectedIndex: number;
    onSelect: (prompt: { id: string; title: string; content: string }) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

/**
 * PromptCommandMenu component
 * 
 * Displays a list of suggested prompts when the user types a '/' in the input.
 */
export const PromptCommandMenu = memo(({ show, prompts, selectedIndex, onSelect, t }: PromptCommandMenuProps) => (
    <AnimatePresence>
        {show && (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full left-0 mb-2 w-64 bg-popover border border-border/50 rounded-lg shadow-xl overflow-hidden z-50"
                role="listbox"
                aria-label={t('input.promptSuggestions')}
                id="chat-prompt-command-listbox"
            >
                <div
                    className="text-xxs uppercase font-bold text-muted-foreground px-3 py-1.5 bg-muted/30"
                    role="heading"
                    aria-level={3}
                >
                    {t('input.prompts')}
                </div>
                {prompts.map((prompt, i) => (
                    <button
                        key={prompt.id}
                        onClick={() => onSelect(prompt)}
                        className={cn(
                            'w-full text-left px-3 py-2 text-xs transition-colors block',
                            i === selectedIndex
                                ? 'bg-primary/20 text-primary'
                                : 'hover:bg-accent/50 text-foreground'
                        )}
                        aria-label={t('input.usePrompt', { title: prompt.title })}
                        aria-selected={i === selectedIndex}
                        role="option"
                    >
                        <div className="font-medium">{prompt.title}</div>
                        <div className="text-xxs text-muted-foreground truncate">
                            {prompt.content}
                        </div>
                    </button>
                ))}
            </motion.div>
        )}
    </AnimatePresence>
));

PromptCommandMenu.displayName = 'PromptCommandMenu';
