/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { AlertTriangle, X } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';

/* Batch-02: Extracted Long Classes */
const C_BROWSERCLOSUREMODAL_1 = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200";
const C_BROWSERCLOSUREMODAL_2 = "px-4 py-2 rounded-lg text-sm font-bold bg-warning hover:bg-warning text-foreground shadow-lg shadow-amber-500/20 transition-all";


interface BrowserClosureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    providerName: string;
}

export const BrowserClosureModal: React.FC<BrowserClosureModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    providerName,
}) => {
    const { t } = useTranslation();
    if (!isOpen) {
        return null;
    }

    return (
        <div className={C_BROWSERCLOSUREMODAL_1}>
            <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2 text-warning">
                        <AlertTriangle className="h-5 w-5" />
                        <h3 className="font-bold text-foreground">
                            {t('settings.browserClosure.title')}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {t('settings.browserClosure.description', { provider: providerName })}
                    </p>
                    <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                        <p className="typo-caption font-medium text-warning">
                            {t('settings.browserClosure.warningPrefix')}{' '}
                            <span className="underline decoration-2 underline-offset-2">
                                {t('settings.browserClosure.warningEmphasis')}
                            </span>{' '}
                            {t('settings.browserClosure.warningSuffix')}
                        </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {t('settings.browserClosure.saveWork')}
                    </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-muted/20">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={C_BROWSERCLOSUREMODAL_2}
                    >
                        {t('settings.browserClosure.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};
