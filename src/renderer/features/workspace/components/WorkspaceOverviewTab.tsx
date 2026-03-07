
import { ProjectDashboardHeader } from '@renderer/features/workspace/components/ProjectDashboardHeader';
import { ProjectStatsCards } from '@renderer/features/workspace/components/ProjectStatsCards';
import { Project } from '@shared/types/project';
import { Trash2 } from 'lucide-react';

import { ProjectAnalysis, ProjectStats } from '@/types';

interface ProjectOverviewTabProps {
    project: Project;
    projectRoot: string;
    analysis: ProjectAnalysis | null;
    stats: ProjectStats | null;
    loading: boolean;
    isEditingName: boolean;
    setIsEditingName: (v: boolean) => void;
    editName: string;
    setEditName: (v: string) => void;
    handleSaveName: () => Promise<void>;
    isEditingDesc: boolean;
    setIsEditingDesc: (v: boolean) => void;
    editDesc: string;
    setEditDesc: (v: string) => void;
    handleSaveDesc: () => Promise<void>;
    onOpenLogoGenerator?: () => void;
    analyzeProject: () => Promise<void>;
    onDelete?: () => void;
    t: (key: string) => string;
}

export const ProjectOverviewTab = ({
    project,
    projectRoot,
    analysis,
    stats,
    loading,
    isEditingName,
    setIsEditingName,
    editName,
    setEditName,
    handleSaveName,
    isEditingDesc,
    setIsEditingDesc,
    editDesc,
    setEditDesc,
    handleSaveDesc,
    onOpenLogoGenerator,
    analyzeProject,
    onDelete,
    t
}: ProjectOverviewTabProps) => {
    if (!analysis) {
        return null;
    }

    return (
        <div className="space-y-8 overflow-y-auto pr-2 pb-12 animate-in fade-in duration-500">
            <ProjectDashboardHeader
                project={project}
                projectRoot={projectRoot}
                type={analysis.type}
                loading={loading}
                isEditingName={isEditingName}
                setIsEditingName={setIsEditingName}
                editName={editName}
                setEditName={setEditName}
                handleSaveName={handleSaveName}
                isEditingDesc={isEditingDesc}
                setIsEditingDesc={setIsEditingDesc}
                editDesc={editDesc}
                setEditDesc={setEditDesc}
                handleSaveDesc={handleSaveDesc}
                onOpenLogoGenerator={onOpenLogoGenerator}
                analyzeProject={analyzeProject}
            />

            <ProjectStatsCards
                stats={stats}
                type={analysis.type}
                moduleCount={analysis.monorepo?.packages.length ?? Object.keys(analysis.dependencies).length}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card/40 rounded-2xl border border-border p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {t('workspaceDashboard.techStack')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {analysis.frameworks.map((fw: string) => (
                            <span key={fw} className="px-3 py-1 bg-muted/30 border border-border rounded-full text-xs text-primary font-medium">
                                {fw}
                            </span>
                        ))}
                        {analysis.frameworks.length === 0 && <span className="text-xs text-muted-foreground italic">{t('workspaceDashboard.noFrameworks')}</span>}
                    </div>
                </div>

                <div className="bg-card/40 rounded-2xl border border-border p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-success" />
                        {t('workspaceDashboard.langDist')}
                    </h3>
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                        {Object.entries(analysis.languages)
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
                                            <div className="h-full bg-success/50 rounded-full" style={{ width: `${percentage}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            </div>

            {analysis.todos.length > 0 && (
                <div className="bg-card/40 rounded-2xl border border-border/50 p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow" />
                        {t('workspaceDashboard.todoList')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {analysis.todos.map((todo: string, i: number) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-muted/10 rounded-xl border border-border/50 hover:bg-muted/20 transition-colors">
                                <div className="w-4 h-4 rounded border border-border/50 mt-0.5 flex-shrink-0" />
                                <span className="text-xs text-foreground/80 line-clamp-2">{todo}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-12 pt-8 border-t border-destructive/20">
                <h3 className="text-lg font-bold text-destructive mb-4 flex items-center gap-2">
                    <Trash2 className="w-5 h-5" />
                    {t('workspaces.dangerZone') || 'Danger Zone'}
                </h3>
                <div className="bg-destructive/5 border border-destructive/10 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <h4 className="text-foreground font-medium mb-1">{t('workspaces.deleteWorkspace') || 'Delete Project'}</h4>
                        <p className="text-sm text-muted-foreground">{t('workspaces.deleteWarning') || 'This action cannot be undone.'}</p>
                    </div>
                    <button
                        onClick={() => { void onDelete?.(); }}
                        className="px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg border border-destructive/20 transition-colors text-sm font-medium"
                    >
                        {t('common.delete') || 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
};
