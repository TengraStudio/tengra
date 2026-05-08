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
    IconChartBar, 
    IconChartPie, 
    IconChecklist, 
    IconCircleCheck, 
    IconTrendingUp 
} from '@tabler/icons-react';
import React, { useMemo } from 'react';
import { 
    Bar, 
    BarChart, 
    CartesianGrid, 
    Cell, 
    Pie, 
    PieChart, 
    ResponsiveContainer, 
    Tooltip, 
    XAxis, 
    YAxis 
} from 'recharts';

import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { CATEGORIES, PRIORITY_CONFIG,Task } from './types';

export const TodoAnalytics = ({ tasks }: { tasks: Task[] }) => {
    const { t } = useTranslation();
    const statusData = useMemo(() => {
        return CATEGORIES.map(cat => ({
            name: t(`frontend.workspaceTodo.${cat.labelKey}`),
            value: tasks.filter(t => t.status === cat.id).length,
            color: cat.id === 'bug' ? '#f43f5e' :
                   cat.id === 'approved' ? '#10b981' :
                   cat.id === 'in_progress' ? '#3b82f6' :
                   cat.id === 'upcoming' ? '#8b5cf6' : '#94a3b8'
        })).filter(d => d.value > 0);
    }, [tasks, t]);

    const priorityData = useMemo(() => {
        return Object.entries(PRIORITY_CONFIG).map(([key, config]) => ({
            name: t(`frontend.workspaceTodo.${config.labelKey}`),
            value: tasks.filter(t => t.priority === key).length,
            color: config.color.includes('rose') ? '#f43f5e' :
                   config.color.includes('amber') ? '#f59e0b' :
                   config.color.includes('emerald') ? '#10b981' : '#3b82f6'
        })).reverse();
    }, [tasks, t]);

    const stats = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'approved').length;
        const inProgress = tasks.filter(t => t.status === 'in_progress').length;
        const bugs = tasks.filter(t => t.status === 'bug').length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { total, completed, inProgress, bugs, completionRate };
    }, [tasks]);

    return (
        <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
            <div className="max-w-7xl mx-auto space-y-10">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Tasks', value: stats.total, icon: IconChecklist, color: 'text-primary' },
                        { label: 'Active Progress', value: stats.inProgress, icon: IconTrendingUp, color: 'text-blue-500' },
                        { label: 'Completion Rate', value: `${stats.completionRate}%`, icon: IconCircleCheck, color: 'text-emerald-500' },
                        { label: 'Active Bugs', value: stats.bugs, icon: IconAlertCircle, color: 'text-rose-500' },
                    ].map((s, i) => (
                        <Card key={i} className="p-6 border-border/20 bg-background/5 backdrop-blur-md flex items-center gap-5 group hover:border-primary/20 transition-all">
                            <div className={cn("p-3 rounded-2xl bg-background/20", s.color)}>
                                <s.icon className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{s.label}</span>
                                <span className="text-2xl font-bold tracking-tight">{s.value}</span>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Status Distribution */}
                    <Card className="p-8 border-border/20 bg-background/5 backdrop-blur-md flex flex-col gap-8 h-400">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                                <IconChartPie className="w-4 h-4" /> Status Distribution
                            </h3>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        innerRadius={80}
                                        outerRadius={120}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.6} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.8)', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}
                                        itemStyle={{ color: '#fff', fontSize: '12px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {statusData.map((d, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                    <span className="text-[10px] font-medium text-muted-foreground/60 uppercase">{d.name}</span>
                                    <span className="text-xs font-bold ml-auto">{d.value}</span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Priority Breakdown */}
                    <Card className="p-8 border-border/20 bg-background/5 backdrop-blur-md flex flex-col gap-8 h-400">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                                <IconChartBar className="w-4 h-4" /> Priority Breakdown
                            </h3>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={priorityData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }} width={80} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                        contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.8)', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                        {priorityData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.6} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
