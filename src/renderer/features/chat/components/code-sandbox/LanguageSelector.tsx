import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { useTranslation } from '@renderer/i18n';
import React from 'react';

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
            <span>{t('codeSandbox.languageLabel')}</span>
            <Select value={value} onValueChange={handleChange} disabled={disabled}>
                <SelectTrigger className="h-8 w-[120px] px-2 py-1 typo-caption">
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

