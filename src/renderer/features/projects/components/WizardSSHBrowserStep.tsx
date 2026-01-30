import { ArrowRight, Code, FolderOpen, Terminal } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { SSHFile } from '@/types';

interface WizardSSHBrowserStepProps {
    sshPath: string;
    setSshPath: (path: string) => void;
    sshFiles: SSHFile[];
    sshConnectionId: string | null;
    loadRemoteDirectory: (connId: string, path: string) => Promise<void>;
}

export const WizardSSHBrowserStep: React.FC<WizardSSHBrowserStepProps> = ({
    sshPath,
    setSshPath,
    sshFiles,
    sshConnectionId,
    loadRemoteDirectory
}) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-4 flex-1 pt-4 flex flex-col min-h-0">
            <div className="flex items-center gap-2 p-3 bg-muted/10 rounded-lg border border-border/50">
                <Terminal className="w-4 h-4 text-purple-400 shrink-0" />
                <input
                    value={sshPath}
                    onChange={e => setSshPath(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && sshConnectionId) {
                            void loadRemoteDirectory(sshConnectionId, sshPath);
                        }
                    }}
                    className="flex-1 bg-transparent text-sm text-foreground focus:outline-none font-mono"
                />
                <button
                    onClick={() => sshConnectionId && void loadRemoteDirectory(sshConnectionId, sshPath)}
                    className="p-1 hover:bg-muted/40 rounded-md transition-colors"
                >
                    <ArrowRight className="w-4 h-4 text-foreground/50" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-muted/10 rounded-xl border border-border/50 p-2 space-y-1">
                {sshPath !== '/' && (
                    <button
                        onClick={() => {
                            const parent = sshPath.split('/').slice(0, -1).join('/') || '/';
                            if (sshConnectionId) { void loadRemoteDirectory(sshConnectionId, parent); }
                        }}
                        className="w-full flex items-center gap-3 p-2 hover:bg-muted/20 rounded-lg text-left transition-colors group"
                    >
                        <FolderOpen className="w-4 h-4 text-yellow-500/70 group-hover:text-yellow-400" />
                        <span className="text-sm text-foreground/70 group-hover:text-foreground">..</span>
                    </button>
                )}
                {sshFiles.map((file, i) => (
                    <button
                        key={i}
                        onClick={() => {
                            if (file.isDirectory && sshConnectionId) {
                                const newPath = sshPath === '/' ? `/${file.name}` : `${sshPath}/${file.name}`;
                                void loadRemoteDirectory(sshConnectionId, newPath);
                            }
                        }}
                        className={cn(
                            "w-full flex items-center gap-3 p-2 hover:bg-muted/20 rounded-lg text-left transition-colors group",
                            !file.isDirectory && "opacity-50 cursor-default"
                        )}
                    >
                        {file.isDirectory ? (
                            <FolderOpen className="w-4 h-4 text-blue-400/70 group-hover:text-blue-400" />
                        ) : (
                            <Code className="w-4 h-4 text-foreground/30" />
                        )}
                        <span className="text-sm text-foreground/80 group-hover:text-foreground truncate">{file.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
