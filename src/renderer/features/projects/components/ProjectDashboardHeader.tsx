import { Project } from '@shared/types/project';
import { Camera, Check, Pencil, RefreshCw, Sparkles } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface ProjectDashboardHeaderProps {
    project: Project;
    projectRoot: string;
    type: string;
    loading: boolean;
    isEditingName: boolean;
    setIsEditingName: (val: boolean) => void;
    editName: string;
    setEditName: (val: string) => void;
    handleSaveName: () => Promise<void>;
    isEditingDesc: boolean;
    setIsEditingDesc: (val: boolean) => void;
    editDesc: string;
    setEditDesc: (val: string) => void;
    handleSaveDesc: () => Promise<void>;
    onOpenLogoGenerator?: () => void;
    analyzeProject: () => Promise<void>;
}

export const ProjectDashboardHeader: React.FC<ProjectDashboardHeaderProps> = ({
    project,
    projectRoot,
    type,
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
    analyzeProject
}) => {
    const { t } = useTranslation();

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
                        onClick={() => { void onOpenLogoGenerator?.(); }}
                        className="absolute inset-0 bg-primary/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 text-primary-foreground"
                    >
                        <Camera className="w-6 h-6" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">{t('projects.changeLogo') || 'Change Logo'}</span>
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
                                onChange={e => setEditName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') { void handleSaveName(); }
                                    if (e.key === 'Escape') { setIsEditingName(false); }
                                }}
                                onBlur={() => { void handleSaveName(); }}
                                className="text-3xl font-black bg-transparent border border-primary/50 rounded-lg px-2 py-1 outline-none w-full tracking-tight text-foreground"
                            />
                            <button onClick={() => { void handleSaveName(); }} className="p-2 bg-primary text-primary-foreground rounded-lg">
                                <Check className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <h1
                            onClick={() => { setIsEditingName(true); }}
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
                                onChange={e => setEditDesc(e.target.value)}
                                onBlur={() => { void handleSaveDesc(); }}
                                className="w-full bg-muted/40 border border-primary/30 rounded-xl p-3 text-sm text-foreground outline-none min-h-[80px] resize-none"
                                placeholder={(t('projects.description') || 'Description') + '...'}
                            />
                        </div>
                    ) : (
                        <p
                            onClick={() => { setIsEditingDesc(true); }}
                            className="text-sm text-muted-foreground leading-relaxed cursor-pointer hover:text-foreground transition-colors max-w-2xl flex items-start gap-2"
                        >
                            {project.description ?? (t('projects.noDescription') ?? 'No description provided')}
                            <Pencil className="w-3 h-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-success/10 border border-success/20 rounded-md">
                        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        <span className="text-[10px] font-bold text-success uppercase tracking-wider">{type}</span>
                    </div>
                    <div className="text-[10px] font-medium text-muted-foreground font-mono bg-accent/50 px-2 py-1 rounded border border-border">
                        {projectRoot}
                    </div>
                    <button
                        onClick={() => { void analyzeProject(); }}
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
};
