/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Shield } from 'lucide-react';
import { memo, useCallback } from 'react';

/* Batch-02: Extracted Long Classes */
const C_PERMISSIONERRORCARD_1 = "group relative overflow-hidden rounded-3xl border border-destructive/20 bg-destructive/5 p-6 transition-all duration-300 hover:border-destructive/30 hover:bg-destructive/10 lg:p-8";
const C_PERMISSIONERRORCARD_2 = "absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-destructive/10 blur-3xl transition-all duration-500 group-hover:bg-destructive/20";
const C_PERMISSIONERRORCARD_3 = "flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/20 text-destructive shadow-lg shadow-destructive/10 ring-1 ring-destructive/20";
const C_PERMISSIONERRORCARD_4 = "flex h-10 items-center justify-center gap-2 rounded-xl bg-destructive px-6 text-11 font-bold tracking-20 text-destructive-foreground shadow-lg shadow-destructive/20 transition-all hover:-translate-y-0.5 hover:bg-destructive/90 active:translate-y-0";


type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface PermissionErrorCardProps {
    t: TranslationFn;
}

export const PermissionErrorCard = memo(({ t }: PermissionErrorCardProps) => {
    const handleConfigure = useCallback(() => {
        window.dispatchEvent(
            new CustomEvent('tengra:open-model-selector', {
                detail: { tab: 'permissions' },
            })
        );
    }, []);

    return (
        <div className={C_PERMISSIONERRORCARD_1}>
            <div className={C_PERMISSIONERRORCARD_2} />

            <div className="relative flex flex-col gap-5">
                <div className="flex items-center gap-4">
                    <div className={C_PERMISSIONERRORCARD_3}>
                        <Shield className="h-6 w-6" />
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-14 font-bold tracking-20 text-foreground">
                            {t('workspaceAgent.permissions.error')}
                        </h3>
                        <p className="text-11 font-medium text-muted-foreground/70">
                            {t('workspaceAgent.permissions.securityBlock')}
                        </p>
                    </div>
                </div>

                <div className="rounded-2xl border border-destructive/10 bg-background/40 p-4">
                    <p className="text-12 leading-relaxed text-muted-foreground/80">
                        {t('workspaceAgent.permissions.description')}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleConfigure}
                        className={C_PERMISSIONERRORCARD_4}
                    >
                        {t('workspaceAgent.permissions.configure')}
                    </button>
                    <div className="text-10 font-bold tracking-40 text-muted-foreground/40 uppercase">
                        {t('workspaceAgent.permissions.requiresApproval')}
                    </div>
                </div>
            </div>
        </div>
    );
});

PermissionErrorCard.displayName = 'PermissionErrorCard';
