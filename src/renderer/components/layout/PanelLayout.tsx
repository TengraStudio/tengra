/**
 * VSCode-like Panel Layout System
 * Supports draggable, resizable panels with docking zones.
 */

import { ChevronDown, ChevronRight, Maximize2, X } from 'lucide-react';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

// Types
export type PanelPosition = 'left' | 'right' | 'bottom' | 'center'
export type PanelSize = 'small' | 'medium' | 'large' | number

export interface Panel {
    id: string
    title: string
    icon?: React.ReactNode
    content: React.ReactNode
    position: PanelPosition
    size?: PanelSize
    minSize?: number
    maxSize?: number
    closable?: boolean
    collapsible?: boolean
    collapsed?: boolean
    order?: number
}

export interface PanelGroup {
    id: string
    position: PanelPosition
    panels: Panel[]
    activePanel?: string
    size?: number
    collapsed?: boolean
}

interface LayoutState {
    groups: Record<string, PanelGroup>
    activePanel: string | null
}

interface PanelLayoutContextType {
    state: LayoutState
    addPanel: (panel: Panel) => void
    removePanel: (panelId: string) => void
    movePanel: (panelId: string, newPosition: PanelPosition) => void
    setActivePanel: (groupId: string, panelId: string) => void
    toggleCollapse: (groupId: string) => void
    resizeGroup: (groupId: string, size: number) => void
}

const PanelLayoutContext = createContext<PanelLayoutContextType | null>(null);

export const usePanelLayout = () => {
    const context = useContext(PanelLayoutContext);
    if (!context) { throw new Error('usePanelLayout must be used within PanelLayoutProvider'); }
    return context;
};

// Default sizes
const DEFAULT_SIZES: Record<PanelPosition, number> = {
    left: 250,
    right: 300,
    bottom: 200,
    center: 0 // Center takes remaining space
};

// Panel Tab Component
const PanelTab: React.FC<{
    panel: Panel
    isActive: boolean
    onClick: () => void
    onClose?: (() => void) | undefined
}> = ({ panel, isActive, onClick, onClose }) => (
    <div
        onClick={onClick}
        className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium cursor-pointer border-b-2 transition-colors",
            isActive
                ? "border-primary text-foreground bg-muted/50"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
        )}
    >
        {panel.icon && <span className="w-4 h-4">{panel.icon}</span>}
        <span className="truncate max-w-[120px]">{panel.title}</span>
        {panel.closable !== false && onClose && (
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="ml-1 p-0.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <X className="w-3 h-3" />
            </button>
        )}
    </div>
);

// Panel Header Component
const PanelHeader: React.FC<{
    group: PanelGroup
    onToggleCollapse?: () => void
    onMaximize?: () => void
}> = ({ group, onToggleCollapse, onMaximize }) => {
    const { removePanel, setActivePanel } = usePanelLayout();

    if (group.panels.length === 0) { return null; }

    return (
        <div className="flex items-center justify-between border-b border-border/30 bg-card/50">
            <div className="flex items-center overflow-x-auto hide-scrollbar">
                {group.panels.map(panel => (
                    <PanelTab
                        key={panel.id}
                        panel={panel}
                        isActive={panel.id === group.activePanel}
                        onClick={() => setActivePanel(group.id, panel.id)}
                        {...(panel.closable !== false ? { onClose: () => removePanel(panel.id) } : {})}
                    />
                ))}
            </div>
            <div className="flex items-center gap-1 px-2">
                {group.position !== 'center' && onToggleCollapse && (
                    <button
                        onClick={onToggleCollapse}
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                        title={group.collapsed ? "Expand" : "Collapse"}
                    >
                        {group.collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                )}
                {onMaximize && (
                    <button
                        onClick={onMaximize}
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                        title="Maximize"
                    >
                        <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
};

// Resizer Component
const Resizer: React.FC<{
    direction: 'horizontal' | 'vertical'
    onResize: (delta: number) => void
}> = ({ direction, onResize }) => {
    const [isDragging, setIsDragging] = useState(false);
    const startPosRef = useRef(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
    };

    useEffect(() => {
        if (!isDragging) { return; }

        const handleMouseMove = (e: MouseEvent) => {
            const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
            const delta = currentPos - startPosRef.current;
            onResize(delta);
            startPosRef.current = currentPos;
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, direction, onResize]);

    return (
        <div
            onMouseDown={handleMouseDown}
            className={cn(
                "flex-shrink-0 transition-colors hover:bg-primary/30",
                direction === 'horizontal'
                    ? "w-1 cursor-col-resize hover:w-1.5"
                    : "h-1 cursor-row-resize hover:h-1.5",
                isDragging && "bg-primary/50"
            )}
        />
    );
};

// Panel Group Component
const PanelGroupView: React.FC<{
    group: PanelGroup
    style?: React.CSSProperties
    className?: string
}> = ({ group, style, className }) => {
    const { toggleCollapse } = usePanelLayout();
    const activePanel = group.panels.find(p => p.id === group.activePanel) ?? group.panels[0];

    if (group.panels.length === 0) { return null; }

    return (
        <div
            className={cn(
                "flex flex-col bg-card/30 border border-border/20 rounded-lg overflow-hidden",
                group.collapsed && "w-10",
                className
            )}
            style={style}
        >
            <PanelHeader
                group={group}
                onToggleCollapse={() => toggleCollapse(group.id)}
            />
            {group.collapsed ? null : (
                <div className="flex-1 overflow-auto">
                    {activePanel.content}
                </div>
            )}
        </div>
    );
};

// Main Layout Provider
export const PanelLayoutProvider: React.FC<{
    children: React.ReactNode
    initialPanels?: Panel[]
}> = ({ children, initialPanels = [] }) => {
    const [state, setState] = useState<LayoutState>(() => {
        // Initialize groups
        const groups: Record<string, PanelGroup> = {
            left: { id: 'left', position: 'left', panels: [], size: DEFAULT_SIZES.left },
            right: { id: 'right', position: 'right', panels: [], size: DEFAULT_SIZES.right },
            bottom: { id: 'bottom', position: 'bottom', panels: [], size: DEFAULT_SIZES.bottom },
            center: { id: 'center', position: 'center', panels: [] }
        };

        // Distribute initial panels
        for (const panel of initialPanels) {
            const group = groups[panel.position];
            group.panels.push(panel);
            group.activePanel = group.activePanel ?? panel.id;
        }

        return { groups, activePanel: null };
    });

    const addPanel = useCallback((panel: Panel) => {
        setState(prev => {
            const newGroups = { ...prev.groups };
            const group = newGroups[panel.position];
            group.panels = [...group.panels, panel];
            group.activePanel = panel.id;
            return { ...prev, groups: newGroups };
        });
    }, []);

    const removePanel = useCallback((panelId: string) => {
        setState(prev => {
            const newGroups = { ...prev.groups };
            for (const group of Object.values(newGroups)) {
                const index = group.panels.findIndex(p => p.id === panelId);
                if (index >= 0) {
                    group.panels = group.panels.filter(p => p.id !== panelId);
                    if (group.activePanel === panelId) {
                        group.activePanel = group.panels[0]?.id ?? '';
                    }
                    break;
                }
            }
            return { ...prev, groups: newGroups };
        });
    }, []);

    const movePanel = useCallback((panelId: string, newPosition: PanelPosition) => {
        setState(prev => {
            const newGroups = { ...prev.groups };
            let movedPanel: Panel | undefined;

            // Find and remove from current position
            for (const group of Object.values(newGroups)) {
                const index = group.panels.findIndex(p => p.id === panelId);
                if (index >= 0) {
                    const panelAtIndex = group.panels[index];
                    movedPanel = { ...panelAtIndex, position: newPosition };
                    group.panels = group.panels.filter(p => p.id !== panelId);
                    if (group.activePanel === panelId) {
                        group.activePanel = group.panels[0]?.id ?? '';
                    }
                    break;
                }
            }

            // Add to new position
            if (movedPanel) {
                const targetGroup = newGroups[newPosition];
                targetGroup.panels = [...targetGroup.panels, movedPanel];
                targetGroup.activePanel = movedPanel.id;
            }

            return { ...prev, groups: newGroups };
        });
    }, []);

    const setActivePanel = useCallback((groupId: string, panelId: string) => {
        setState(prev => {
            const newGroups = { ...prev.groups };
            const group = newGroups[groupId];
            group.activePanel = panelId;
            return { ...prev, groups: newGroups, activePanel: panelId };
        });
    }, []);

    const toggleCollapse = useCallback((groupId: string) => {
        setState(prev => {
            const newGroups = { ...prev.groups };
            const group = newGroups[groupId];
            group.collapsed = !group.collapsed;
            return { ...prev, groups: newGroups };
        });
    }, []);

    const resizeGroup = useCallback((groupId: string, size: number) => {
        setState(prev => {
            const newGroups = { ...prev.groups };
            const group = newGroups[groupId];
            group.size = Math.max(50, Math.min(size, 600));
            return { ...prev, groups: newGroups };
        });
    }, []);

    const contextValue: PanelLayoutContextType = {
        state,
        addPanel,
        removePanel,
        movePanel,
        setActivePanel,
        toggleCollapse,
        resizeGroup
    };

    return (
        <PanelLayoutContext.Provider value={contextValue}>
            {children}
        </PanelLayoutContext.Provider>
    );
};

interface SidebarProps {
    group: PanelGroup;
    size: number;
    onResize: (delta: number) => void;
    direction: 'left' | 'right';
}

const Sidebar: React.FC<SidebarProps> = ({ group, size, onResize, direction }) => {
    if (group.panels.length === 0 || group.collapsed) { return null; }
    
    return direction === 'left' ? (
        <>
            <PanelGroupView group={group} style={{ width: size }} className="flex-shrink-0" />
            <Resizer direction="horizontal" onResize={onResize} />
        </>
    ) : (
        <>
            <Resizer direction="horizontal" onResize={onResize} />
            <PanelGroupView group={group} style={{ width: size }} className="flex-shrink-0" />
        </>
    );
};

interface BottomPanelViewProps {
    group: PanelGroup;
    size: number;
    onResize: (delta: number) => void;
}

const BottomPanelView: React.FC<BottomPanelViewProps> = ({ group, size, onResize }) => {
    if (group.panels.length === 0 || group.collapsed) { return null; }
    
    return (
        <>
            <Resizer direction="vertical" onResize={onResize} />
            <PanelGroupView group={group} style={{ height: size }} className="flex-shrink-0" />
        </>
    );
};

interface CenterAreaProps {
    group: PanelGroup;
    children?: React.ReactNode;
}

const CenterArea: React.FC<CenterAreaProps> = ({ group, children }) => (
    <div className="flex-1 flex min-h-0 overflow-hidden">
        {group.panels.length > 0 ? (
            <PanelGroupView group={group} className="flex-1" />
        ) : (
            <div className="flex-1 overflow-auto">{children}</div>
        )}
    </div>
);

// Main Layout Component
export const PanelLayout: React.FC<{
    children?: React.ReactNode
    className?: string
}> = ({ children, className }) => {
    const { state, resizeGroup } = usePanelLayout();
    const { left, right, bottom, center } = state.groups;

    const handleLeftResize = useCallback((delta: number) => {
        resizeGroup('left', (left.size ?? DEFAULT_SIZES.left) + delta);
    }, [left.size, resizeGroup]);

    const handleRightResize = useCallback((delta: number) => {
        resizeGroup('right', (right.size ?? DEFAULT_SIZES.right) - delta);
    }, [right.size, resizeGroup]);

    const handleBottomResize = useCallback((delta: number) => {
        resizeGroup('bottom', (bottom.size ?? DEFAULT_SIZES.bottom) - delta);
    }, [bottom.size, resizeGroup]);

    return (
        <div className={cn("flex flex-col h-full w-full overflow-hidden", className)}>
            <div className="flex-1 flex overflow-hidden">
                <Sidebar group={left} size={left.size ?? DEFAULT_SIZES.left} onResize={handleLeftResize} direction="left" />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <CenterArea group={center}>{children}</CenterArea>
                    <BottomPanelView group={bottom} size={bottom.size ?? DEFAULT_SIZES.bottom} onResize={handleBottomResize} />
                </div>
                <Sidebar group={right} size={right.size ?? DEFAULT_SIZES.right} onResize={handleRightResize} direction="right" />
            </div>
        </div>
    );
};

export default PanelLayout;
