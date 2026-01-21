import { ArrowRight, Calendar, MoreVertical, Pencil, Terminal, Trash2 } from 'lucide-react'
import React from 'react'

import { motion } from '@/lib/framer-motion-compat'
import { cn } from '@/lib/utils'
import { Project } from '@/types'

interface ProjectCardProps {
    project: Project
    index: number
    onSelect: (project: Project) => void
    showMenu: boolean
    setShowMenu: (id: string | null) => void
    onEdit: (project: Project, e: React.MouseEvent) => void
    onDelete: (project: Project, e: React.MouseEvent) => void
    t: (key: string) => string
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
    project, index, onSelect, showMenu, setShowMenu, onEdit, onDelete, t
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelect(project)}
            className="group bg-card border border-border/60 hover:border-foreground/20 rounded-xl p-5 cursor-pointer transition-all hover:shadow-xl hover:shadow-black/5 flex flex-col gap-4 relative overflow-hidden"
        >
            <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary overflow-hidden shadow-inner border border-white/5">
                    {project.logo ? (
                        <img src={`safe-file://${project.logo}`} alt={project.title} className="w-full h-full object-cover" />
                    ) : (
                        <Terminal className="w-5 h-5" />
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="w-5 h-5 text-muted-foreground -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                    </div>

                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setShowMenu(showMenu ? null : project.id)
                            }}
                            className={cn(
                                "p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-white transition-colors",
                                showMenu ? "opacity-100 bg-white/10 text-white" : "opacity-0 group-hover:opacity-100"
                            )}
                        >
                            <MoreVertical className="w-4 h-4" />
                        </button>

                        {showMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMenu(null) }} />
                                <div
                                    className="absolute right-0 top-full mt-1 w-40 bg-[#121212] border border-white/10 rounded-lg shadow-xl z-50 py-1"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        onClick={(e) => onEdit(project, e)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors text-left"
                                    >
                                        <Pencil className="w-3.5 h-3.5 text-blue-400" />
                                        {t('common.edit')}
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
                </div>
            </div>

            <div>
                <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors truncate">
                    {project.title}
                </h3>
                <p className="text-xs text-muted-foreground/60 truncate mt-1 font-mono">
                    {project.path}
                </p>
            </div>

            <div className="pt-4 border-t border-border/40 mt-auto flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(project.createdAt).toLocaleDateString()}
                </span>
                <span className={cn("px-2 py-0.5 rounded-full bg-muted/50 uppercase text-[10px] font-bold tracking-wider", project.status === 'active' ? "text-emerald-500" : "")}>
                    {project.status || t('common.active')}
                </span>
            </div>
        </motion.div>
    )
}
