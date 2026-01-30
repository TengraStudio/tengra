import { Check } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface CATEGORY {
    id: string;
    nameKey: string;
    icon: React.ElementType;
    color: string;
    bg: string;
}

interface WizardDetailsStepProps {
    formData: {
        name: string;
        description: string;
        category: string;
    };
    setFormData: React.Dispatch<React.SetStateAction<{
        name: string;
        description: string;
        category: string;
        goal: string;
    }>>;
    categories: CATEGORY[];
    error: string | null;
}

export const WizardDetailsStep: React.FC<WizardDetailsStepProps> = ({
    formData,
    setFormData,
    categories,
    error
}) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-6 flex-1 pt-4">
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
                        {t('projectWizard.projectName')}
                    </label>
                    <input
                        autoFocus
                        value={formData.name}
                        onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                        className="w-full bg-muted/10 border border-border/50 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors text-foreground"
                        placeholder={t('projectWizard.namePlaceholder')}
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-3 block opacity-70 tracking-widest">
                        {t('projects.categoryLabel')}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setFormData(p => ({ ...p, category: cat.id }))}
                                className={cn(
                                    "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all gap-3 group relative overflow-hidden",
                                    formData.category === cat.id
                                        ? "bg-primary/20 border-primary shadow-lg shadow-primary/10"
                                        : "bg-muted/30 border-border/50 hover:bg-muted/50 hover:border-border"
                                )}
                            >
                                {formData.category === cat.id && (
                                    <div className="absolute top-2 right-2">
                                        <Check className="w-3 h-3 text-primary" />
                                    </div>
                                )}
                                <div className={cn("p-2.5 rounded-xl group-hover:scale-110 transition-transform shadow-sm", cat.bg, cat.color)}>
                                    <cat.icon className="w-5 h-5" />
                                </div>
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest truncate w-full px-1 text-center",
                                    formData.category === cat.id ? "text-primary" : "text-muted-foreground"
                                )}>
                                    {t(cat.nameKey)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
                        {t('projectWizard.description')}
                    </label>
                    <textarea
                        value={formData.description}
                        onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                        className="w-full h-24 bg-muted/10 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none text-foreground"
                        placeholder={t('projectWizard.descPlaceholder')}
                    />
                </div>
                {error && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-xs text-balance">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};
