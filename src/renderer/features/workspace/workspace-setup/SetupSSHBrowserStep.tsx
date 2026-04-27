/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { SSHFile } from '@shared/types/ssh';
import { IconArrowRight, IconCode, IconFolderOpen, IconTerminal } from '@tabler/icons-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_WIZARDSSHBROWSERSTEP_1 = "flex items-center gap-2 p-3 bg-muted/10 rounded-lg border border-border/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all";


interface SetupSSHBrowserStepProps {
    sshPath: string;
    setSshPath: (path: string) => void;
    sshFiles: SSHFile[];
    sshConnectionId: string | null;
    loadRemoteDirectory: (connId: string, path: string) => Promise<void>;
}

export const SetupSSHBrowserStep: React.FC<SetupSSHBrowserStepProps> = ({
    sshPath,
    setSshPath,
    sshFiles,
    sshConnectionId,
    loadRemoteDirectory
}) => {
    return (
        <div className="space-y-4 flex-1 pt-4 flex flex-col min-h-0">
            <div className={C_WIZARDSSHBROWSERSTEP_1}>
                <IconTerminal className="w-4 h-4 text-primary shrink-0" />
                <Input
                    value={sshPath}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSshPath(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter' && sshConnectionId) {
                            void loadRemoteDirectory(sshConnectionId, sshPath);
                        }
                    }}
                    className="flex-1 bg-transparent border-none focus-visible:ring-0 shadow-none h-auto py-0 text-sm font-mono p-0"
                />
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => sshConnectionId && void loadRemoteDirectory(sshConnectionId, sshPath)}
                    className="h-8 w-8 hover:bg-muted/40"
                >
                    <IconArrowRight className="w-4 h-4 text-foreground/50" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto bg-muted/10 rounded-xl border border-border/50 p-2 space-y-1">
                {sshPath !== '/' && (
                    <Button
                        variant="ghost"
                        onClick={() => {
                            const parent = sshPath.split('/').slice(0, -1).join('/') || '/';
                            if (sshConnectionId) { void loadRemoteDirectory(sshConnectionId, parent); }
                        }}
                        className="w-full justify-start gap-3 p-2 hover:bg-muted/20 rounded-lg text-left transition-colors group font-normal h-auto"
                    >
                        <IconFolderOpen className="w-4 h-4 text-warning/70 group-hover:text-warning" />
                        <span className="text-sm text-foreground/70 group-hover:text-foreground">..</span>
                    </Button>
                )}
                {sshFiles.map((file, i) => (
                    <Button
                        key={i}
                        variant="ghost"
                        disabled={!file.isDirectory}
                        onClick={() => {
                            if (file.isDirectory && sshConnectionId) {
                                const newPath = sshPath === '/' ? `/${file.name}` : `${sshPath}/${file.name}`;
                                void loadRemoteDirectory(sshConnectionId, newPath);
                            }
                        }}
                        className={cn(
                            "w-full justify-start gap-3 p-2 hover:bg-muted/20 rounded-lg text-left transition-colors group font-normal h-auto",
                            !file.isDirectory && "opacity-50 cursor-default"
                        )}
                    >
                        {file.isDirectory ? (
                            <IconFolderOpen className="w-4 h-4 text-primary/70 group-hover:text-primary" />
                        ) : (
                            <IconCode className="w-4 h-4 text-foreground/30" />
                        )}
                        <span className="text-sm text-foreground/80 group-hover:text-foreground truncate">{file.name}</span>
                    </Button>
                ))}
            </div>
        </div>
    );
};
