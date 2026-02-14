/**
 * Accessibility Settings Panel
 * Provides UI for configuring accessibility options.
 */

import {
    Accessibility,
    Contrast,
    Eye,
    Focus,
    RotateCcw,
    Volume2,
} from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n';
import { useA11ySettings } from '@/utils/accessibility';

interface SettingRowProps {
    icon: React.ReactNode;
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

const SettingRow: React.FC<SettingRowProps> = ({
    icon,
    label,
    description,
    checked,
    onChange,
}) => (
    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/50">
        <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {icon}
            </div>
            <div className="flex-1">
                <h4 className="font-medium text-foreground">{label}</h4>
                <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            </div>
        </div>
        <Switch
            checked={checked}
            onCheckedChange={onChange}
            aria-label={label}
        />
    </div>
);

export const AccessibilitySettings: React.FC = () => {
    const { t } = useTranslation();
    const {
        settings,
        updateSettings,
        toggleHighContrast,
        toggleEnhancedFocus,
    } = useA11ySettings();

    const handleReset = () => {
        updateSettings({
            highContrast: false,
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            screenReaderAnnouncements: true,
            enhancedFocusIndicators: false,
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10">
                        <Accessibility className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            {t('settings.accessibility.title') || 'Accessibility'}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {t('settings.accessibility.description') || 'Customize your experience for better accessibility'}
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {t('common.reset') || 'Reset'}
                </Button>
            </div>

            {/* Settings Grid */}
            <div className="space-y-3">
                <SettingRow
                    icon={<Contrast className="w-4 h-4" />}
                    label={t('settings.accessibility.highContrast') || 'High Contrast Mode'}
                    description={t('settings.accessibility.highContrastDesc') || 'Increase contrast for better visibility'}
                    checked={settings.highContrast}
                    onChange={toggleHighContrast}
                />

                <SettingRow
                    icon={<Eye className="w-4 h-4" />}
                    label={t('settings.accessibility.reducedMotion') || 'Reduced Motion'}
                    description={t('settings.accessibility.reducedMotionDesc') || 'Minimize animations and transitions'}
                    checked={settings.reducedMotion}
                    onChange={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
                />

                <SettingRow
                    icon={<Focus className="w-4 h-4" />}
                    label={t('settings.accessibility.enhancedFocus') || 'Enhanced Focus Indicators'}
                    description={t('settings.accessibility.enhancedFocusDesc') || 'Make focus states more visible'}
                    checked={settings.enhancedFocusIndicators}
                    onChange={toggleEnhancedFocus}
                />

                <SettingRow
                    icon={<Volume2 className="w-4 h-4" />}
                    label={t('settings.accessibility.screenReader') || 'Screen Reader Announcements'}
                    description={t('settings.accessibility.screenReaderDesc') || 'Enable announcements for screen readers'}
                    checked={settings.screenReaderAnnouncements}
                    onChange={(checked) => updateSettings({ screenReaderAnnouncements: checked })}
                />
            </div>

            {/* System Preferences Info */}
            <div className="p-4 rounded-xl bg-info/10 border border-info/20">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-info" />
                    {t('settings.accessibility.systemPrefs') || 'System Preferences'}
                </h4>
                <p className="text-sm text-muted-foreground mt-2">
                    {t('settings.accessibility.systemPrefsDesc') ||
                        'Some settings automatically detect your system preferences. ' +
                        'Enable "Reduced Motion" or "High Contrast" in your operating system ' +
                        'for automatic detection.'}
                </p>
            </div>

            {/* Keyboard Shortcuts Info */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
                <h4 className="font-medium text-foreground mb-3">
                    {t('settings.accessibility.shortcuts') || 'Keyboard Shortcuts'}
                </h4>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Tab</span>
                        <span className="text-foreground">{t('settings.accessibility.tabNav') || 'Navigate between elements'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Shift + Tab</span>
                        <span className="text-foreground">{t('settings.accessibility.tabNavBack') || 'Navigate backwards'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Enter / Space</span>
                        <span className="text-foreground">{t('settings.accessibility.activate') || 'Activate focused element'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Escape</span>
                        <span className="text-foreground">{t('settings.accessibility.escape') || 'Close modal or cancel'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Arrow Keys</span>
                        <span className="text-foreground">{t('settings.accessibility.arrowNav') || 'Navigate within lists'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccessibilitySettings;
