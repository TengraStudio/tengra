import React from 'react';
import { Box, Code, PenTool, Activity, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatTemplate {
    id: string;
    icon: string;
    iconColor: string;
    title: string;
    description: string;
    prompt: string;
}

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
    return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto space-y-8">
            <div className="w-24 h-24 rounded-[2rem] bg-primary/10 flex items-center justify-center text-primary shadow-xl shadow-primary/5 animate-pulse">
                <Box className="w-10 h-10" />
            </div>
            <div className="space-y-4 shadow-sm">
                <h1 className="text-5xl font-black tracking-tight text-white mb-2">{t('welcome.title')}</h1>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">{t('welcome.tagline')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                {templates.map((template) => (
                    <button
                        key={template.id}
                        onClick={() => onSelectTemplate(template.prompt)}
                        className="group p-5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] hover:border-primary/30 rounded-2xl transition-all duration-300 text-left flex items-start gap-4 hover:shadow-2xl active:scale-[0.98]"
                    >
                        <div className={cn("p-3 rounded-xl bg-white/[0.03] group-hover:bg-primary/10 transition-colors", template.iconColor)}>
                            {template.id === 'code' ? <Code className="w-5 h-5" /> :
                                template.id === 'write' ? <PenTool className="w-5 h-5" /> :
                                    template.id === 'debug' ? <Activity className="w-5 h-5" /> :
                                        <Search className="w-5 h-5" />}
                        </div>
                        <div className="space-y-1">
                            <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{template.title}</div>
                            <div className="text-xs text-muted-foreground leading-relaxed">{template.description}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
