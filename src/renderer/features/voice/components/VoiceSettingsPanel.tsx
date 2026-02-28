/**
 * VoiceSettingsPanel Component - Settings for voice control
 * UI-11: Voice-first interface option
 */

import { VoiceCommand, VoiceInfo, VoiceSettings } from '@shared/types/voice';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { appLogger } from '@/utils/renderer-logger';

import { useVoice } from '../hooks/useVoice';

/** Props for VoiceSettingsPanel */
interface VoiceSettingsPanelProps {
    className?: string;
}

/** Voice settings panel component */
export function VoiceSettingsPanel({ className }: VoiceSettingsPanelProps) {
    const { t } = useTranslation();
    const {
        settings,
        voices,
        updateSettings,
        getCommands,
        addCommand,
        removeCommand,
    } = useVoice();

    const [localSettings, setLocalSettings] = useState<VoiceSettings>(settings);
    const [commands, setCommands] = useState<VoiceCommand[]>([]);
    const [newCommandPhrase, setNewCommandPhrase] = useState('');
    const [newCommandAction, setNewCommandAction] = useState('');

    // Load commands on mount
    useEffect(() => {
        void getCommands()
            .then(setCommands)
            .catch(error => appLogger.error('VoiceSettingsPanel', 'Failed to load voice commands', error as Error));
    }, [getCommands]);

    // Update local settings when props change
    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    /** Handle settings change */
    const handleSettingChange = async <K extends keyof VoiceSettings>(
        key: K,
        value: VoiceSettings[K]
    ) => {
        const newSettings = { ...localSettings, [key]: value };
        setLocalSettings(newSettings);
        await updateSettings({ [key]: value });
    };

    const handleSettingChangeSafe = <K extends keyof VoiceSettings>(
        key: K,
        value: VoiceSettings[K]
    ) => {
        void handleSettingChange(key, value);
    };

    /** Add a new custom command */
    const handleAddCommand = async () => {
        if (!newCommandPhrase || !newCommandAction) {
            return;
        }

        const command: VoiceCommand = {
            id: `custom-${Date.now()}`,
            phrase: newCommandPhrase,
            aliases: [],
            action: { type: 'execute', command: newCommandAction },
            category: 'custom',
            description: `Custom command: ${newCommandPhrase}`,
            enabled: true,
        };

        await addCommand(command);
        setNewCommandPhrase('');
        setNewCommandAction('');
        const updatedCommands = await getCommands();
        setCommands(updatedCommands);
    };

    return (
        <div className={cn('voice-settings-panel space-y-6', className)}>
            {/* Enable Voice Control */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('voice.settings.enableVoice')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                            {t('voice.settings.enableVoiceDescription')}
                        </span>
                        <Switch
                            checked={localSettings.enabled}
                            onCheckedChange={(checked) => handleSettingChangeSafe('enabled', checked)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Wake Word Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('voice.settings.wakeWord')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            {t('voice.settings.wakeWordLabel')}
                        </label>
                        <Input
                            value={localSettings.wakeWord}
                            onChange={(e) => handleSettingChangeSafe('wakeWord', e.target.value)}
                            placeholder={t('placeholder.wakeWord')}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                            {t('voice.settings.continuousListening')}
                        </span>
                        <Switch
                            checked={localSettings.continuousListening}
                            onCheckedChange={(checked) => handleSettingChangeSafe('continuousListening', checked)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Speech Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('voice.settings.speech')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Voice Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            {t('voice.settings.voice')}
                        </label>
                        <Select
                            value={localSettings.synthesisVoice}
                            onValueChange={(value) => handleSettingChangeSafe('synthesisVoice', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={t('voice.settings.selectVoice')} />
                            </SelectTrigger>
                            <SelectContent>
                                {voices.map((voice: VoiceInfo) => (
                                    <SelectItem key={voice.id} value={voice.id}>
                                        {voice.name} ({voice.lang})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Speech Rate */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            {t('voice.settings.speechRate')}: {localSettings.speechRate.toFixed(1)}
                        </label>
                        <input
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.1"
                            value={localSettings.speechRate}
                            onChange={(e) => handleSettingChangeSafe('speechRate', parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>

                    {/* Speech Pitch */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            {t('voice.settings.speechPitch')}: {localSettings.speechPitch.toFixed(1)}
                        </label>
                        <input
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.1"
                            value={localSettings.speechPitch}
                            onChange={(e) => handleSettingChangeSafe('speechPitch', parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>

                    {/* Speech Volume */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            {t('voice.settings.speechVolume')}: {Math.round(localSettings.speechVolume * 100)}%
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={localSettings.speechVolume}
                            onChange={(e) => handleSettingChangeSafe('speechVolume', parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Feedback Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('voice.settings.feedback')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                            {t('voice.settings.audioFeedback')}
                        </span>
                        <Switch
                            checked={localSettings.audioFeedback}
                            onCheckedChange={(checked) => handleSettingChangeSafe('audioFeedback', checked)}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                            {t('voice.settings.visualFeedback')}
                        </span>
                        <Switch
                            checked={localSettings.visualFeedback}
                            onCheckedChange={(checked) => handleSettingChangeSafe('visualFeedback', checked)}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                            {t('voice.settings.accessibilityMode')}
                        </span>
                        <Switch
                            checked={localSettings.accessibilityMode}
                            onCheckedChange={(checked) => handleSettingChangeSafe('accessibilityMode', checked)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Custom Commands */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('voice.settings.customCommands')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Existing Commands */}
                    <div className="space-y-2">
                        {commands
                            .filter((cmd) => cmd.category === 'custom')
                            .map((command) => (
                                <div
                                    key={command.id}
                                    className="flex items-center justify-between p-2 bg-muted rounded"
                                >
                                    <div>
                                        <span className="font-medium">"{command.phrase}"</span>
                                        <span className="text-muted-foreground ml-2">
                                            → {command.action.type}
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { void removeCommand(command.id); }}
                                    >
                                        ✕
                                    </Button>
                                </div>
                            ))}
                    </div>

                    {/* Add New Command */}
                    <div className="flex gap-2">
                        <Input
                            value={newCommandPhrase}
                            onChange={(e) => setNewCommandPhrase(e.target.value)}
                            placeholder={t('voice.settings.commandPhrase')}
                            className="flex-1"
                        />
                        <Input
                            value={newCommandAction}
                            onChange={(e) => setNewCommandAction(e.target.value)}
                            placeholder={t('voice.settings.commandAction')}
                            className="flex-1"
                        />
                        <Button onClick={() => { void handleAddCommand(); }}>
                            {t('common.add')}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default VoiceSettingsPanel;

