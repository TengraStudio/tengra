/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

interface WorkspaceTechStackProps {
    frameworks: string[]
    t: (key: string) => string
}

export function WorkspaceTechStack({ frameworks, t }: WorkspaceTechStackProps) {
    return (
        <div className="bg-card/40 rounded-2xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                {t('frontend.workspaceDashboard.techStack')}
            </h3>
            <div className="flex flex-wrap gap-2">
                {frameworks.map((fw: string) => (
                    <span key={fw} className="px-3 py-1 bg-muted/30 border border-border rounded-full typo-caption text-primary font-medium">
                        {fw}
                    </span>
                ))}
                {frameworks.length === 0 && <span className="typo-caption text-muted-foreground">{t('frontend.workspaceDashboard.noFrameworks')}</span>}
            </div>
        </div>
    );
}

interface WorkspaceLanguageDistributionProps {
    languages: Record<string, number>
    t: (key: string) => string
}

function formatLanguagePercentage(count: number, totalLanguageWeight: number): string {
    if (totalLanguageWeight <= 0) {
        return '0%';
    }

    const rawPercentage = (count / totalLanguageWeight) * 100;
    if (rawPercentage >= 1) {
        return `${rawPercentage.toFixed(1)}%`;
    }
    if (rawPercentage > 0) {
        return '<1%';
    }
    return '0%';
}

export function WorkspaceLanguageDistribution({ languages, t }: WorkspaceLanguageDistributionProps) {
    const totalLanguageWeight = Object.values(languages).reduce(
        (sum, value) => sum + (typeof value === 'number' ? value : 0),
        0
    );

    return (
        <div className="bg-card/40 rounded-2xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                {t('frontend.workspaceDashboard.langDist')}
            </h3>
            <div className="space-y-3 max-h-250 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                {Object.entries(languages)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 15)
                    .map(([lang, count]) => {
                        const percentage =
                            totalLanguageWeight > 0
                                ? ((count as number) / totalLanguageWeight) * 100
                                : 0;
                        return (
                            <div key={lang} className="space-y-1">
                                <div className="flex justify-between text-sm font-bold">
                                    <span className="text-foreground/80">{lang}</span>
                                    <span className="text-muted-foreground">{formatLanguagePercentage(count as number, totalLanguageWeight)}</span>
                                </div>
                                <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-success/50 rounded-full"
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
}

interface WorkspaceAnalysisTodosProps {
    todos: string[]
    t: (key: string) => string
}

export function WorkspaceAnalysisTodos({ todos, t }: WorkspaceAnalysisTodosProps) {
    if (todos.length === 0) {return null;}

    return (
        <div className="bg-card/40 rounded-2xl border border-border/50 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                {t('frontend.workspaceDashboard.todoList')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {todos.map((todo: string, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-muted/10 rounded-xl border border-border/50 hover:bg-muted/20 transition-colors">
                        <div className="w-4 h-4 rounded border border-border/50 mt-0.5 flex-shrink-0" />
                        <span className="typo-caption text-foreground/80 line-clamp-2">{todo}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
