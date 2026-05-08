/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useEffect, useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { localizeIpcValidationMessage } from '@/features/ssh/utils/ipc-validation-message';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_ADDCONNECTIONMODAL_1 = "modal-content flex max-h-88vh w-modal-32 flex-col overflow-hidden rounded-2xl border border-border/30 bg-popover";


export interface SSHProfileTestUIResult {
    success: boolean;
    message: string;
    errorCode?: string;
    uiState: 'ready' | 'failure';
}

interface AddConnectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    t: (key: string, params?: Record<string, string | number>) => string;
    newConnection: {
        host: string;
        port: number;
        username: string;
        password?: string;
        privateKey?: string;
        name?: string;
        jumpHost?: string;
    };
    setNewConnection: (val: AddConnectionModalProps['newConnection']) => void;
    shouldSaveProfile: boolean;
    setShouldSaveProfile: (val: boolean) => void;
    isConnecting: boolean;
    onConnect: () => void;
    onTestProfile: () => Promise<SSHProfileTestUIResult>;
}

const JUMP_HOST_CHAIN_STORAGE_KEY = 'ssh.jump-host-chains.v1';

function loadJumpHostChains(): string[] {
    try {
        const raw = localStorage.getItem(JUMP_HOST_CHAIN_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw) as string[];
        return parsed.filter(chain => typeof chain === 'string' && chain.trim().length > 0);
    } catch {
        return [];
    }
}

function saveJumpHostChains(chains: string[]): void {
    localStorage.setItem(JUMP_HOST_CHAIN_STORAGE_KEY, JSON.stringify(chains));
}

export const AddConnectionModal: React.FC<AddConnectionModalProps> = ({
    isOpen,
    onClose,
    t,
    newConnection,
    setNewConnection,
    shouldSaveProfile,
    setShouldSaveProfile,
    isConnecting,
    onConnect,
    onTestProfile,
}) => {
    const [isTesting, setIsTesting] = useState(false);
    const [testMessage, setTestMessage] = useState('');
    const [testState, setTestState] = useState<'ready' | 'failure' | null>(null);
    const [rememberChain, setRememberChain] = useState(false);
    const [savedChains, setSavedChains] = useState<string[]>([]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        queueMicrotask(() => {
            setSavedChains(loadJumpHostChains());
        });
    }, [isOpen]);

    const handleConnectClick = () => {
        const chain = newConnection.jumpHost?.trim();
        if (rememberChain && chain) {
            const nextChains = Array.from(new Set([chain, ...savedChains])).slice(0, 10);
            setSavedChains(nextChains);
            saveJumpHostChains(nextChains);
        }
        onConnect();
    };

    const handleTestProfile = async () => {
        setIsTesting(true);
        setTestMessage('');
        setTestState(null);
        try {
            const result = await onTestProfile();
            setTestMessage(result.message);
            setTestState(result.uiState);
        } catch (error) {
            const fallbackMessage = error instanceof Error ? error.message : t('frontend.ssh.unknownError');
            const message = localizeIpcValidationMessage(fallbackMessage, t);
            setTestMessage(t('frontend.ssh.profileTestFailed', { error: message }));
            setTestState('failure');
        } finally {
            setIsTesting(false);
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal-overlay z-1000">
            <div className={C_ADDCONNECTIONMODAL_1}>
                <div className="border-b border-border/20 px-4 py-4 sm:px-5">
                    <h3 className="text-lg font-semibold">{t('frontend.ssh.newConnectionTitle')}</h3>
                </div>
                <div className="space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                    <div className="space-y-1">
                        <Label>{t('frontend.ssh.host')}</Label>
                        <Input
                            value={newConnection.host}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setNewConnection({ ...newConnection, host: e.target.value })
                            }
                            placeholder={t('frontend.ssh.placeholders.host')}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>{t('frontend.ssh.port')}</Label>
                        <Input
                            type="number"
                            value={newConnection.port}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setNewConnection({
                                    ...newConnection,
                                    port: parseInt(e.target.value) || 22,
                                })
                            }
                            placeholder={t('frontend.ssh.placeholders.port')}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>{t('frontend.ssh.username')}</Label>
                        <Input
                            value={newConnection.username}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setNewConnection({ ...newConnection, username: e.target.value })
                            }
                            placeholder={t('frontend.ssh.placeholders.username')}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>{t('frontend.ssh.password')}</Label>
                        <Input
                            type="password"
                            value={newConnection.password ?? ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setNewConnection({ ...newConnection, password: e.target.value })
                            }
                            placeholder={t('frontend.ssh.placeholders.passwordOptional')}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>{t('frontend.ssh.privateKey')}</Label>
                        <Textarea
                            value={newConnection.privateKey ?? ''}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                setNewConnection({ ...newConnection, privateKey: e.target.value })
                            }
                            placeholder={t('frontend.ssh.placeholders.privateKey')}
                            className="min-h-24 typo-body font-mono"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>{t('frontend.ssh.jumpHostChain')}</Label>
                        <Input
                            value={newConnection.jumpHost ?? ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setNewConnection({ ...newConnection, jumpHost: e.target.value })
                            }
                            placeholder={t('frontend.ssh.placeholders.jumpHostChain')}
                        />
                        <div className="typo-caption text-muted-foreground mt-1">
                            {t('frontend.ssh.jumpHostChainHint')}
                        </div>
                    </div>
                    {savedChains.length > 0 && (
                        <div className="space-y-1">
                            <Label>{t('frontend.ssh.savedJumpHostChains')}</Label>
                            <Select
                                value=""
                                onValueChange={(val: string) => {
                                    if (!val) {return;}
                                    setNewConnection({ ...newConnection, jumpHost: val });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue
                                        placeholder={t('frontend.ssh.selectSavedJumpHostChain')}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">
                                        {t('frontend.ssh.selectSavedJumpHostChain')}
                                    </SelectItem>
                                    {savedChains.map(chain => (
                                        <SelectItem key={chain} value={chain}>
                                            {chain}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="flex items-center space-x-2 py-1">
                        <Checkbox
                            id="saveJumpHostChain"
                            checked={rememberChain}
                            onCheckedChange={(checked: boolean) => setRememberChain(checked)}
                        />
                        <Label
                            htmlFor="saveJumpHostChain"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            {t('frontend.ssh.saveJumpHostChain')}
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2 py-1">
                        <Checkbox
                            id="saveProfile"
                            checked={shouldSaveProfile}
                            onCheckedChange={(checked: boolean) => setShouldSaveProfile(checked)}
                        />
                        <Label
                            htmlFor="saveProfile"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            {t('frontend.ssh.saveProfile')}
                        </Label>
                    </div>
                    {shouldSaveProfile && (
                        <div className="space-y-1 transition-all animate-in fade-in slide-in-from-top-1">
                            <Label>{t('frontend.ssh.profileName')}</Label>
                            <Input
                                value={newConnection.name ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setNewConnection({ ...newConnection, name: e.target.value })
                                }
                                placeholder={t('frontend.ssh.placeholders.profileName')}
                            />
                        </div>
                    )}
                </div>
                <div className="modal-actions flex flex-col gap-2 border-t border-border/20 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
                    <button className="secondary-btn" onClick={onClose} disabled={isConnecting}>
                        {t('common.cancel')}
                    </button>
                    <button
                        className="secondary-btn"
                        onClick={() => {
                            void handleTestProfile();
                        }}
                        disabled={isConnecting || isTesting || !newConnection.host}
                    >
                        {isTesting ? t('frontend.ssh.testingProfile') : t('frontend.ssh.testProfile')}
                    </button>
                    <button
                        className="primary-btn"
                        onClick={handleConnectClick}
                        disabled={isConnecting || !newConnection.host}
                    >
                        {isConnecting ? t('frontend.ssh.connecting') : t('frontend.ssh.connect')}
                    </button>
                </div>
                {testMessage !== '' && (
                    <div
                        className={cn(
                            'mx-4 mb-4 rounded border border-border/30 bg-muted/20 p-2 typo-caption sm:mx-5',
                            testState === 'failure'
                                ? 'text-destructive border-destructive/20'
                                : 'text-muted-foreground'
                        )}
                    >
                        {testMessage}
                    </div>
                )}
            </div>
        </div>
    );
};


