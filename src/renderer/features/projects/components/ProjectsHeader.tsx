import { Plus, Search } from 'lucide-react'
import React from 'react'

interface ProjectsHeaderProps {
    title: string
    subtitle: string
    newProjectLabel: string
    searchPlaceholder: string
    searchQuery: string
    setSearchQuery: (query: string) => void
    onNewProject: () => void
}

export const ProjectsHeader: React.FC<ProjectsHeaderProps> = ({
    title, subtitle, newProjectLabel, searchPlaceholder, searchQuery, setSearchQuery, onNewProject
}) => {
    return (
        <>
            <div className="flex items-end justify-between border-b border-border/40 pb-6">
                <div>
                    <h1 className="text-3xl font-light tracking-tight text-foreground">
                        {title}
                    </h1>
                    <p className="text-muted-foreground mt-2 font-light">
                        {subtitle}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={onNewProject}
                    className="h-12 px-6 bg-foreground text-background hover:bg-foreground/90 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-black/5"
                >
                    <Plus className="w-5 h-5" />
                    {newProjectLabel}
                </button>

                <div className="flex-1 relative group max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-muted/30 border-none rounded-lg h-12 pl-11 pr-4 text-foreground focus:ring-1 focus:ring-foreground/20 transition-all placeholder:text-muted-foreground/40"
                    />
                </div>
            </div>
        </>
    )
}
