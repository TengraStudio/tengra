import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import './ssh-connection-form.css';

/** SSH connection form data shape */
export interface SSHFormData {
    host: string;
    port: string;
    username: string;
    authType: 'password' | 'key';
    password: string;
    privateKey: string;
    passphrase: string;
}

interface SSHConnectionFormProps {
    sshForm: SSHFormData;
    setSshForm: React.Dispatch<React.SetStateAction<SSHFormData>>;
    /** Additional CSS class for the root container */
    className?: string;
}

/** Reusable SSH connection form with host, port, username, and auth fields */
export const SSHConnectionForm: React.FC<SSHConnectionFormProps> = ({
    sshForm,
    setSshForm,
    className,
}) => {
    const { t } = useTranslation();

    return (
        <div className={cn('tengra-ssh-form', className)}>
            <div className="tengra-ssh-form__row">
                <div className="tengra-ssh-form__field">
                    <label className="tengra-ssh-form__label">
                        {t('common.host')}
                    </label>
                    <input
                        autoFocus
                        value={sshForm.host}
                        onChange={e => setSshForm(p => ({ ...p, host: e.target.value }))}
                        className="tengra-ssh-form__input"
                        placeholder={t('workspaceWizard.placeholder.example')}
                    />
                </div>
                <div className="tengra-ssh-form__field">
                    <label className="tengra-ssh-form__label">
                        {t('common.port')}
                    </label>
                    <input
                        value={sshForm.port}
                        onChange={e => setSshForm(p => ({ ...p, port: e.target.value }))}
                        className="tengra-ssh-form__input"
                        placeholder={t('ssh.placeholders.port')}
                    />
                </div>
            </div>

            <div className="tengra-ssh-form__field">
                <label className="tengra-ssh-form__label">
                    {t('common.username')}
                </label>
                <input
                    value={sshForm.username}
                    onChange={e => setSshForm(p => ({ ...p, username: e.target.value }))}
                    className="tengra-ssh-form__input"
                    placeholder={t('ssh.placeholders.username')}
                />
            </div>

            <div className="tengra-ssh-form__field">
                <label className="tengra-ssh-form__label">
                    {t('common.authType')}
                </label>
                <div className="tengra-ssh-form__toggle">
                    <button
                        onClick={() => setSshForm(p => ({ ...p, authType: 'password' }))}
                        className={cn(
                            'tengra-ssh-form__toggle-btn',
                            sshForm.authType === 'password' && 'tengra-ssh-form__toggle-btn--active'
                        )}
                    >
                        {t('common.password')}
                    </button>
                    <button
                        onClick={() => setSshForm(p => ({ ...p, authType: 'key' }))}
                        className={cn(
                            'tengra-ssh-form__toggle-btn',
                            sshForm.authType === 'key' && 'tengra-ssh-form__toggle-btn--active'
                        )}
                    >
                        {t('common.privateKey')}
                    </button>
                </div>
            </div>

            {sshForm.authType === 'password' ? (
                <div className="tengra-ssh-form__field">
                    <label className="tengra-ssh-form__label">
                        {t('common.password')}
                    </label>
                    <input
                        type="password"
                        value={sshForm.password}
                        onChange={e => setSshForm(p => ({ ...p, password: e.target.value }))}
                        className="tengra-ssh-form__input"
                        placeholder={t('common.password')}
                    />
                </div>
            ) : (
                <div className="tengra-ssh-form__key-section">
                    <div className="tengra-ssh-form__field">
                        <label className="tengra-ssh-form__label">
                            {t('common.privateKey')}
                        </label>
                        <textarea
                            value={sshForm.privateKey}
                            onChange={e => setSshForm(p => ({ ...p, privateKey: e.target.value }))}
                            className="tengra-ssh-form__textarea"
                            placeholder={t('ssh.placeholders.privateKey')}
                        />
                    </div>
                    <div className="tengra-ssh-form__field">
                        <label className="tengra-ssh-form__label">
                            {t('common.passphrase')} ({t('common.optional')})
                        </label>
                        <input
                            type="password"
                            value={sshForm.passphrase}
                            onChange={e => setSshForm(p => ({ ...p, passphrase: e.target.value }))}
                            className="tengra-ssh-form__input"
                            placeholder={t('common.passphrase')}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
