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

import { SelectDropdown } from '@/components/ui/SelectDropdown';
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

    const handleToggleEnabled = () => {
        void updateSettings({ enabled: !settings.enabled });
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
            description: `Custom command: ${newCommandText}`,
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
                        <div className={`p-2 rounded-xl ${settings.enabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            <Mic className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('voice.interfaceTitle')}</h3>
                            <p className="text-xs text-muted-foreground">{t('voice.interfaceSubtitle')}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => handleToggleEnabled()}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.enabled ? 'bg-primary' : 'bg-muted'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>
            </div>

            {settings.enabled && (
                <>
                    {/* Speech Settings */}
                    <div className="bg-card p-6 rounded-2xl border border-border">
                        <div className="flex items-center gap-3 mb-6">
                            <Volume2 className="w-5 h-5 text-primary" />
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('voice.speechSettings')}</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xxs font-black uppercase tracking-widest text-muted-foreground mb-2 block">
                                        {t('voice.voiceSelection')}
                                    </label>
                                    <SelectDropdown
                                        value={settings.synthesisVoice || ''}
                                        options={[
                                            { value: '', label: t('voice.systemDefault') },
                                            ...voices.map((v) => ({ value: v.id, label: `${v.name} (${v.lang})` })),
                                        ]}
                                        onChange={(val) => { void updateSettings({ synthesisVoice: val }); }}
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-xxs font-black uppercase tracking-widest text-muted-foreground">
                                            {t('voice.speed')}
                                        </label>
                                        <span className="text-xs font-mono text-primary font-bold">{settings.speechRate}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2"
                                        step="0.1"
                                        value={settings.speechRate}
                                        onChange={(e) => { void updateSettings({ speechRate: parseFloat(e.target.value) }); }}
                                        className="w-full accent-primary"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-xxs font-black uppercase tracking-widest text-muted-foreground">
                                            {t('voice.pitch')}
                                        </label>
                                        <span className="text-xs font-mono text-primary font-bold">{settings.speechPitch}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2"
                                        step="0.1"
                                        value={settings.speechPitch}
                                        onChange={(e) => { void updateSettings({ speechPitch: parseFloat(e.target.value) }); }}
                                        className="w-full accent-primary"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-xxs font-black uppercase tracking-widest text-muted-foreground">
                                            {t('voice.volume')}
                                        </label>
                                        <span className="text-xs font-mono text-primary font-bold">{Math.round(settings.speechVolume * 100)}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={settings.speechVolume}
                                        onChange={(e) => { void updateSettings({ speechVolume: parseFloat(e.target.value) }); }}
                                        className="w-full accent-primary"
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
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('voice.behavior')}</h3>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Mic className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-xs">{t('voice.continuousListening')}</span>
                                    </div>
                                    <button
                                        onClick={() => { void updateSettings({ continuousListening: !settings.continuousListening }); }}
                                        className={`w-10 h-5 rounded-full transition-colors relative ${settings.continuousListening ? 'bg-primary' : 'bg-muted'}`}
                                    >
                                        <span className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${settings.continuousListening ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xxs font-black uppercase tracking-widest text-muted-foreground block text-right italic">
                                        {t('voice.wakeWord')}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={settings.wakeWord}
                                            onChange={(e) => { void updateSettings({ wakeWord: e.target.value }); }}
                                            className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-xs focus:border-primary/50 outline-none transition-all"
                                            placeholder="e.g. Hey Tengra"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card p-6 rounded-2xl border border-border">
                            <div className="flex items-center gap-3 mb-6">
                                <Eye className="w-5 h-5 text-primary" />
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('voice.feedback')}</h3>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs">{t('voice.audioFeedback')}</span>
                                    <button
                                        onClick={() => { void updateSettings({ audioFeedback: !settings.audioFeedback }); }}
                                        className={`w-10 h-5 rounded-full transition-colors relative ${settings.audioFeedback ? 'bg-primary' : 'bg-muted'}`}
                                    >
                                        <span className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${settings.audioFeedback ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-xs">{t('voice.visualFeedback')}</span>
                                    <button
                                        onClick={() => { void updateSettings({ visualFeedback: !settings.visualFeedback }); }}
                                        className={`w-10 h-5 rounded-full transition-colors relative ${settings.visualFeedback ? 'bg-primary' : 'bg-muted'}`}
                                    >
                                        <span className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${settings.visualFeedback ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Command Management */}
                    <div className="bg-card p-6 rounded-2xl border border-border">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <Command className="w-5 h-5 text-primary" />
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('voice.commands')}</h3>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newCommandText}
                                    onChange={(e) => setNewCommandText(e.target.value)}
                                    placeholder={t('voice.addNewCommand')}
                                    className="flex-1 bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-xs focus:border-primary/50 outline-none transition-all"
                                />
                                <button
                                    onClick={() => handleAddCustomCommand()}
                                    className="p-2 rounded-xl bg-primary text-white hover:bg-primary-hover transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {commands.map((cmd) => (
                                    <div key={cmd.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 group hover:border-primary/20 transition-all">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex gap-1 items-center">
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-mono">
                                                    {cmd.phrase}
                                                </span>
                                                {cmd.aliases.map((alias, i) => (
                                                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-muted-foreground font-mono">
                                                        {alias}
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="text-xxs text-muted-foreground">{cmd.description}</span>
                                        </div>
                                        {cmd.category === 'custom' && (
                                            <button
                                                onClick={() => handleDeleteCommand(cmd.id)}
                                                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
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

