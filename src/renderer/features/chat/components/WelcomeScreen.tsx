import { ChatTemplate } from '@renderer/features/chat/types';
import { Activity, Code, PenTool, Search } from 'lucide-react';
import React, { useMemo } from 'react';

import logoBlack from '@/assets/tengra_black.png';
import logoWhite from '@/assets/tengra_white.png';
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
    const { isLight} = useThemeDetection();

    const logo = useMemo(() => isLight ? logoBlack : logoWhite, [isLight]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center max-w-2xl mx-auto space-y-8">
            <div className="w-20 h-20 flex items-center justify-center">
                <img src={logo} alt={t('welcome.logoAlt')} />
            </div>
            <div className="space-y-3 shadow-sm">
                <h1 className="text-4xl font-bold text-foreground mb-2">{t('welcome.title')}</h1>
                <p className="text-muted-foreground text-base max-w-md mx-auto">{t('welcome.tagline')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                {templates.map((template) => (
                    <button
                        key={template.id}
                        onClick={() => onSelectTemplate(template.prompt ?? '')}
                        className="group p-4 bg-foreground/[0.03] hover:bg-foreground/[0.08] border border-border/50 hover:border-primary/30 rounded-xl transition-all duration-300 text-left flex items-start gap-3 hover:shadow-2xl active:scale-95"
                    >
                        <div className={cn("p-2.5 rounded-lg bg-primary/5 group-hover:bg-primary/10 transition-colors", template.iconColor)}>
                            {template.id === 'code' ? <Code className="w-4 h-4" /> :
                                template.id === 'write' ? <PenTool className="w-4 h-4" /> :
                                    template.id === 'debug' ? <Activity className="w-4 h-4" /> :
                                        <Search className="w-4 h-4" />}
                        </div>
                        <div className="space-y-0.5">
                            <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{template.title}</div>
                            <div className="text-xxs text-muted-foreground leading-relaxed">{template.description}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

