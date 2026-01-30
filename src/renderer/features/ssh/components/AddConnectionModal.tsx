
import React from 'react';

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
    }
    setNewConnection: (val: AddConnectionModalProps['newConnection']) => void
    shouldSaveProfile: boolean
    setShouldSaveProfile: (val: boolean) => void
    isConnecting: boolean
    onConnect: () => void
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
    onConnect
}) => {
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
                        onChange={e => setNewConnection({ ...newConnection, port: parseInt(e.target.value) ?? 22 })}
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
                    <button className="primary-btn" onClick={onConnect} disabled={isConnecting || !newConnection.host}>
                        {isConnecting ? t('ssh.connecting') : t('ssh.connect')}
                    </button>
                </div>
            </div>
        </div>
    );
};
