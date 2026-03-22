import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import React, { useRef } from 'react';

import { SettingsCategory } from '@/features/settings/types';
import { Workspace } from '@/types';
import { preloadViewResources } from '@/views/view-manager/view-loaders';

import { SidebarItem } from './SidebarItem';
import { SidebarSettingsMenu } from './SidebarSettingsMenu';

interface SidebarFooterProps {
    isCollapsed: boolean;
    selectedWorkspace: Workspace | null;
    currentView: string;
    showSettingsMenu: boolean;
    toggleSettingsMenu: () => void;
    toggleSidebar: () => void;
    onOpenSettings: (category?: SettingsCategory) => void;
    t: (key: string) => string;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
    isCollapsed,
    selectedWorkspace,
    currentView,
    showSettingsMenu,
    toggleSettingsMenu,
    toggleSidebar,
    onOpenSettings,
    t,
}) => {
    const settingsPreloadedRef = useRef(false);

    const preloadSettingsView = () => {
        if (settingsPreloadedRef.current) {
            return;
        }
        settingsPreloadedRef.current = true;
        void preloadViewResources('settings');
    };

    return (
        <div className="p-2 border-t border-border/30 space-y-1">
            {selectedWorkspace && !isCollapsed && (
                <div className="px-2 py-1.5 bg-muted/30 rounded-md mb-1">
                    <p className="text-xxs text-muted-foreground/50 uppercase">
                        {t('sidebar.workspace')}
                    </p>
                    <p className="text-xs font-medium truncate">{selectedWorkspace.title}</p>
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
                    onMouseEnter={preloadSettingsView}
                    onFocus={preloadSettingsView}
                    isCollapsed={isCollapsed}
                    iconClassName={`transition-transform duration-700 ease-in-out ${showSettingsMenu ? 'rotate-180' : 'group-hover/item:rotate-180'}`}
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
                <div className="transition-transform">
                    {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                    ) : (
                        <ChevronLeft className="w-4 h-4" />
                    )}
                </div>
            </button>
        </div>
    );
};

SidebarFooter.displayName = 'SidebarFooter';
