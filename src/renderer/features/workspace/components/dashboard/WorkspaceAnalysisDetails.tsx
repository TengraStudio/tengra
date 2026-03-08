import { WorkspaceStats } from '@/types';

interface WorkspaceTechStackProps {
    frameworks: string[]
    t: (key: string) => string
}

export function WorkspaceTechStack({ frameworks, t }: WorkspaceTechStackProps) {
    return (
        <div className="bg-card/40 rounded-2xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                {t('workspaceDashboard.techStack')}
            </h3>
            <div className="flex flex-wrap gap-2">
                {frameworks.map((fw: string) => (
                    <span key={fw} className="px-3 py-1 bg-muted/30 border border-border rounded-full text-xs text-primary font-medium">
                        {fw}
                    </span>
                ))}
                {frameworks.length === 0 && <span className="text-xs text-muted-foreground italic">{t('workspaceDashboard.noFrameworks')}</span>}
            </div>
        </div>
    );
}

interface WorkspaceLanguageDistributionProps {
    languages: Record<string, number | unknown>
    stats: WorkspaceStats | null
    t: (key: string) => string
}

export function WorkspaceLanguageDistribution({ languages, stats, t }: WorkspaceLanguageDistributionProps) {
    return (
        <div className="bg-card/40 rounded-2xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                {t('workspaceDashboard.langDist')}
            </h3>
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                {Object.entries(languages)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 15)
                    .map(([lang, count]) => {
                        const percentage = stats ? Math.round(((count as number) / stats.fileCount) * 100) : 0;
                        return (
                            <div key={lang} className="space-y-1">
                                <div className="flex justify-between text-xxs uppercase font-bold tracking-tight">
                                    <span className="text-foreground/80">{lang}</span>
                                    <span className="text-muted-foreground">{percentage}%</span>
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
                <div className="w-1.5 h-1.5 rounded-full bg-yellow" />
                {t('workspaceDashboard.todoList')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {todos.map((todo: string, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-muted/10 rounded-xl border border-border/50 hover:bg-muted/20 transition-colors">
                        <div className="w-4 h-4 rounded border border-border/50 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-foreground/80 line-clamp-2">{todo}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}