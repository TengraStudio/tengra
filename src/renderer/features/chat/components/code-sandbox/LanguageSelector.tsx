/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n';

type SandboxLanguage = 'javascript' | 'typescript' | 'python' | 'shell';

interface LanguageSelectorProps {
    value: SandboxLanguage;
    onChange: (lang: SandboxLanguage) => void;
    disabled?: boolean;
}

const LANGUAGE_OPTIONS: ReadonlyArray<SandboxLanguage> = [
    'javascript',
    'typescript',
    'python',
    'shell',
];

/** Language selector dropdown for the code sandbox */
export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
    value,
    onChange,
    disabled = false,
}) => {
    const { t } = useTranslation();

    const handleChange = (val: string): void => {
        onChange(val as SandboxLanguage);
    };

    return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('frontend.codeSandbox.languageLabel')}</span>
            <Select value={value} onValueChange={handleChange} disabled={disabled}>
                <SelectTrigger className="h-8 w-120 px-2 py-1 typo-caption">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {LANGUAGE_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>
                            {t(`codeSandbox.languages.${opt}`)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};

LanguageSelector.displayName = 'LanguageSelector';

