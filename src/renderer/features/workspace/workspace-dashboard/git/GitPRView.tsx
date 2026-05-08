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
    IconCheck, 
    IconChecks, 
    IconChevronLeft, 
    IconChevronRight, 
    IconExternalLink, 
    IconGitBranch,
    IconGitMerge, 
    IconGitPullRequest, 
    IconLoader2, 
    IconMessageCircle, 
    IconRefresh, 
    IconX 
} from '@tabler/icons-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarkdownContent } from '@/features/chat/components/message/MarkdownContent';
import { cn } from '@/lib/utils';

export interface GitHubUser {
    login: string;
    avatar_url: string;
}

export interface GitHubLabel {
    id: number;
    name: string;
    color: string;
}

export interface GitHubPR {
    id: number;
    number: number;
    title: string;
    state: string;
    merged: boolean;
    draft: boolean;
    created_at: string;
    html_url: string;
    user: GitHubUser;
    labels: GitHubLabel[];
    body: string;
    base: { ref: string };
    head: { ref: string };
    additions: number;
    deletions: number;
    mergeable?: boolean;
}

export interface GitHubComment {
    id: number;
    user: GitHubUser;
    created_at: string;
    body: string;
}

export interface GitHubFile {
    sha: string;
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
}

export interface GitHubReview {
    id: number;
    user: GitHubUser;
    state: string;
}

export interface GitHubCheck {
    conclusion: string;
}

export interface PRDetails {
    pr: GitHubPR;
    comments: GitHubComment[];
    files: GitHubFile[];
    reviews: GitHubReview[];
    checks: GitHubCheck[];
}

interface GitPRDetailsViewProps {
    prDetails: PRDetails;
    isUpdatingPr: boolean;
    handleSelectPr: (num: number | null) => void;
    handleUpdatePrState: (num: number, state: 'open' | 'closed') => void;
    handleMergePr: (num: number) => void;
    handleApprovePr: (num: number) => void;
    t: (key: string) => string;
}

export const GitPRDetailsView: React.FC<GitPRDetailsViewProps> = ({
    prDetails,
    isUpdatingPr,
    handleSelectPr,
    handleUpdatePrState,
    handleMergePr,
    handleApprovePr,
    t
}) => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* PR Header / Back Button */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl bg-muted/5 hover:bg-muted/10 border border-border/10"
                        onClick={() => { handleSelectPr(null); }}
                    >
                        <IconChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="space-y-0.5">
                        <h3 className="text-xl font-bold tracking-tight">{prDetails.pr.title} <span className="text-muted-foreground/40 font-normal ml-1">#{prDetails.pr.number}</span></h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge className={cn(
                                "h-5 px-2 text-[10px] font-bold uppercase tracking-wider",
                                prDetails.pr.merged ? "bg-purple-500/10 text-purple-500 border-purple-500/20" :
                                    prDetails.pr.state === 'open' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                        "bg-destructive/10 text-destructive border-destructive/20"
                            )}>
                                {prDetails.pr.merged ? 'merged' : prDetails.pr.state}
                            </Badge>
                            {prDetails.pr.draft && (
                                <Badge variant="outline" className="h-5 px-2 text-[10px] font-bold uppercase tracking-wider border-muted-foreground/30 text-muted-foreground/60">
                                    draft
                                </Badge>
                            )}
                            <span>•</span>
                            <div className="flex items-center gap-1.5 font-medium text-foreground/70">
                                <img src={prDetails.pr.user.avatar_url} className="w-4 h-4 rounded-full" alt={prDetails.pr.user.login} />
                                {prDetails.pr.user.login}
                            </div>
                            <span>•</span>
                            <span>{new Date(prDetails.pr.created_at).toLocaleDateString()}</span>
                        </div>
                        {prDetails.pr.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {prDetails.pr.labels.map((label: GitHubLabel) => (
                                    <span
                                        key={label.id}
                                        className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight"
                                        style={{ backgroundColor: `#${label.color}20`, color: `#${label.color}`, border: `1px solid #${label.color}40` }}
                                    >
                                        {label.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {prDetails.pr.state === 'open' && !prDetails.pr.merged && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-2 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10"
                                onClick={() => { handleApprovePr(prDetails.pr.number); }}
                                disabled={isUpdatingPr}
                            >
                                <IconChecks className="w-4 h-4" />
                                Approve
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                className="h-8 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                                onClick={() => { handleMergePr(prDetails.pr.number); }}
                                disabled={isUpdatingPr || prDetails.pr.mergeable === false}
                            >
                                {isUpdatingPr ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconGitMerge className="w-4 h-4" />}
                                Merge
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-2 text-destructive hover:bg-destructive/10 border-destructive/20"
                                onClick={() => { handleUpdatePrState(prDetails.pr.number, 'closed'); }}
                                disabled={isUpdatingPr}
                            >
                                <IconX className="w-4 h-4" />
                                Close
                            </Button>
                        </>
                    )}
                    {prDetails.pr.state === 'closed' && !prDetails.pr.merged && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2 text-emerald-500 hover:bg-emerald-500/10 border-emerald-500/20"
                            onClick={() => { handleUpdatePrState(prDetails.pr.number, 'open'); }}
                            disabled={isUpdatingPr}
                        >
                            <IconRefresh className="w-4 h-4" />
                            Reopen
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                        onClick={() => window.open(prDetails.pr.html_url, '_blank')}
                    >
                        <IconExternalLink className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* PR Body / Description */}
            {prDetails.pr.body && (
                <div className="p-6 rounded-2xl bg-muted/5 border border-border/40 space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        <IconMessageCircle className="w-3.5 h-3.5" />
                        Description
                    </div>
                    <div className="text-sm text-foreground/80 leading-relaxed">
                        <MarkdownContent content={prDetails.pr.body} t={t} />
                    </div>
                </div>
            )}

            {/* PR Stats / Info */}
            <div className="grid grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-muted/5 border border-border/20 flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Base</span>
                    <div className="flex items-center gap-1.5 text-xs font-semibold truncate">
                        <IconGitBranch className="w-3.5 h-3.5 text-primary/60" />
                        {prDetails.pr.base.ref}
                    </div>
                </div>
                <div className="p-4 rounded-xl bg-muted/5 border border-border/20 flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Head</span>
                    <div className="flex items-center gap-1.5 text-xs font-semibold truncate">
                        <IconGitBranch className="w-3.5 h-3.5 text-indigo-500/60" />
                        {prDetails.pr.head.ref}
                    </div>
                </div>
                <div className="p-4 rounded-xl bg-muted/5 border border-border/20 flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Changes</span>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                        <span className="text-emerald-500">+{prDetails.pr.additions}</span>
                        <span className="text-destructive">-{prDetails.pr.deletions}</span>
                    </div>
                </div>
                <div className="p-4 rounded-xl bg-muted/5 border border-border/20 flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Checks</span>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                        {prDetails.checks.length > 0 ? (
                            <>
                                {prDetails.checks.every((c: GitHubCheck) => c.conclusion === 'success') ? (
                                    <span className="flex items-center gap-1 text-emerald-500"><IconCheck className="w-3.5 h-3.5" /> All pass</span>
                                ) : prDetails.checks.some((c: GitHubCheck) => c.conclusion === 'failure') ? (
                                    <span className="flex items-center gap-1 text-destructive"><IconX className="w-3.5 h-3.5" /> Failing</span>
                                ) : (
                                    <span className="flex items-center gap-1 text-amber-500"><IconLoader2 className="w-3.5 h-3.5 animate-spin" /> Pending</span>
                                )}
                            </>
                        ) : <span className="text-muted-foreground/40 italic">No checks</span>}
                    </div>
                </div>
            </div>

            {/* Reviewers Section */}
            {prDetails.reviews.length > 0 && (
                <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/40">Reviewers</h4>
                    <div className="flex flex-wrap gap-3">
                        {Array.from(new Map(prDetails.reviews.map((r: GitHubReview) => [r.user.login, r])).values()).map((review: GitHubReview) => (
                            <div key={review.id} className="flex items-center gap-2 p-2 px-3 rounded-full bg-muted/5 border border-border/20">
                                <img src={review.user.avatar_url} className="w-4 h-4 rounded-full" alt={review.user.login} />
                                <span className="text-xs font-medium">{review.user.login}</span>
                                <Badge className={cn(
                                    "h-4 px-1.5 text-[8px] font-bold uppercase tracking-tighter",
                                    review.state === 'APPROVED' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                        review.state === 'CHANGES_REQUESTED' ? "bg-destructive/10 text-destructive border-destructive/20" :
                                            "bg-muted text-muted-foreground border-transparent"
                                )}>
                                    {review.state.replace('_', ' ')}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Files Changed */}
            <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/40">Files Changed ({prDetails.files.length})</h4>
                <div className="grid gap-2">
                    {prDetails.files.map((file: GitHubFile) => (
                        <FileDiffItem key={file.sha} file={file} t={t} />
                    ))}
                </div>
            </div>

            {/* Comments Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/40">Activity</h4>
                    <Badge variant="outline" className="h-5 px-1.5 opacity-50">{prDetails.comments.length} comments</Badge>
                </div>
                <div className="space-y-4">
                    {prDetails.comments.map((comment: GitHubComment) => (
                        <div key={comment.id} className="flex gap-4 group">
                            <img src={comment.user.avatar_url} className="w-8 h-8 rounded-full shrink-0 border border-border/20" alt={comment.user.login} />
                            <div className="flex-1 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold">{comment.user.login}</span>
                                    <span className="text-[10px] text-muted-foreground/50">{new Date(comment.created_at).toLocaleString()}</span>
                                </div>
                                <div className="text-sm text-foreground/80 bg-muted/5 p-4 rounded-2xl rounded-tl-none border border-border/20">
                                    <MarkdownContent content={comment.body} t={t} />
                                </div>
                            </div>
                        </div>
                    ))}
                    {prDetails.comments.length === 0 && (
                        <div className="py-12 text-center border-2 border-dashed border-border/20 rounded-2xl">
                            <IconMessageCircle className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground/40 font-medium">No activity yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const GitPRListView: React.FC<{
    pullRequests: GitHubPR[];
    handleSelectPr: (num: number) => void;
}> = ({ pullRequests, handleSelectPr }) => {
    return (
        <div className="grid gap-3">
            {pullRequests.map((pr: GitHubPR) => (
                <div
                    key={pr.id}
                    className="group p-4 rounded-xl border border-border/50 bg-muted/5 hover:bg-muted/10 transition-all flex items-start justify-between gap-4 cursor-pointer"
                    onClick={() => { handleSelectPr(pr.number); }}
                >
                    <div className="flex items-start gap-4">
                        <div className="mt-1">
                            <IconGitPullRequest className={cn("w-5 h-5", pr.state === 'open' ? "text-emerald-500" : "text-purple-500")} />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{pr.title}</span>
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-bold tracking-wider bg-background/50 border-border/50">
                                    #{pr.number}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <img src={pr.user.avatar_url} className="w-4 h-4 rounded-full" alt={pr.user.login} />
                                    <span className="font-medium text-foreground/80">{pr.user.login}</span>
                                </div>
                                <span>•</span>
                                <span>{new Date(pr.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(pr.html_url, '_blank');
                        }}
                    >
                        <IconExternalLink className="w-4 h-4" />
                    </Button>
                </div>
            ))}
        </div>
    );
};

const FileDiffItem: React.FC<{ file: GitHubFile; t: (key: string) => string }> = ({ file, t: _t }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="rounded-xl border border-border/20 bg-muted/5 overflow-hidden">
            <div
                className="p-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/10 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                        "transition-transform duration-200",
                        isExpanded ? "rotate-90" : ""
                    )}>
                        <IconChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                    </div>
                    <div className={cn(
                        "w-1.5 h-1.5 rounded-full flex-shrink-0",
                        file.status === 'added' ? "bg-emerald-500" :
                            file.status === 'removed' ? "bg-destructive" :
                                "bg-amber-500"
                    )} />
                    <span className="text-xs font-medium truncate text-foreground/80">{file.filename}</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold">
                        <span className="text-emerald-500">+{file.additions}</span>
                        <span className="text-destructive">-{file.deletions}</span>
                    </div>
                    {file.status !== 'renamed' && (
                        <div className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter bg-muted/20 border border-border/20 text-muted-foreground/60">
                            {file.status}
                        </div>
                    )}
                </div>
            </div>
            {isExpanded && file.patch && (
                <div className="border-t border-border/20 bg-background/40">
                    <div className="p-4 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre">
                        {file.patch.split('\n').map((line, i) => {
                            const isAdded = line.startsWith('+') && !line.startsWith('+++');
                            const isRemoved = line.startsWith('-') && !line.startsWith('---');
                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        "px-2 -mx-2",
                                        isAdded ? "bg-emerald-500/10 text-emerald-500" :
                                            isRemoved ? "bg-destructive/10 text-destructive" :
                                                line.startsWith('@@') ? "bg-primary/5 text-primary/60 font-bold" :
                                                    "text-muted-foreground/70"
                                    )}
                                >
                                    {line}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
