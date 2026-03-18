
import React, { useEffect, useState } from 'react';

import { localizeIpcValidationMessage } from '@/features/ssh/utils/ipc-validation-message';

export interface SSHProfileTestUIResult {
    success: boolean;
    message: string;
    errorCode?: string;
    uiState: 'ready' | 'failure';
}

interface AddConnectionModalProps {
    isOpen: boolean
    onClose: () => void
    t: (key: string, params?: Record<string, string | number>) => string
    newConnection: {
        host: string;
        port: number;
        username: string;
        password?: string;
        privateKey?: string;
        name?: string;
        jumpHost?: string;
    }
    setNewConnection: (val: AddConnectionModalProps['newConnection']) => void
    shouldSaveProfile: boolean
    setShouldSaveProfile: (val: boolean) => void
    isConnecting: boolean
    onConnect: () => void
    onTestProfile: () => Promise<SSHProfileTestUIResult>
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
    onTestProfile
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
        setSavedChains(loadJumpHostChains());
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
            const fallbackMessage = error instanceof Error ? error.message : t('ssh.unknownError');
            const message = localizeIpcValidationMessage(fallbackMessage, t);
            setTestMessage(t('ssh.profileTestFailed', { error: message }));
            setTestState('failure');
        } finally {
            setIsTesting(false);
        }
    };

    if (!isOpen) { return null; }

    return (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
            <div className="modal-content" style={{ width: '400px' }}>
                <h3>{t('ssh.newConnectionTitle')}</h3>
                <div className="form-group">
                    <label>{t('ssh.host')}</label>
                    <input
                        value={newConnection.host}
                        onChange={e => setNewConnection({ ...newConnection, host: e.target.value })}
                        placeholder={t('ssh.placeholders.host')}
                    />
                </div>
                <div className="form-group">
                    <label>{t('ssh.port')}</label>
                    <input
                        type="number"
                        value={newConnection.port}
                        onChange={e => setNewConnection({ ...newConnection, port: parseInt(e.target.value) || 22 })}
                        placeholder={t('ssh.placeholders.port')}
                    />
                </div>
                <div className="form-group">
                    <label>{t('ssh.username')}</label>
                    <input
                        value={newConnection.username}
                        onChange={e => setNewConnection({ ...newConnection, username: e.target.value })}
                        placeholder={t('ssh.placeholders.username')}
                    />
                </div>
                <div className="form-group">
                    <label>{t('ssh.password')}</label>
                    <input
                        type="password"
                        value={newConnection.password ?? ''}
                        onChange={e => setNewConnection({ ...newConnection, password: e.target.value })}
                        placeholder={t('ssh.placeholders.passwordOptional')}
                    />
                </div>
                <div className="form-group">
                    <label>{t('ssh.privateKey')}</label>
                    <textarea
                        value={newConnection.privateKey ?? ''}
                        onChange={e => setNewConnection({ ...newConnection, privateKey: e.target.value })}
                        placeholder={t('ssh.placeholders.privateKey')}
                        style={{ height: '80px', fontSize: '0.8em' }}
                    />
                </div>
                <div className="form-group">
                    <label>{t('ssh.jumpHostChain')}</label>
                    <input
                        value={newConnection.jumpHost ?? ''}
                        onChange={event => setNewConnection({ ...newConnection, jumpHost: event.target.value })}
                        placeholder={t('ssh.placeholders.jumpHostChain')}
                    />
                    <div className="text-xs text-muted-foreground mt-1">{t('ssh.jumpHostChainHint')}</div>
                </div>
                {savedChains.length > 0 && (
                    <div className="form-group">
                        <label>{t('ssh.savedJumpHostChains')}</label>
                        <select
                            value=""
                            onChange={event => {
                                const selected = event.target.value;
                                if (!selected) {
                                    return;
                                }
                                setNewConnection({ ...newConnection, jumpHost: selected });
                            }}
                        >
                            <option value="">{t('ssh.selectSavedJumpHostChain')}</option>
                            {savedChains.map(chain => (
                                <option key={chain} value={chain}>{chain}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <input
                        type="checkbox"
                        checked={rememberChain}
                        onChange={event => setRememberChain(event.target.checked)}
                        id="saveJumpHostChain"
                        style={{ width: 'auto', marginRight: '8px' }}
                    />
                    <label htmlFor="saveJumpHostChain" style={{ marginBottom: 0 }}>
                        {t('ssh.saveJumpHostChain')}
                    </label>
                </div>
                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <input
                        type="checkbox"
                        checked={shouldSaveProfile}
                        onChange={e => setShouldSaveProfile(e.target.checked)}
                        id="saveProfile"
                        style={{ width: 'auto', marginRight: '8px' }}
                    />
                    <label htmlFor="saveProfile" style={{ marginBottom: 0 }}>{t('ssh.saveProfile')}</label>
                </div>
                {shouldSaveProfile && (
                    <div className="form-group">
                        <label>{t('ssh.profileName')}</label>
                        <input
                            value={newConnection.name ?? ''}
                            onChange={e => setNewConnection({ ...newConnection, name: e.target.value })}
                            placeholder={t('ssh.placeholders.profileName')}
                        />
                    </div>
                )}
                <div className="modal-actions">
                    <button className="secondary-btn" onClick={onClose} disabled={isConnecting}>
                        {t('common.cancel')}
                    </button>
                    <button
                        className="secondary-btn"
                        onClick={() => { void handleTestProfile(); }}
                        disabled={isConnecting || isTesting || !newConnection.host}
                    >
                        {isTesting ? t('ssh.testingProfile') : t('ssh.testProfile')}
                    </button>
                    <button className="primary-btn" onClick={handleConnectClick} disabled={isConnecting || !newConnection.host}>
                        {isConnecting ? t('ssh.connecting') : t('ssh.connect')}
                    </button>
                </div>
                {testMessage !== '' && (
                    <div className={`text-xs mt-2 ${testState === 'failure' ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {testMessage}
                    </div>
                )}
            </div>
        </div>
    );
};
