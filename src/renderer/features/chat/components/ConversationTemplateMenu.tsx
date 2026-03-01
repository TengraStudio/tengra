import { CONVERSATION_TEMPLATES, ConversationTemplate } from '@shared/data/conversation-templates';
import { Plus } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface ConversationTemplateMenuProps {
    /** Called with selected template's system prompt and starter message */
    onSelect: (systemPrompt: string, starterMessage: string) => void
}

/**
 * Dropdown menu for starting new conversations from predefined templates.
 * Shows template categories and descriptions for quick selection.
 */
export const ConversationTemplateMenu: React.FC<ConversationTemplateMenuProps> = ({ onSelect }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const templates = useMemo(() => CONVERSATION_TEMPLATES, []);

    const handleSelect = useCallback((template: ConversationTemplate) => {
        onSelect(template.systemPrompt, t(template.starterMessage));
        setIsOpen(false);
    }, [onSelect, t]);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                title={t('conversationTemplates.newFromTemplate')}
            >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('conversationTemplates.newFromTemplate')}</span>
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-1 z-50 w-72 max-h-80 overflow-y-auto rounded-xl border border-border bg-card shadow-2xl">
                        <div className="p-2.5 border-b border-border">
                            <span className="text-xs font-bold text-foreground">{t('conversationTemplates.title')}</span>
                            <p className="text-xxs text-muted-foreground mt-0.5">{t('conversationTemplates.subtitle')}</p>
                        </div>
                        <div className="p-1.5 space-y-0.5">
                            {templates.map(tmpl => (
                                <button
                                    key={tmpl.id}
                                    onClick={() => handleSelect(tmpl)}
                                    className={cn(
                                        'w-full text-left p-2.5 rounded-lg hover:bg-muted/20 transition-colors group',
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">{tmpl.icon}</span>
                                        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                            {t(tmpl.name)}
                                        </span>
                                        <span className="ml-auto px-1.5 py-0.5 rounded text-xxs bg-muted/30 text-muted-foreground">
                                            {t(`conversationTemplates.categories.${tmpl.category}`)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 ml-7 line-clamp-1">
                                        {t(tmpl.description)}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
