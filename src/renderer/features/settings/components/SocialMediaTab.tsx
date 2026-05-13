/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { AppSettings, CronJobEntry } from '@shared/types/settings';
import { IconAlertCircle, IconCalendar, IconClock, IconMessage, IconPlus, IconRobot, IconSend, IconShield, IconTrash } from '@tabler/icons-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { SettingsSharedProps } from '../types';

import {
    SettingsField,
    SettingsInput,
    SettingsPanel,
    SettingsSwitch,
    SettingsTabLayout,
    SettingsToggleRow,
} from './SettingsPrimitives';


/* Batch-02: Extracted Long Classes */
const C_SOCIALMEDIATAB_1 = "px-3 py-1.5 rounded-lg bg-primary text-primary-foreground typo-caption font-medium hover:bg-primary/90 transition-colors disabled:opacity-40";
const C_SOCIALMEDIATAB_2 = "flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border/60 typo-caption text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors w-full justify-center";

type SocialMediaTabProps = Pick<
    SettingsSharedProps,
    'settings' | 'updateRemoteAccounts' | 't'
>;

/** Generate a short unique id for cron jobs */
function generateCronId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const MAX_LEN = 8;
    let id = 'cron_';
    for (let i = 0; i < MAX_LEN; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

/** Default cron job template */
function createEmptyCronJob(): CronJobEntry {
    return {
        id: generateCronId(),
        label: '',
        cronExpression: '0 9 * * 1-5',
        message: '',
        enabled: true,
        platforms: ['telegram'],
    };
}

export const SocialMediaTab: React.FC<SocialMediaTabProps> = ({
    settings,
    updateRemoteAccounts,
    t,
}) => {
    const telegramConfig = settings?.remoteAccounts?.telegram ?? { enabled: false, token: '', allowedUserIds: [] };
    const discordConfig = settings?.remoteAccounts?.discord ?? { enabled: false, token: '', allowedUserIds: [] };
    const cronJobs = useMemo(() => settings?.remoteAccounts?.cronJobs ?? [], [settings?.remoteAccounts?.cronJobs]);

    const [discordToken, setDiscordToken] = useState(discordConfig.token ?? '');
    const [telegramToken, setTelegramToken] = useState(telegramConfig.token ?? '');
    const [showNewCronForm, setShowNewCronForm] = useState(false);
    const [newCronDraft, setNewCronDraft] = useState<CronJobEntry>(createEmptyCronJob);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setTelegramToken(telegramConfig.token ?? '');
        }, 0);
        return () => window.clearTimeout(timer);
    }, [telegramConfig.token]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDiscordToken(discordConfig.token ?? '');
        }, 0);
        return () => window.clearTimeout(timer);
    }, [discordConfig.token]);

    const handleDiscordUpdate = (patch: Partial<NonNullable<AppSettings['remoteAccounts']>['discord']>) => {
        void updateRemoteAccounts({ discord: { ...discordConfig, ...patch } });
    };

    const handleTelegramUpdate = (patch: Partial<NonNullable<AppSettings['remoteAccounts']>['telegram']>) => {
        void updateRemoteAccounts({ telegram: { ...telegramConfig, ...patch } });
    };

    const normalizeIds = (val: string) => val.split(',').map(s => s.trim()).filter(Boolean);

    // --- Cron Job Handlers ---
    const handleAddCronJob = useCallback(() => {
        if (!newCronDraft.label || !newCronDraft.cronExpression || !newCronDraft.message) { return; }
        const updated = [...cronJobs, newCronDraft];
        void updateRemoteAccounts({ cronJobs: updated });
        setNewCronDraft(createEmptyCronJob());
        setShowNewCronForm(false);
    }, [cronJobs, newCronDraft, updateRemoteAccounts]);

    const handleRemoveCronJob = useCallback((id: string) => {
        const updated = cronJobs.filter(j => j.id !== id);
        void updateRemoteAccounts({ cronJobs: updated });
    }, [cronJobs, updateRemoteAccounts]);

    const handleToggleCronJob = useCallback((id: string, enabled: boolean) => {
        const updated = cronJobs.map(j => (j.id === id ? { ...j, enabled } : j));
        void updateRemoteAccounts({ cronJobs: updated });
    }, [cronJobs, updateRemoteAccounts]);

    if (!settings?.remoteAccounts) {
        return null;
    }

    return (
        <SettingsTabLayout className="gap-8"> 
            {/* Telegram Section */}
            <SettingsPanel
                title={t('frontend.settings.socialMedia.telegram.title')}
                description={t('frontend.settings.socialMedia.telegram.description')}
                icon={IconSend}
            >
                <div className="space-y-6 px-6 py-2">
                    <SettingsToggleRow
                        title={t('frontend.settings.socialMedia.telegram.enableTitle')}
                        description={t('frontend.settings.socialMedia.telegram.enableDescription')}
                        control={(
                            <SettingsSwitch
                                checked={telegramConfig.enabled}
                                onCheckedChange={checked => handleTelegramUpdate({ enabled: checked })}
                            />
                        )}
                        icon={IconRobot}
                    />

                    <SettingsToggleRow
                        title={t('frontend.settings.socialMedia.notifications.enableTitle')}
                        description={t('frontend.settings.socialMedia.notifications.enableDescription')}
                        control={(
                            <SettingsSwitch
                                checked={telegramConfig.notifications !== false}
                                onCheckedChange={checked => handleTelegramUpdate({ notifications: checked })}
                            />
                        )}
                        icon={IconClock}
                    />

                    <div className="grid gap-6 md:grid-cols-2">
                        <SettingsField
                            label={t('frontend.settings.socialMedia.botTokenLabel')}
                            description={t('frontend.settings.socialMedia.telegram.botTokenDescription')}
                        >
                            <SettingsInput
                                type="password"
                                value={telegramToken}
                                onChange={e => {
                                    const nextToken = e.target.value;
                                    setTelegramToken(nextToken);
                                    handleTelegramUpdate({ token: nextToken });
                                }}
                                placeholder={t('frontend.settings.socialMedia.telegram.botTokenPlaceholder')}
                            />
                        </SettingsField>

                        <SettingsField
                            label={t('frontend.settings.socialMedia.allowedUserIdsLabel')}
                            description={t('frontend.settings.socialMedia.telegram.allowedUserIdsDescription')}
                        >
                            <SettingsInput
                                type="text"
                                value={telegramConfig.allowedUserIds.join(', ')}
                                onChange={e => handleTelegramUpdate({ allowedUserIds: normalizeIds(e.target.value) })}
                                placeholder={t('frontend.settings.socialMedia.telegram.allowedUserIdsPlaceholder')}
                            />
                        </SettingsField>
                    </div>

                    {!telegramConfig.token && telegramConfig.enabled && (
                        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 p-3 typo-caption text-amber-500 border border-amber-500/20">
                            <IconAlertCircle className="h-4 w-4 shrink-0" />
                            <span>{t('frontend.settings.socialMedia.telegram.missingTokenWarning')}</span>
                        </div>
                    )}
                </div>
            </SettingsPanel>

            {/* Discord Section */}
            <SettingsPanel
                title={t('frontend.settings.socialMedia.discord.title')}
                description={t('frontend.settings.socialMedia.discord.description')}
                icon={IconMessage}
            >
                <div className="space-y-6 px-6 py-2">
                    <SettingsToggleRow
                        title={t('frontend.settings.socialMedia.discord.enableTitle')}
                        description={t('frontend.settings.socialMedia.discord.enableDescription')}
                        control={(
                            <SettingsSwitch
                                checked={discordConfig.enabled}
                                onCheckedChange={checked => handleDiscordUpdate({ enabled: checked })}
                            />
                        )}
                        icon={IconRobot}
                    />

                    <SettingsToggleRow
                        title={t('frontend.settings.socialMedia.notifications.enableTitle')}
                        description={t('frontend.settings.socialMedia.notifications.enableDescription')}
                        control={(
                            <SettingsSwitch
                                checked={discordConfig.notifications !== false}
                                onCheckedChange={checked => handleDiscordUpdate({ notifications: checked })}
                            />
                        )}
                        icon={IconClock}
                    />

                    <div className="grid gap-6 md:grid-cols-2">
                        <SettingsField
                            label={t('frontend.settings.socialMedia.botTokenLabel')}
                            description={t('frontend.settings.socialMedia.discord.botTokenDescription')}
                        >
                            <SettingsInput
                                type="password"
                                value={discordToken}
                                onChange={e => {
                                    const nextToken = e.target.value;
                                    setDiscordToken(nextToken);
                                    handleDiscordUpdate({ token: nextToken });
                                }}
                                placeholder={t('frontend.settings.socialMedia.discord.botTokenPlaceholder')}
                            />
                        </SettingsField>

                        <SettingsField
                            label={t('frontend.settings.socialMedia.allowedUserIdsLabel')}
                            description={t('frontend.settings.socialMedia.discord.allowedUserIdsDescription')}
                        >
                            <SettingsInput
                                type="text"
                                value={discordConfig.allowedUserIds.join(', ')}
                                onChange={e => handleDiscordUpdate({ allowedUserIds: normalizeIds(e.target.value) })}
                                placeholder={t('frontend.settings.socialMedia.discord.allowedUserIdsPlaceholder')}
                            />
                        </SettingsField>
                    </div>
                </div>
            </SettingsPanel>

            {/* Security Note */}
            <div className="flex items-start gap-3 rounded-2xl bg-primary/5 p-4 border border-primary/10">
                <IconShield className="mt-0.5 h-5 w-5 text-primary" />
                <div className="space-y-1">
                    <h4 className="text-sm font-medium text-primary">{t('frontend.settings.socialMedia.security.title')}</h4>
                    <p className="typo-caption text-muted-foreground leading-relaxed">
                        {t('frontend.settings.socialMedia.security.description')}
                    </p>
                </div>
            </div>

            {/* Scheduled Notifications (Cron Jobs) */}
            <SettingsPanel
                title={t('frontend.settings.socialMedia.cronJobs.title')}
                description={t('frontend.settings.socialMedia.cronJobs.description')}
                icon={IconCalendar}
            >
                <div className="space-y-4 px-6 py-2">
                    {/* Existing cron jobs */}
                    {cronJobs.length > 0 && (
                        <div className="space-y-3">
                            {cronJobs.map((job) => (
                                <div
                                    key={job.id}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/50 p-3"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium truncate">{job.label}</span>
                                            <code className="typo-body px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                                                {job.cronExpression}
                                            </code>
                                        </div>
                                        <p className="typo-caption text-muted-foreground truncate mt-0.5">
                                            {job.message}
                                        </p>
                                        <div className="flex gap-1 mt-1">
                                            {job.platforms.map((p) => (
                                                <span key={p} className="typo-body px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                                    {p}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <SettingsSwitch
                                            checked={job.enabled}
                                            onCheckedChange={checked => handleToggleCronJob(job.id, checked)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveCronJob(job.id)}
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                            aria-label={t('common.delete')}
                                        >
                                            <IconTrash className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* New cron job form */}
                    {showNewCronForm && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                            <h5 className="text-sm font-medium">{t('frontend.settings.socialMedia.cronJobs.newTitle')}</h5>
                            <div className="grid gap-4 md:grid-cols-2">
                                <SettingsField
                                    label={t('frontend.settings.socialMedia.cronJobs.labelField')}
                                    description={t('frontend.settings.socialMedia.cronJobs.labelDescription')}
                                >
                                    <SettingsInput
                                        type="text"
                                        value={newCronDraft.label}
                                        onChange={e => setNewCronDraft(d => ({ ...d, label: e.target.value }))}
                                        placeholder={t('frontend.settings.socialMedia.cronJobs.labelPlaceholder')}
                                    />
                                </SettingsField>
                                <SettingsField
                                    label={t('frontend.settings.socialMedia.cronJobs.expressionField')}
                                    description={t('frontend.settings.socialMedia.cronJobs.expressionDescription')}
                                >
                                    <SettingsInput
                                        type="text"
                                        value={newCronDraft.cronExpression}
                                        onChange={e => setNewCronDraft(d => ({ ...d, cronExpression: e.target.value }))}
                                        className="font-mono"
                                        placeholder="0 9 * * 1-5"
                                    />
                                </SettingsField>
                            </div>
                            <SettingsField
                                label={t('frontend.settings.socialMedia.cronJobs.messageField')}
                                description={t('frontend.settings.socialMedia.cronJobs.messageDescription')}
                            >
                                <SettingsInput
                                    type="text"
                                    value={newCronDraft.message}
                                    onChange={e => setNewCronDraft(d => ({ ...d, message: e.target.value }))}
                                    placeholder={t('frontend.settings.socialMedia.cronJobs.messagePlaceholder')}
                                />
                            </SettingsField>
                            <div className="flex items-center gap-3">
                                <span className="typo-caption text-muted-foreground">{t('frontend.settings.socialMedia.cronJobs.platformsLabel')}</span>
                                <label className="flex items-center gap-1.5 typo-caption cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newCronDraft.platforms.includes('telegram')}
                                        onChange={e => {
                                            setNewCronDraft(d => ({
                                                ...d,
                                                platforms: e.target.checked
                                                    ? [...d.platforms, 'telegram']
                                                    : d.platforms.filter(p => p !== 'telegram'),
                                            }));
                                        }}
                                        className="rounded"
                                    />
                                    Telegram
                                </label>
                                <label className="flex items-center gap-1.5 typo-caption cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newCronDraft.platforms.includes('discord')}
                                        onChange={e => {
                                            setNewCronDraft(d => ({
                                                ...d,
                                                platforms: e.target.checked
                                                    ? [...d.platforms, 'discord']
                                                    : d.platforms.filter(p => p !== 'discord'),
                                            }));
                                        }}
                                        className="rounded"
                                    />
                                    Discord
                                </label>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleAddCronJob}
                                    disabled={!newCronDraft.label || !newCronDraft.message || newCronDraft.platforms.length === 0}
                                    className={C_SOCIALMEDIATAB_1}
                                >
                                    {t('frontend.settings.socialMedia.cronJobs.addButton')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowNewCronForm(false);
                                        setNewCronDraft(createEmptyCronJob());
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground typo-caption font-medium hover:bg-muted/80 transition-colors"
                                >
                                    {t('common.cancel')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Add button */}
                    {!showNewCronForm && (
                        <button
                            type="button"
                            onClick={() => setShowNewCronForm(true)}
                            className={C_SOCIALMEDIATAB_2}
                        >
                            <IconPlus className="h-4 w-4" />
                            {t('frontend.settings.socialMedia.cronJobs.addNew')}
                        </button>
                    )}

                    {/* Cron expression help */}
                    <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 typo-body text-muted-foreground">
                        <IconClock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <div>
                            <p className="font-medium mb-1">{t('frontend.settings.socialMedia.cronJobs.helpTitle')}</p>
                            <div className="space-y-0.5 font-mono">
                                <p>{'┌──── minute (0-59)'}</p>
                                <p>{'│ ┌── hour (0-23)'}</p>
                                <p>{'│ │ ┌ day of month (1-31)'}</p>
                                <p>{'│ │ │ ┌ month (1-12)'}</p>
                                <p>{'│ │ │ │ ┌ day of week (0-6)'}</p>
                                <p>{'* * * * *'}</p>
                            </div>
                            <p className="mt-1.5">{t('frontend.settings.socialMedia.cronJobs.helpExamples')}</p>
                        </div>
                    </div>
                </div>
            </SettingsPanel>

            {/* WhatsApp Section (Coming Soon) */}
            <SettingsPanel
                title={t('frontend.settings.socialMedia.whatsapp.title')}
                description={t('frontend.settings.socialMedia.whatsapp.description')}
                icon={IconMessage}
                className="opacity-60"
            >
                <div className="flex items-center justify-center py-8 border-2 border-dashed border-border/40 rounded-2xl">
                    <div className="flex flex-col items-center gap-2 text-center">
                        <div className="rounded-full bg-muted p-3">
                            <IconAlertCircle className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h5 className="text-sm font-medium">{t('frontend.settings.socialMedia.whatsapp.comingSoonTitle')}</h5>
                        <p className="typo-caption text-muted-foreground max-w-xs">
                            {t('frontend.settings.socialMedia.whatsapp.comingSoonDescription')}
                        </p>
                    </div>
                </div>
            </SettingsPanel>
        </SettingsTabLayout>
    );
};

