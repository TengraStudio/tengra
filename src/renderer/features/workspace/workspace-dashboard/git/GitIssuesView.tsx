/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertCircle, IconExternalLink } from '@tabler/icons-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { GitHubUser } from './GitPRView';

export interface GitHubIssue {
    id: number;
    number: number;
    title: string;
    state: string;
    created_at: string;
    html_url: string;
    user: GitHubUser;
}

export const GitIssuesView: React.FC<{
    issues: GitHubIssue[];
}> = ({ issues }) => {
    return (
        <div className="grid gap-3">
            {issues.map((issue) => (
                <div key={issue.id} className="group p-4 rounded-xl border border-border/50 bg-muted/5 hover:bg-muted/10 transition-all flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="mt-1">
                            <IconAlertCircle className={cn("w-5 h-5", issue.state === 'open' ? "text-emerald-500" : "text-muted-foreground")} />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{issue.title}</span>
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-bold tracking-wider bg-background/50 border-border/50">
                                    #{issue.number}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <img src={issue.user.avatar_url} className="w-4 h-4 rounded-full" alt={issue.user.login} />
                                    <span className="font-medium text-foreground/80">{issue.user.login}</span>
                                </div>
                                <span>•</span>
                                <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                        onClick={() => window.open(issue.html_url, '_blank')}
                    >
                        <IconExternalLink className="w-4 h-4" />
                    </Button>
                </div>
            ))}
        </div>
    );
};
