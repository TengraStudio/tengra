import { ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import React from 'react'

import { SettingsCategory } from '@/features/settings/types'
import { Project } from '@/types'

import { SidebarItem } from './SidebarItem'
import { SidebarSettingsMenu } from './SidebarSettingsMenu'

interface SidebarFooterProps {
    isCollapsed: boolean
    selectedProject: Project | null
    currentView: string
    showSettingsMenu: boolean
    toggleSettingsMenu: () => void
    toggleSidebar: () => void
    onOpenSettings: (category?: SettingsCategory) => void
    t: (key: string) => string
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
    isCollapsed,
    selectedProject,
    currentView,
    showSettingsMenu,
    toggleSettingsMenu,
    toggleSidebar,
    onOpenSettings,
    t
}) => {
    return (
        <div className="p-2 border-t border-border/30 space-y-1">
            {selectedProject && !isCollapsed && (
                <div className="px-2 py-1.5 bg-muted/30 rounded-md mb-1">
                    <p className="text-[10px] text-muted-foreground/50 uppercase">Project</p>
                    <p className="text-xs font-medium truncate">{selectedProject.title}</p>
                </div>
            )}

            {/* Settings Dropdown */}
            <div className="relative">
                <SidebarItem
                    data-testid="settings-button"
                    icon={Settings}
                    label={t('sidebar.settings')}
                    active={currentView === 'settings' || showSettingsMenu}
                    onClick={toggleSettingsMenu}
                    isCollapsed={isCollapsed}
                />

                {showSettingsMenu && (
                    <SidebarSettingsMenu
                        onOpenSettings={onOpenSettings}
                        onClose={toggleSettingsMenu}
                        t={t}
                    />
                )}
            </div>

            <button
                onClick={toggleSidebar}
                className="w-full flex items-center justify-center p-1.5 text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 rounded-md transition-colors"
            >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
        </div>
    )
}

SidebarFooter.displayName = 'SidebarFooter'
