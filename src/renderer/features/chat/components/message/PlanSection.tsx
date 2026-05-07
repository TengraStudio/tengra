/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCheck, IconListCheck } from '@tabler/icons-react';
import { lazy, memo, Suspense } from 'react';
import remarkGfm from 'remark-gfm';

/* Batch-02: Extracted Long Classes */
const C_PLANSECTION_1 = "w-full mb-4 bg-gradient-to-br from-primary/[0.07] to-accent-foreground/[0.02] border border-primary/20 rounded-2xl p-4 shadow-lg shadow-primary/5 animate-fade-in relative overflow-hidden group/plan sm:p-5 lg:p-6";
const C_PLANSECTION_2 = "flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground typo-caption font-bold tracking_wider hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20";


type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

const LazyReactMarkdown = lazy(() => import('react-markdown'));

export interface PlanSectionProps {
    plan: string | null;
    isLast: boolean;
    isStreaming?: boolean;
    onApprovePlan?: () => void;
    t: TranslationFn;
}

/**
 * PlanSection component
 * 
 * Displays the AI's execution plan (the <plan> tag content).
 * Includes an approval button for the user to confirm the plan.
 */
export const PlanSection = memo(
    ({
        plan,
        isLast,
        isStreaming,
        onApprovePlan,
        t,
    }: PlanSectionProps) => {
        if (!plan) {
            return null;
        }
        return (
            <div className={C_PLANSECTION_1}>
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/plan:opacity-20 transition-opacity">
                    <IconListCheck className="w-12 h-12" />
                </div>
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-primary/10">
                    <div className="p-1.5 rounded-lg bg-primary/20">
                        <IconListCheck className="w-4 h-4 text-primary" />
                    </div>
                    <span className="typo-caption font-bold text-primary">
                        {t('frontend.chat.plan')}
                    </span>
                </div>
                <div className="typo-caption text-foreground/90 leading-relaxed font-medium">
                    <Suspense fallback={<div className="typo-caption text-muted-foreground">{t('common.loading')}</div>}>
                        <LazyReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                li: ({ children }) => (
                                    <li className="flex gap-2.5 my-1.5 items-start">
                                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                                        <span>{children}</span>
                                    </li>
                                ),
                                ul: ({ children }) => <ul className="space-y-1">{children}</ul>,
                            }}
                        >
                            {plan}
                        </LazyReactMarkdown>
                    </Suspense>
                </div>
                {isLast && !isStreaming && onApprovePlan && (
                    <div className="mt-4 pt-4 border-t border-primary/10 flex justify-end">
                        <button
                            onClick={onApprovePlan}
                            className={C_PLANSECTION_2}
                        >
                            <IconCheck className="w-3.5 h-3.5" />
                            {t('frontend.messageBubble.approvePlan')}
                        </button>
                    </div>
                )}
            </div>
        );
    }
);

PlanSection.displayName = 'PlanSection';

