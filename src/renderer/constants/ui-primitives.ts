/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * UI Primitives
 * Centrally managed utility class strings to improve maintainability and reduce redundancy.
 */

export const UI_PRIMITIVES = {
    // Layout & Containers
    SECTION_CARD: "space-y-6 rounded-3xl border border-border/20 bg-card p-5 sm:p-6 lg:p-8",
    PREVIEW_BOX: "rounded-card-lg border border-border/15 bg-muted/10 p-6 sm:p-8 transition-all hover:border-border/25",
    PANEL_BASE: "flex flex-col h-full w-full overflow-hidden border border-border/60 bg-card",
    OVERLAY_BASE: "absolute inset-0 z-100 flex items-center justify-center bg-background/40 backdrop-blur-sm",
    
    // Rows & Items
    SETTINGS_ROW: "flex flex-col gap-4 rounded-2xl border border-border/15 p-4 transition-colors hover:bg-muted/10 sm:flex-row sm:items-center sm:justify-between",
    MENU_ITEM_BASE: "w-full px-3 py-2 text-left typo-caption font-medium transition-colors flex items-center gap-2 rounded-sm hover:bg-accent/50 text-foreground",
    
    // Inputs & Controls
    CONTROL_BASE: "h-12 rounded-2xl border-border/40 bg-muted/20 px-6 text-sm transition-all focus:ring-primary/20 focus:border-primary/30",
    CONTROL_INPUT: "h-12 rounded-2xl border-border/40 bg-muted/20 px-6 text-sm transition-all focus-visible:ring-primary/20 focus-visible:border-primary/30",
    
    // Icons & Badges
    ICON_WRAPPER: "rounded-2xl bg-primary/10 p-3.5 text-primary shadow-2xl shadow-primary/10 transition-transform duration-700 hover:scale-110",
    BADGE_MUTED: "h-5 border-border/20 px-2 typo-body opacity-60 font-bold",
    
    // Feature Specific
    DETAILS_CARD: "rounded-xl border border-border/40 bg-muted/10 p-4 transition-all duration-300",
    PANEL_HEADER: "p-6 border-b border-border/50 flex items-center justify-between bg-muted/30 backdrop-blur-md",
    PANEL_SUB_HEADER: "flex items-center justify-between px-2 py-1.5 border-b border-border/70",
    MODAL_FOOTER: "flex items-center justify-end gap-3 border-t border-border/10 p-6 bg-muted/5",
    PREVIEW_CARD: "relative overflow-hidden rounded-card-lg border border-border/40 bg-card transition-all hover:border-border/60",
    
    // Interactive
    ACTION_BUTTON_PRIMARY: "group relative flex items-center gap-2 overflow-hidden rounded-2xl bg-primary px-8 py-4 text-sm font-bold text-primary-foreground shadow-2xl shadow-primary/20 transition-all hover:scale-102 hover:bg-primary/90 active:scale-95",
    ACTION_BUTTON_GHOST: "p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-95",
    ITEM_OVERLAY: "absolute inset-0 bg-background/90 backdrop-blur-sm px-3 py-2 flex items-center gap-3 animate-in fade-in duration-200",
    
    // Chat & Tools
    CHAT_BUBBLE_BASE: "rounded-2xl p-2 text-base leading-relaxed whitespace-pre-wrap break-words border-none relative group/bubble w-full overflow-hidden",
    TOOL_CARD: "rounded-xl border border-border/40 bg-card/40 p-3 shadow-sm backdrop-blur-sm",
    TOOL_STATUS_ICON: "flex items-center justify-center h-8 w-8 rounded-full border transition-all duration-300",
    REACTION_BADGE: "rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-xxs transition-colors hover:bg-primary/20",
    CODE_BLOCK: "max-h-52 overflow-x-auto overflow-y-auto rounded-md border border-border/40 bg-muted/40 p-2 font-mono typo-caption text-muted-foreground",
    FILE_LIST_ITEM: "flex items-center gap-2 rounded-lg border border-border/30 bg-background/50 px-3 py-2 text-left hover:border-primary/40 hover:bg-primary/5 transition-all group/file",
    ASSISTANT_LOGO_BASE: "flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted overflow-hidden transition-all duration-300",
    COMMAND_OUTPUT_CONTAINER: "overflow-hidden rounded-lg border border-border/40 bg-terminal-bg",
    COMMAND_OUTPUT_HEADER: "flex items-center justify-between border-b border-border/30 bg-muted/10 px-3 py-2",
    TERMINAL_TAB: "flex items-center gap-2 px-3 py-1.5 rounded-md typo-caption font-medium transition-all whitespace-nowrap border border-transparent min-w-24 max-w-48 flex-shrink-0",

    // Animation Utility
    FADE_SLIDE_IN: "animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out",
} as const;
