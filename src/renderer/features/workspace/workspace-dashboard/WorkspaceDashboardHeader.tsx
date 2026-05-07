import { IconCamera, IconCheck, IconPencil, IconSparkles } from '@tabler/icons-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import type { Workspace } from '@/types';
import { toSafeFileUrl } from '@/utils/safe-file-url.util';

export const WorkspaceDashboardHeader: React.FC<{
    workspace: Workspace;
    workspaceRoot: string;
    type: string;
    isEditingName: boolean;
    setIsEditingName: (val: boolean) => void;
    editName: string;
    setEditName: (val: string) => void;
    handleSaveName: () => Promise<void>;
    isEditingDesc: boolean;
    setIsEditingDesc: (val: boolean) => void;
    editDesc: string;
    setEditDesc: (val: string) => void;
    handleSaveDesc: () => Promise<void>;
    onUploadLogo?: () => void;
}> = ({
    workspace,
    workspaceRoot,
    type,
    isEditingName,
    setIsEditingName,
    editName,
    setEditName,
    handleSaveName,
    isEditingDesc,
    setIsEditingDesc,
    editDesc,
    setEditDesc,
    handleSaveDesc,
    onUploadLogo,
}) => {
        const { t } = useTranslation();
        const baseLogoUrl = toSafeFileUrl(workspace.logo);
        const workspaceLogoUrl = baseLogoUrl && baseLogoUrl.startsWith('data:') ? baseLogoUrl : (baseLogoUrl ? `${baseLogoUrl}?v=${workspace.updatedAt}` : null);

        return (
            <div className="flex flex-col md:flex-row gap-10 items-start">
                {/* Logo Area */}
                <div className="relative group shrink-0">
                    <div className="w-24 h-24 rounded-2xl bg-muted/5 border border-border/5 flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/20">
                        {workspaceLogoUrl ? (
                            <img
                                src={workspaceLogoUrl}
                                alt=""
                                className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                            />
                        ) : (
                            <IconSparkles className="w-8 h-8 text-muted-foreground/10" />
                        )}

                        <button
                            onClick={onUploadLogo}
                            className="absolute inset-0 bg-primary/80 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-primary-foreground"
                        >
                            <IconCamera className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Name & Description Area */}
                <div className="flex-1 space-y-4 w-full">
                    <div className="space-y-1.5 group">
                        {isEditingName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    autoFocus
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') { void handleSaveName(); }
                                        if (e.key === 'Escape') { setIsEditingName(false); }
                                    }}
                                    onBlur={() => { void handleSaveName(); }}
                                    className="text-2xl font-bold bg-transparent border-b border-primary/30 outline-none w-full text-foreground py-1"
                                />
                                <button onClick={() => { void handleSaveName(); }} className="p-1.5 text-primary">
                                    <IconCheck className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <h1
                                onClick={() => { setIsEditingName(true); }}
                                className="text-3xl font-bold text-foreground/90 cursor-pointer hover:text-primary transition-colors flex items-center gap-3 "
                            >
                                {workspace.title}
                                <IconPencil className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40" />
                            </h1>
                        )}
                    </div>

                    <div className="group">
                        {isEditingDesc ? (
                            <div className="space-y-2">
                                <textarea
                                    autoFocus
                                    value={editDesc}
                                    onChange={e => setEditDesc(e.target.value)}
                                    onBlur={() => { void handleSaveDesc(); }}
                                    className="w-full bg-muted/5 border border-border/5 rounded-xl p-4 text-sm text-foreground outline-none min-h-[120px] resize-none leading-relaxed"
                                    placeholder={t('frontend.workspaces.workspaceDescPlaceholder')}
                                />
                            </div>
                        ) : (
                            <p
                                onClick={() => { setIsEditingDesc(true); }}
                                className="text-sm text-muted-foreground/50 leading-relaxed cursor-pointer hover:text-foreground/70 transition-colors max-w-2xl flex items-start gap-2 group"
                            >
                                {workspace.description || t('frontend.workspaces.noDescription')}
                                <IconPencil className="w-3 h-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </p>
                        )}
                    </div> 
                </div>
            </div>
        );
    };

