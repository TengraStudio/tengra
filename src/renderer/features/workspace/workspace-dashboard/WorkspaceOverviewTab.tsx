import { IconFiles, IconFolder } from '@tabler/icons-react';

import { WorkspaceDashboardHeader } from '@/features/workspace/components/WorkspaceDashboardHeader';
import { WorkspaceStatsCards } from '@/features/workspace/components/WorkspaceStatsCards';
import type { Workspace, WorkspaceAnalysis, WorkspaceStats } from '@/types';

function formatLanguagePercentage(count: number, totalLanguageWeight: number): string {
    if (totalLanguageWeight <= 0) {
        return '0%';
    }

    const rawPercentage = (count / totalLanguageWeight) * 100;
    if (rawPercentage >= 1) {
        return `${rawPercentage.toFixed(1)}%`;
    }
    return `${rawPercentage.toFixed(2)}%`;
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) { return '0 B'; }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

interface WorkspaceOverviewTabProps {
    workspace: Workspace;
    workspaceRoot: string;
    analysis: WorkspaceAnalysis | null;
    stats: WorkspaceStats | null;
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
    onUploadLogo?: () => void;
    analyzeWorkspace: () => Promise<void>;
    onDelete?: () => void;
    t: (key: string) => string;
}

export const WorkspaceOverviewTab = ({
    workspace,
    workspaceRoot,
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
    onUploadLogo,
    analyzeWorkspace,
    t
}: WorkspaceOverviewTabProps) => {
    if (!analysis) {
        return null;
    }

    const totalLanguageWeight = Object.values(analysis.languages).reduce(
        (sum, value) => sum + (typeof value === 'number' ? value : 0),
        0
    );

    const largestDirectories = stats?.largestDirectories ?? [];
    const topFilesByLoc = stats?.topFilesByLoc ?? [];

    return (
        <div className="space-y-12 overflow-y-auto pr-2 pb-12 animate-in fade-in duration-700">
            {/* Header with Title and Description */}
            <WorkspaceDashboardHeader
                workspace={workspace}
                workspaceRoot={workspaceRoot}
                type={analysis.type}
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
                onUploadLogo={onUploadLogo}
            />

            {/* Core Stats Row */}
            <WorkspaceStatsCards
                stats={stats}
                type={analysis.type}
                moduleCount={analysis.monorepo?.packages.length ?? Object.keys(analysis.dependencies).length}
            />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 pt-4">
                {/* Structure Section (Folders & Files) */}
                <div className="space-y-12">
                    {/* Largest Directories */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 px-1">
                            <IconFolder className="w-4 h-4 text-primary/40" />
                            <h3 className="text-[13px] font-bold text-muted-foreground/40 tracking-wide">
                                largest directories
                            </h3>
                        </div>
                        <div className="space-y-2">
                            {largestDirectories.slice(0, 5).map((dir) => (
                                <div key={dir.path} className="flex items-center justify-between gap-4 p-3 rounded-xl border border-border/5 bg-muted/5 group hover:bg-muted/10 transition-all">
                                    <div className="min-w-0 flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary/20 group-hover:bg-primary/60 transition-colors" />
                                        <span className="truncate font-mono text-[11px] text-muted-foreground/60 group-hover:text-foreground/80 transition-colors">
                                            {dir.path}
                                        </span>
                                    </div>
                                    <div className="shrink-0 flex items-center gap-4">
                                        <span className="text-[10px] text-muted-foreground/30">{dir.fileCount} files</span>
                                        <span className="text-[11px] font-bold text-primary/60">{formatBytes(dir.size)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Files by LOC */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 px-1">
                            <IconFiles className="w-4 h-4 text-success/40" />
                            <h3 className="text-[13px] font-bold text-muted-foreground/40 tracking-wide">
                                most complex files
                            </h3>
                        </div>
                        <div className="space-y-2">
                            {topFilesByLoc.slice(0, 5).map((file) => (
                                <div key={file.path} className="flex items-center justify-between gap-4 p-3 rounded-xl border border-border/5 bg-muted/5 group hover:bg-muted/10 transition-all">
                                    <div className="min-w-0 flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-success/20 group-hover:bg-success/60 transition-colors" />
                                        <span className="truncate font-mono text-[11px] text-muted-foreground/60 group-hover:text-foreground/80 transition-colors">
                                            {file.path}
                                        </span>
                                    </div>
                                    <div className="shrink-0">
                                        <span className="text-[11px] font-bold text-success/60">{file.loc.toLocaleString()} lines</span>
                                    </div>
                                </div>
                            ))}
                            {topFilesByLoc.length === 0 && (
                                <div className="p-8 text-center border border-dashed border-border/10 rounded-2xl">
                                    <span className="text-xs text-muted-foreground/20 italic">No file data available</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Composition Section (Tech & Languages) */}
                <div className="space-y-12">
                    {/* Technology Stack */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 px-1">
                            <div className="w-1 h-1 rounded-full bg-primary/40" />
                            <h3 className="text-[13px] font-bold text-muted-foreground/40 tracking-wide">
                                technology stack
                            </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-4 py-1.5 rounded-xl border border-primary/10 bg-primary/5 text-[11px] font-bold text-primary">
                                {analysis.type}
                            </span>
                            {analysis.monorepo && (
                                <span className="px-4 py-1.5 rounded-xl border border-border/5 bg-muted/5 text-[11px] font-bold text-muted-foreground/60">
                                    {analysis.monorepo.type}
                                </span>
                            )}
                            {analysis.frameworks.map((fw: string) => (
                                <span key={fw} className="px-4 py-1.5 bg-muted/5 border border-border/5 rounded-xl text-[11px] text-muted-foreground/50 font-semibold hover:bg-muted/10 transition-colors">
                                    {fw}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Language Distribution */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 px-1">
                            <div className="w-1 h-1 rounded-full bg-success/40" />
                            <h3 className="text-[13px] font-bold text-muted-foreground/40 tracking-wide">
                                language distribution
                            </h3>
                        </div>
                        <div className="grid grid-cols-1 gap-5">
                            {Object.entries(analysis.languages)
                                .sort(([, a], [, b]) => (b as number) - (a as number))
                                .slice(0, 6)
                                .map(([lang, count]) => {
                                    const percentage = totalLanguageWeight > 0 ? ((count as number) / totalLanguageWeight) * 100 : 0;
                                    return (
                                        <div key={lang} className="group space-y-2">
                                            <div className="flex justify-between text-[11px] font-bold tracking-tight px-0.5">
                                                <span className="text-muted-foreground/60 group-hover:text-foreground/80 transition-colors">{lang}</span>
                                                <span className="text-muted-foreground/30 tabular-nums">
                                                    {formatLanguagePercentage(count as number, totalLanguageWeight)}
                                                </span>
                                            </div>
                                            <div className="h-1 w-full bg-muted/5 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-success/20 rounded-full group-hover:bg-success/40 transition-all duration-700 ease-out" 
                                                    style={{ width: `${percentage}%` }} 
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
