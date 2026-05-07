/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import React from 'react';

import { UI_PRIMITIVES } from '@/constants/ui-primitives';
import { cn } from '@/lib/utils';

interface SidebarFooterProps {
    isCollapsed: boolean;
    toggleSidebar: () => void;
    t: (key: string) => string;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
    isCollapsed,
    toggleSidebar,
}) => {
    return (
        <div className="flex flex-col gap-1 p-2">
            <button
                onClick={toggleSidebar}
                className={cn(UI_PRIMITIVES.ACTION_BUTTON_GHOST, 'w-full justify-center rounded-lg py-2 opacity-40 hover:opacity-100')}
            >
                <div className="transition-transform duration-300">
                    {isCollapsed ? (
                        <IconChevronRight className="w-4 h-4" />
                    ) : (
                        <IconChevronLeft className="w-4 h-4" />
                    )}
                </div>
            </button>
        </div>
    );
};

SidebarFooter.displayName = 'SidebarFooter';

