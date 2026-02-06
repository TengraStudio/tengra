import { Camera, Check, Pencil, RefreshCw, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Project, ProjectAnalysis, ProjectStats } from '@/types';

interface ProjectOverviewHeaderProps {
    project: Project
    projectRoot: string
    analysis: ProjectAnalysis
    loading: boolean
    isEditingName: boolean
    isEditingDesc: boolean
    editName: string
    editDesc: string
    onEditName: (editing: boolean) => void
    onEditDesc: (editing: boolean) => void
    onSetName: (name: string) => void
    onSetDesc: (desc: string) => void
    onSaveName: () => void
    onSaveDesc: () => void
    onAnalyze: () => void
    onOpenLogoGenerator?: () => void
    t: (key: string) => string
}

export function ProjectOverviewHeader({
    project,
    projectRoot,
    analysis,
    loading,
    isEditingName,
    isEditingDesc,
    editName,
    editDesc,
    onEditName,
    onEditDesc,
    onSetName,
    onSetDesc,
    onSaveName,
    onSaveDesc,
    onAnalyze,
    onOpenLogoGenerator,
    t
}: ProjectOverviewHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row gap-8 items-start bg-card/40 p-6 rounded-3xl border border-border backdrop-blur-sm">
            {/* Logo Area */}
            <div className="relative group shrink-0">
                <div className="w-32 h-32 rounded-2xl bg-muted/40 border-2 border-dashed border-border flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/50 shadow-inner">
                    {project.logo ? (
                        <img src={`safe-file://${project.logo}`} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                        <Sparkles className="w-10 h-10 text-muted-foreground/20" />
                    )}

                    <button
                        onClick={onOpenLogoGenerator}
                        className="absolute inset-0 bg-primary/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 text-primary-foreground"
                    >
                        <Camera className="w-6 h-6" />
                        <span className="text-xxs font-bold uppercase tracking-tighter">{t('projects.changeLogo') || 'Change Logo'}</span>
                    </button>
                </div>
            </div>

            {/* Name & Description Area */}
            <div className="flex-1 space-y-4 w-full">
                <div className="space-y-1 group">
                    {isEditingName ? (
                        <div className="flex items-center gap-2">
                            <input
                                autoFocus
                                value={editName}
                                onChange={e => onSetName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') { onSaveName(); }
                                    if (e.key === 'Escape') { onEditName(false); }
                                }}
                                onBlur={() => onSaveName()}
                                className="text-3xl font-black bg-transparent border border-primary/50 rounded-lg px-2 py-1 outline-none w-full tracking-tight text-foreground"
                            />
                            <button onClick={onSaveName} className="p-2 bg-primary text-primary-foreground rounded-lg">
                                <Check className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <h1
                            onClick={() => onEditName(true)}
                            className="text-4xl font-black tracking-tighter text-foreground cursor-pointer hover:text-primary transition-colors flex items-center gap-3"
                        >
                            {project.title}
                            <Pencil className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                        </h1>
                    )}
                </div>

                <div className="group">
                    {isEditingDesc ? (
                        <div className="space-y-2">
                            <textarea
                                autoFocus
                                value={editDesc}
                                onChange={e => onSetDesc(e.target.value)}
                                onBlur={() => onSaveDesc()}
                                className="w-full bg-muted/40 border border-primary/30 rounded-xl p-3 text-sm text-foreground outline-none min-h-[80px] resize-none"
                                placeholder={(t('projects.description') || 'Description') + '...'}
                            />
                        </div>
                    ) : (
                        <p
                            onClick={() => onEditDesc(true)}
                            className="text-sm text-muted-foreground leading-relaxed cursor-pointer hover:text-foreground transition-colors max-w-2xl flex items-start gap-2"
                        >
                            {project.description}
                            <Pencil className="w-3 h-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-success/10 border border-success/20 rounded-md">
                        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        <span className="text-xxs font-bold text-success uppercase tracking-wider">{analysis.type}</span>
                    </div>
                    <div className="text-xxs font-medium text-muted-foreground font-mono bg-accent/50 px-2 py-1 rounded border border-border">
                        {projectRoot}
                    </div>
                    <button
                        onClick={onAnalyze}
                        disabled={loading}
                        className="p-2 rounded-lg bg-muted/20 border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all flex items-center gap-2 text-xs"
                        title={t('common.refresh')}
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                        {loading ? t('common.loading') : t('common.refresh')}
                    </button>
                </div>
            </div>
        </div>
    );
}

interface ProjectStatsCardsProps {
    stats: ProjectStats | null
    analysis: ProjectAnalysis
    t: (key: string) => string
    formatBytes: (bytes: number) => string
}

export function ProjectStatsCards({ stats, analysis, t, formatBytes }: ProjectStatsCardsProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-colors">
                <div className="text-xxs font-bold uppercase text-muted-foreground mb-1 tracking-wider">{t('projectDashboard.fileCount')}</div>
                <div className="text-2xl font-black text-foreground">{stats?.fileCount ?? 0}</div>
            </div>
            <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-colors">
                <div className="text-xxs font-bold uppercase text-muted-foreground mb-1 tracking-wider">{t('projectDashboard.loc')}</div>
                <div className="text-2xl font-black text-foreground">~{stats?.loc ?? 0}</div>
            </div>
            <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-colors">
                <div className="text-xxs font-bold uppercase text-muted-foreground mb-1 tracking-wider">{t('projectDashboard.totalSize')}</div>
                <div className="text-2xl font-black text-foreground">{stats ? formatBytes(stats.totalSize) : '0 B'}</div>
            </div>
            <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-colors">
                <div className="text-[10px) font-bold uppercase text-muted-foreground mb-1 tracking-wider">{t('projectDashboard.modules')}</div>
                <div className="text-2xl font-black text-foreground">{analysis.monorepo?.packages.length ?? Object.keys(analysis.dependencies).length}</div>
            </div>
            <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-colors">
                <div className="text-xxs font-bold uppercase text-muted-foreground mb-1 tracking-wider">{t('projectDashboard.type')}</div>
                <div className="text-2xl font-black text-primary capitalize">{analysis.type}</div>
            </div>
        </div>
    );
}
