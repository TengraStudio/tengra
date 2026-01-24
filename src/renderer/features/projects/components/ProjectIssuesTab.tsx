import { AlertCircle, Check } from 'lucide-react'
import React from 'react'

import { Language, useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'
import { ProjectAnalysis } from '@/types'

interface ProjectIssuesTabProps {
    analysis: ProjectAnalysis
    projectRoot: string
    onOpenFile: (path: string, line?: number) => void
    language: Language
}

export const ProjectIssuesTab: React.FC<ProjectIssuesTabProps> = ({
    analysis,
    projectRoot,
    onOpenFile,
    language
}) => {
    const { t } = useTranslation(language)

    return (
        <div className="flex-1 flex flex-col gap-6 p-4 overflow-y-auto min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                    <AlertCircle className="w-8 h-8 text-primary" />
                    {t('projectDashboard.issues')}
                </h2>
                <p className="text-muted-foreground text-sm max-w-xl">
                    {t('projectDashboard.issuesDescription')}
                </p>
            </div>

            <div className="flex-1 min-h-0 bg-card/40 backdrop-blur-sm rounded-3xl border border-border/50 overflow-hidden flex flex-col shadow-2xl">
                <div className="p-6 border-b border-border/50 bg-muted/20">
                    <div className="grid grid-cols-12 gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        <div className="col-span-1">{t('projectDashboard.issueType')}</div>
                        <div className="col-span-7">{t('projectDashboard.issueMessage')}</div>
                        <div className="col-span-4">{t('projectDashboard.issueLocation')}</div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                    {analysis.issues && analysis.issues.length > 0 ? (
                        analysis.issues.map((issue, idx) => (
                            <div
                                key={idx}
                                className="grid grid-cols-12 gap-4 p-4 rounded-2xl bg-muted/20 hover:bg-muted/30 border border-border/50 transition-all group cursor-pointer"
                                onClick={() => {
                                    const sep = projectRoot.includes('\\') ? '\\' : '/'
                                    onOpenFile(projectRoot + (projectRoot.endsWith(sep) ? '' : sep) + issue.file, issue.line)
                                }}
                            >
                                <div className="col-span-1">
                                    <div className={cn(
                                        "w-8 h-8 rounded-xl flex items-center justify-center border",
                                        issue.type === 'error' ? "bg-destructive/10 border-destructive/20 text-destructive" : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                                    )}>
                                        <AlertCircle className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="col-span-7 flex flex-col justify-center">
                                    <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                        {issue.message}
                                    </div>
                                </div>
                                <div className="col-span-4 flex flex-col justify-center">
                                    <div className="text-[11px] font-mono whitespace-nowrap overflow-hidden text-ellipsis text-muted-foreground group-hover:text-foreground transition-colors">
                                        {issue.file}:{issue.line}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-20 text-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <Check className="w-8 h-8 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">{t('projectDashboard.noIssues')}</h3>
                                <p className="text-sm text-muted-foreground mt-1">{t('projectDashboard.noIssuesDesc') || 'Your project looks clean!'}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
