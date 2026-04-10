import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { Slider } from '@renderer/components/ui/slider';
import { Switch } from '@renderer/components/ui/switch';
import { VoiceCommand } from '@shared/types/voice';
import {
    Command,
    Eye,
    Mic,
    Plus,
    Trash2,
    Volume2,
    Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { useVoice } from '@/features/voice/hooks/useVoice';

import { SettingsSharedProps } from '../types';

/**
 * VoiceSettingsTab Component
 * Provides UI for managing Voice-First Interface settings
 */
export const VoiceSettingsTab: React.FC<SettingsSharedProps> = ({ t }) => {
    const {
        settings,
        voices,
        updateSettings,
        getCommands,
        addCommand,
        removeCommand,
    } = useVoice();

    const [commands, setCommands] = useState<VoiceCommand[]>([]);
    const [newCommandText, setNewCommandText] = useState('');

    useEffect(() => {
        const loadCommands = async () => {
            const cmds = await getCommands();
            setCommands(cmds);
        };
        void loadCommands();
    }, [getCommands]);

    const handleToggleEnabled = (enabled: boolean) => {
        void updateSettings({ enabled });
    };

    const handleAddCustomCommand = () => {
        if (!newCommandText.trim()) {
            return;
        }

        const newCmd: VoiceCommand = {
            id: crypto.randomUUID(),
            phrase: newCommandText.trim(),
            aliases: [],
            action: { type: 'execute', command: newCommandText.trim() },
            category: 'custom',
            description: t('voice.commands.customDescription', { phrase: newCommandText.trim() }),
            enabled: true,
        };

        void (async () => {
            await addCommand(newCmd);
            setCommands([...commands, newCmd]);
            setNewCommandText('');
        })();
    };

    const handleDeleteCommand = (id: string) => {
        void (async () => {
            await removeCommand(id);
            setCommands(commands.filter((c) => c.id !== id));
        })();
    };

    return (
        <div className="space-y-6">
            {/* Master Toggle */}
            <div className="bg-card p-6 rounded-2xl border border-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl transition-colors ${settings.enabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            <Mic className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground">{t('voice.interfaceTitle')}</h3>
                            <p className="typo-caption text-muted-foreground">{t('voice.interfaceSubtitle')}</p>
                        </div>
                    </div>
                    <Switch
                        checked={settings.enabled}
                        onCheckedChange={handleToggleEnabled}
                    />
                </div>
            </div>

            {settings.enabled && (
                <>
                    {/* Speech Settings */}
                    <div className="bg-card p-6 rounded-2xl border border-border">
                        <div className="flex items-center gap-3 mb-6">
                            <Volume2 className="w-5 h-5 text-primary" />
                            <h3 className="text-sm font-bold text-foreground">{t('voice.speechSettings')}</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div>
                                    <Label className="text-xxs font-bold text-muted-foreground mb-2 block">
                                        {t('voice.voiceSelection')}
                                    </Label>
                                    <Select
                                        value={settings.synthesisVoice || ''}
                                        onValueChange={(val) => { void updateSettings({ synthesisVoice: val }); }}
                                    >
                                        <SelectTrigger className="w-full bg-background/50">
                                            <SelectValue placeholder={t('voice.systemDefault')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="system-default">{t('voice.systemDefault')}</SelectItem>
                                            {voices.map((v) => (
                                                <SelectItem key={v.id} value={v.id}>
                                                    {v.name} ({v.lang})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <div className="flex justify-between mb-3">
                                        <Label className="text-xxs font-bold text-muted-foreground">
                                            {t('voice.speed')}
                                        </Label>
                                        <span className="typo-caption font-mono text-primary font-bold">{settings.speechRate}x</span>
                                    </div>
                                    <Slider
                                        min={0.5}
                                        max={2}
                                        step={0.1}
                                        value={[settings.speechRate]}
                                        onValueChange={([val]) => { void updateSettings({ speechRate: val }); }}
                                        className="w-full"
                                    />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between mb-3">
                                        <Label className="text-xxs font-bold text-muted-foreground">
                                            {t('voice.pitch')}
                                        </Label>
                                        <span className="typo-caption font-mono text-primary font-bold">{settings.speechPitch}</span>
                                    </div>
                                    <Slider
                                        min={0.5}
                                        max={2}
                                        step={0.1}
                                        value={[settings.speechPitch]}
                                        onValueChange={([val]) => { void updateSettings({ speechPitch: val }); }}
                                        className="w-full"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-3">
                                        <Label className="text-xxs font-bold text-muted-foreground">
                                            {t('voice.volume')}
                                        </Label>
                                        <span className="typo-caption font-mono text-primary font-bold">{Math.round(settings.speechVolume * 100)}%</span>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        value={[settings.speechVolume]}
                                        onValueChange={([val]) => { void updateSettings({ speechVolume: val }); }}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Behavior & Feedback */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-card p-6 rounded-2xl border border-border">
                            <div className="flex items-center gap-3 mb-6">
                                <Zap className="w-5 h-5 text-primary" />
                                <h3 className="text-sm font-bold text-foreground">{t('voice.behavior')}</h3>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Mic className="w-4 h-4 text-muted-foreground" />
                                        <span className="typo-caption">{t('voice.continuousListening')}</span>
                                    </div>
                                    <Switch
                                        checked={settings.continuousListening}
                                        onCheckedChange={(checked) => { void updateSettings({ continuousListening: checked }); }}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xxs font-bold text-muted-foreground block text-right">
                                        {t('voice.wakeWord')}
                                    </Label>
                                    <Input
                                        type="text"
                                        value={settings.wakeWord}
                                        onChange={(e) => { void updateSettings({ wakeWord: e.target.value }); }}
                                        className="w-full bg-background/50 h-10 px-4"
                                        placeholder={t('placeholder.wakeWordExample')}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-card p-6 rounded-2xl border border-border">
                            <div className="flex items-center gap-3 mb-6">
                                <Eye className="w-5 h-5 text-primary" />
                                <h3 className="text-sm font-bold text-foreground">{t('voice.settings.feedback')}</h3>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <span className="typo-caption">{t('voice.audioFeedback')}</span>
                                    <Switch
                                        checked={settings.audioFeedback}
                                        onCheckedChange={(checked) => { void updateSettings({ audioFeedback: checked }); }}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="typo-caption">{t('voice.visualFeedback')}</span>
                                    <Switch
                                        checked={settings.visualFeedback}
                                        onCheckedChange={(checked) => { void updateSettings({ visualFeedback: checked }); }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Command Management */}
                    <div className="bg-card p-6 rounded-2xl border border-border">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <Command className="w-5 h-5 text-primary" />
                                <h3 className="text-sm font-bold text-foreground">{t('voice.commands.title')}</h3>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    value={newCommandText}
                                    onChange={(e) => setNewCommandText(e.target.value)}
                                    placeholder={t('voice.addNewCommand')}
                                    className="flex-1 bg-background/50 h-10 px-4"
                                />
                                <Button
                                    size="icon"
                                    onClick={() => handleAddCustomCommand()}
                                    className="h-10 w-10 shrink-0"
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {commands.map((cmd) => (
                                    <div key={cmd.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/30 group hover:border-primary/20 transition-all">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex gap-1 items-center flex-wrap">
                                                <span className="tw-text-10 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-mono font-bold">
                                                    {cmd.phrase}
                                                </span>
                                                {cmd.aliases.map((alias, i) => (
                                                    <span key={i} className="tw-text-10 px-1.5 py-0.5 rounded-md bg-muted/40 text-muted-foreground font-mono">
                                                        {alias}
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="text-xxs text-muted-foreground">{cmd.description}</span>
                                        </div>
                                        {cmd.category === 'custom' && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteCommand(cmd.id)}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

