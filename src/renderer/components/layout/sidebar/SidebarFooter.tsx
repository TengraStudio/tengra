import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react'; 


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
        <div className="tengra-sidebar-footer"> 
            <button
                onClick={toggleSidebar}
                className="tengra-sidebar-footer__toggle"
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
