import React from 'react';

import { useTranslation } from '@/i18n';

type SandboxLanguage = 'javascript' | 'typescript' | 'python' | 'shell';

interface LanguageSelectorProps {
    value: SandboxLanguage;
    onChange: (lang: SandboxLanguage) => void;
    disabled?: boolean;
}

const LANGUAGE_OPTIONS: ReadonlyArray<SandboxLanguage> = ['javascript', 'typescript', 'python', 'shell'];

/** Language selector dropdown for the code sandbox */
export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
    value,
    onChange,
    disabled = false,
}) => {
    const { t } = useTranslation();

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
        onChange(e.target.value as SandboxLanguage);
    };

    return (
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <span>{t('codeSandbox.languageLabel')}</span>
            <select
                value={value}
                onChange={handleChange}
                disabled={disabled}
                className="rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            >
                {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                        {t(`codeSandbox.languages.${opt}`)}
                    </option>
                ))}
            </select>
        </label>
    );
};

LanguageSelector.displayName = 'LanguageSelector';
