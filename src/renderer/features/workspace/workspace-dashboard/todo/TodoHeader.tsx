/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { 
    IconCalendar as CalendarIcon, 
    IconCalendarMonth, 
    IconChevronLeft, 
    IconChevronRight, 
    IconLayoutKanban, 
    IconPlus, 
    IconSearch 
} from '@tabler/icons-react';
import { IconAnalyze } from '@tabler/icons-react';
import { addMonths, addYears, format, subMonths, subYears } from 'date-fns';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TodoHeaderProps {
    view: 'kanban' | 'calendar' | 'week' | 'year' | 'analytics';
    setView: (view: 'kanban' | 'calendar' | 'week' | 'year' | 'analytics') => void;
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    handleAddTask: () => void;
    t: (key: string) => string;
}

export const TodoHeader: React.FC<TodoHeaderProps> = ({
    view,
    setView,
    currentDate,
    setCurrentDate,
    searchQuery,
    setSearchQuery,
    handleAddTask,
    t
}) => {
    return (
        <div className="flex items-center justify-between px-8 h-16 border-b border-border/40 shrink-0 bg-background/50 backdrop-blur-md">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-1.5 p-1 bg-muted/20 rounded-xl border border-border/10">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setView('kanban')}
                        className={cn(
                            "h-8 gap-2 rounded-lg text-xs font-semibold px-4 transition-all",
                            view === 'kanban' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-background/40"
                        )}
                    >
                        <IconLayoutKanban className="w-3.5 h-3.5" /> {t('frontend.workspaceTodo.kanban')}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setView('calendar')}
                        className={cn(
                            "h-8 gap-2 rounded-lg text-xs font-semibold px-4 transition-all",
                            view === 'calendar' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-background/40"
                        )}
                    >
                        <IconCalendarMonth className="w-3.5 h-3.5" /> {t('frontend.workspaceTodo.calendar')}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setView('week')}
                        className={cn(
                            "h-8 gap-2 rounded-lg text-xs font-semibold px-4 transition-all",
                            view === 'week' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-background/40"
                        )}
                    >
                        <CalendarIcon className="w-3.5 h-3.5" /> {t('frontend.workspaceTodo.week')}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setView('year')}
                        className={cn(
                            "h-8 gap-2 rounded-lg text-xs font-semibold px-4 transition-all",
                            view === 'year' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-background/40"
                        )}
                    >
                        <IconCalendarMonth className="w-3.5 h-3.5" /> {t('frontend.workspaceTodo.year')}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setView('analytics')}
                        className={cn(
                            "h-8 gap-2 rounded-lg text-xs font-semibold px-4 transition-all",
                            view === 'analytics' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:bg-background/40"
                        )}
                    >
                        <IconAnalyze className="w-3.5 h-3.5" /> {t('frontend.workspaceTodo.analytics')}
                    </Button>
                </div>

                {(view === 'calendar' || view === 'week' || view === 'year') && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (view === 'year') {setCurrentDate(subYears(currentDate, 1));}
                                    else {setCurrentDate(subMonths(currentDate, 1));}
                                }}
                                className="h-8 w-8 rounded-lg hover:bg-muted"
                            >
                                <IconChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCurrentDate(new Date())}
                                className="h-8 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                            >
                                {t('frontend.workspaceTodo.today')}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (view === 'year') {setCurrentDate(addYears(currentDate, 1));}
                                    else {setCurrentDate(addMonths(currentDate, 1));}
                                }}
                                className="h-8 w-8 rounded-lg hover:bg-muted"
                            >
                                <IconChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                        <h2 className="text-sm font-bold tracking-tight min-w-32 text-center uppercase">
                            {format(currentDate, view === 'year' ? 'yyyy' : 'MMMM yyyy')}
                        </h2>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">
                <div className="relative group">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder={t('frontend.workspaceTodo.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 w-64 pl-9 rounded-xl bg-muted/20 border-transparent focus:bg-background focus:ring-primary/20 transition-all text-xs"
                    />
                </div>
                <Button
                    size="sm"
                    onClick={() => handleAddTask()}
                    className="h-9 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 rounded-xl shadow-lg shadow-primary/20"
                >
                    <IconPlus className="w-4 h-4" /> {t('frontend.workspaceTodo.newTask')}
                </Button>
            </div>
        </div>
    );
};
