import { Archive, ArrowRight, Calendar, MoreVertical, Pencil, Terminal, Trash2 } from 'lucide-react';
import React, { memo } from 'react';

import { motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { Project } from '@/types';

interface ProjectCardProps {
    project: Project
    index: number
    onSelect: (project: Project) => void
    showMenu: boolean
    setShowMenu: (id: string | null) => void
    onEdit: (project: Project, e: React.MouseEvent) => void
    onDelete: (project: Project, e: React.MouseEvent) => void
    onArchive: (project: Project) => void
    isSelected?: boolean
    onToggleSelection?: () => void
    t: (key: string) => string
}

const ProjectSelectionCheckbox: React.FC<{ isSelected?: boolean; onToggle?: () => void }> = ({ isSelected, onToggle }) => (
    <div
        className={cn(
            "absolute top-3 left-3 z-10 transition-all duration-300",
            isSelected ? "opacity-100 scale-100" : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
        )}
        onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
        }}
    >
        <div className={cn(
            "w-5 h-5 rounded border flex items-center justify-center transition-colors",
            isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-background/80 border-border/60 hover:border-primary/50"
        )}>
            {isSelected && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
            )}
        </div>
    </div>
);

const ProjectCardMenu: React.FC<{
    project: Project
    showMenu: boolean
    setShowMenu: (id: string | null) => void
    onEdit: (project: Project, e: React.MouseEvent) => void
    onDelete: (project: Project, e: React.MouseEvent) => void
    onArchive: (project: Project) => void
    t: (key: string) => string
}> = ({ project, showMenu, setShowMenu, onEdit, onDelete, onArchive, t }) => (
    <div className="relative">
        <button
            onClick={(e) => {
                e.stopPropagation();
                setShowMenu(showMenu ? null : project.id);
            }}
            className={cn(
                "p-1.5 rounded-md hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors",
                showMenu ? "opacity-100 bg-muted/30 text-foreground" : "opacity-0 group-hover:opacity-100"
            )}
        >
            <MoreVertical className="w-4 h-4" />
        </button>

        {showMenu && (
            <>
                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMenu(null); }} />
                <div
                    className="absolute right-0 top-full mt-1 w-40 bg-card border border-border/50 rounded-lg shadow-xl z-50 py-1"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={(e) => onEdit(project, e)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/20 transition-colors text-left"
                    >
                        <Pencil className="w-3.5 h-3.5 text-blue-400" />
                        {t('common.edit')}
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onArchive(project); setShowMenu(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/20 transition-colors text-left"
                    >
                        <Archive className="w-3.5 h-3.5 text-emerald-400" />
                        {project.status === 'archived' ? t('common.unarchive') || 'Unarchive' : t('projects.archiveProject')}
                    </button>
                    <button
                        onClick={(e) => onDelete(project, e)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-red-500/10 text-red-400 hover:bg-red-500/10 transition-colors text-left"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('common.delete')}
                    </button>
                </div>
            </>
        )}
    </div>
);

const ProjectCardInfo: React.FC<{ project: Project }> = ({ project }) => (
    <div>
        <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors truncate">
            {project.title}
        </h3>
        <p className="text-xs text-muted-foreground/60 truncate mt-1 font-mono">
            {project.path}
        </p>
    </div>
);

const ProjectCardFooter: React.FC<{ project: Project; t: (key: string) => string }> = ({ project, t }) => (
    <div className="pt-4 border-t border-border/40 mt-auto flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(project.createdAt).toLocaleDateString()}
        </span>
        <span className={cn("px-2 py-0.5 rounded-full bg-muted/50 uppercase text-[10px] font-bold tracking-wider", project.status === 'active' ? "text-emerald-500" : "")}>
            {project.status === 'active' ? t('common.active') : project.status}
        </span>
    </div>
);

export const ProjectCard = memo<ProjectCardProps>(({
    project, index, onSelect, showMenu, setShowMenu, onEdit, onDelete, onArchive, isSelected, onToggleSelection, t
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelect(project)}
            className={cn(
                "group bg-card border border-border/60 rounded-xl p-5 cursor-pointer transition-all hover:shadow-xl hover:shadow-black/5 flex flex-col gap-4 relative overflow-hidden",
                isSelected ? "border-primary/50 bg-primary/5" : "hover:border-foreground/20"
            )}
        >
            <ProjectSelectionCheckbox isSelected={isSelected} onToggle={onToggleSelection} />

            <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary overflow-hidden shadow-inner border border-border/50 ml-6">
                    {project.logo ? (
                        <img src={`safe-file://${project.logo}`} alt={project.title} className="w-full h-full object-cover" />
                    ) : (
                        <Terminal className="w-5 h-5" />
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="w-5 h-5 text-muted-foreground -rotate-44 group-hover:rotate-0 transition-transform duration-300" />
                    </div>

                    <ProjectCardMenu
                        project={project}
                        showMenu={showMenu}
                        setShowMenu={setShowMenu}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onArchive={onArchive}
                        t={t}
                    />
                </div>
            </div>

            <ProjectCardInfo project={project} />
            <ProjectCardFooter project={project} t={t} />
        </motion.div>
    );
});

ProjectCard.displayName = 'ProjectCard';
