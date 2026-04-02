import { Check, ListTodo } from 'lucide-react';
import { lazy, memo, Suspense } from 'react';
import remarkGfm from 'remark-gfm';

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
            <div className="w-full mb-4 bg-gradient-to-br from-primary/[0.07] to-accent-foreground/[0.02] border border-primary/20 rounded-2xl p-4 shadow-lg shadow-primary/5 animate-fade-in relative overflow-hidden group/plan">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/plan:opacity-20 transition-opacity">
                    <ListTodo className="w-12 h-12" />
                </div>
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-primary/10">
                    <div className="p-1.5 rounded-lg bg-primary/20">
                        <ListTodo className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xs font-bold text-primary">
                        {t('chat.plan')}
                    </span>
                </div>
                <div className="text-xs text-foreground/90 leading-relaxed font-medium">
                    <Suspense fallback={<div className="text-xs text-muted-foreground">{t('common.loading')}</div>}>
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
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold tracking_wider hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
                        >
                            <Check className="w-3.5 h-3.5" />
                            {t('messageBubble.approvePlan')}
                        </button>
                    </div>
                )}
            </div>
        );
    }
);

PlanSection.displayName = 'PlanSection';
