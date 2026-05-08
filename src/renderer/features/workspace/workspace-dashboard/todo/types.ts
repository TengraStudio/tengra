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
    IconAlertCircle, 
    IconBulb, 
    IconCircle, 
    IconCircleCheck, 
    IconClock, 
    IconFlag 
} from '@tabler/icons-react';
import React from 'react';

export type TaskStatus = 'idea' | 'in_progress' | 'approved' | 'upcoming' | 'bug';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SubTask {
    id: string;
    title: string;
    completed: boolean;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    estimation?: string;
    deadline?: string;
    subtasks: SubTask[];
    createdAt: number;
    dependencies?: string[];
    recurring?: 'daily' | 'weekly' | 'monthly' | 'none';
}

export const CATEGORIES: { id: TaskStatus; labelKey: string; icon: React.ElementType; color: string }[] = [
    { id: 'idea', labelKey: 'categoryIdea', icon: IconBulb, color: 'text-amber-500' },
    { id: 'upcoming', labelKey: 'categoryUpcoming', icon: IconClock, color: 'text-slate-400' },
    { id: 'in_progress', labelKey: 'categoryInProgress', icon: IconCircle, color: 'text-blue-500' },
    { id: 'approved', labelKey: 'categoryApproved', icon: IconCircleCheck, color: 'text-emerald-500' },
    { id: 'bug', labelKey: 'categoryBug', icon: IconAlertCircle, color: 'text-rose-500' },
];

export const PRIORITY_CONFIG: Record<TaskPriority, { icon: React.ElementType; color: string; labelKey: string }> = {
    low: { icon: IconFlag, color: 'text-emerald-500', labelKey: 'priorityLow' },
    medium: { icon: IconFlag, color: 'text-blue-500', labelKey: 'priorityMedium' },
    high: { icon: IconFlag, color: 'text-amber-400', labelKey: 'priorityHigh' },
    urgent: { icon: IconAlertCircle, color: 'text-rose-500', labelKey: 'priorityUrgent' },
};
