import { ChatTemplate } from '@renderer/features/chat/types';
import { Activity, Code, PenTool, Search } from 'lucide-react';
import React, { useMemo } from 'react';

import logoBlack from '@/assets/tengra_black.png';
import logoWhite from '@/assets/tengra_white.png';
import { Button } from '@/components/ui/button';
import { useThemeDetection } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface WelcomeScreenProps {
    t: (key: string) => string;
    templates: ChatTemplate[];
    onSelectTemplate: (prompt: string) => void;
}

/**
 * WelcomeScreen Component
 * 
 * Displayed when there are no messages in the current chat.
 * Provides a greeting and quick-start templates for different tasks.
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
    t,
    templates,
    onSelectTemplate
}) => {
    const { isLight } = useThemeDetection();

    const logo = useMemo(() => isLight ? logoBlack : logoWhite, [isLight]);

    return (
        <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center space-y-6 p-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center">
                <img src={logo} alt={t('welcome.logoAlt')} />
            </div>
            <div className="space-y-2">
                <h1 className="mb-1 text-3xl font-semibold text-foreground">{t('welcome.title')}</h1>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">{t('welcome.tagline')}</p>
            </div>
            <div className="mt-4 grid w-full max-w-2xl grid-cols-1 gap-2.5 animate-in fade-in duration-500 sm:grid-cols-2">
                {templates.map((template) => (
                    <Button
                        key={template.id}
                        type="button"
                        variant="outline"
                        onClick={() => onSelectTemplate(template.prompt ?? '')}
                        className="h-auto items-start justify-start gap-3 rounded-md border-border/50 px-3 py-3 text-left font-normal"
                    >
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-md bg-muted/60", template.iconColor)}>
                            {template.id === 'code' ? <Code className="w-4 h-4" /> :
                                template.id === 'write' ? <PenTool className="w-4 h-4" /> :
                                    template.id === 'debug' ? <Activity className="w-4 h-4" /> :
                                        <Search className="w-4 h-4" />}
                        </div>
                        <div className="space-y-0.5">
                            <div className="text-sm font-medium text-foreground">{template.title}</div>
                            <div className="typo-caption leading-relaxed text-muted-foreground">{template.description}</div>
                        </div>
                    </Button>
                ))}
            </div>
        </div>
    );
};

