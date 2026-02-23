import React, { useCallback, useEffect, useState } from 'react';

import { SSHPortForward, SSHTunnelPreset } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface SSHTunnelsProps {
    connectionId: string;
    t: (key: string, params?: Record<string, string | number>) => string;
}

export const SSHTunnels: React.FC<SSHTunnelsProps> = ({ connectionId, t }) => {
    const [type, setType] = useState<'local' | 'remote' | 'dynamic'>('local');
    const [localHost, setLocalHost] = useState('127.0.0.1');
    const [localPort, setLocalPort] = useState('8080');
    const [remoteHost, setRemoteHost] = useState('127.0.0.1');
    const [remotePort, setRemotePort] = useState('80');
    const [presetName, setPresetName] = useState('');
    const [status, setStatus] = useState('');
    const [tunnels, setTunnels] = useState<SSHPortForward[]>([]);
    const [presets, setPresets] = useState<SSHTunnelPreset[]>([]);

    const loadData = useCallback(async () => {
        try {
            const [activeTunnels, savedPresets] = await Promise.all([
                window.electron.ssh.listTunnels(connectionId),
                window.electron.ssh.listTunnelPresets()
            ]);
            setTunnels(activeTunnels);
            setPresets(savedPresets);
        } catch (error) {
            appLogger.error('SSHTunnels', 'Failed to load tunnel data', error as Error);
        }
    }, [connectionId]);

    useEffect(() => {
        const init = async () => {
            await loadData();
        };
        void init().catch((error: Error) => {
            appLogger.error('SSHTunnels', 'Failed to load tunnel data', error);
        });
    }, [loadData]);

    const createTunnel = useCallback(async () => {
        try {
            const result = await window.electron.ssh.createTunnel({
                connectionId,
                type,
                localHost,
                localPort: Number.parseInt(localPort, 10),
                remoteHost,
                remotePort: Number.parseInt(remotePort, 10)
            });
            setStatus(result.success ? t('ssh.tunnelCreated') : (result.error ?? t('ssh.tunnelActionFailed')));
            await loadData();
        } catch (error) {
            appLogger.error('SSHTunnels', 'Tunnel create failed', error as Error);
            setStatus(t('ssh.tunnelActionFailed'));
        }
    }, [connectionId, loadData, localHost, localPort, remoteHost, remotePort, t, type]);

    const savePreset = useCallback(async () => {
        try {
            await window.electron.ssh.saveTunnelPreset({
                name: presetName,
                type,
                localHost,
                localPort: Number.parseInt(localPort, 10),
                remoteHost,
                remotePort: Number.parseInt(remotePort, 10)
            });
            setStatus(t('ssh.presetSaved'));
            setPresetName('');
            await loadData();
        } catch (error) {
            appLogger.error('SSHTunnels', 'Preset save failed', error as Error);
            setStatus(t('ssh.tunnelActionFailed'));
        }
    }, [loadData, localHost, localPort, presetName, remoteHost, remotePort, t, type]);

    return (
        <div className="p-4 space-y-4 overflow-auto h-full">
            <div className="text-sm text-muted-foreground">{status}</div>
            <section className="border border-border rounded-lg p-3 space-y-2">
                <h4 className="font-medium">{t('ssh.tunnelSetup')}</h4>
                <div className="grid grid-cols-5 gap-2">
                    <select value={type} onChange={e => setType(e.target.value as 'local' | 'remote' | 'dynamic')} className="px-2 py-1 rounded bg-background border border-border">
                        <option value="local">{t('ssh.tunnelLocal')}</option>
                        <option value="remote">{t('ssh.tunnelRemote')}</option>
                        <option value="dynamic">{t('ssh.tunnelDynamic')}</option>
                    </select>
                    <input value={localHost} onChange={e => setLocalHost(e.target.value)} placeholder={t('ssh.localHost')} className="px-2 py-1 rounded bg-background border border-border" />
                    <input value={localPort} onChange={e => setLocalPort(e.target.value)} placeholder={t('ssh.localPort')} className="px-2 py-1 rounded bg-background border border-border" />
                    <input value={remoteHost} onChange={e => setRemoteHost(e.target.value)} placeholder={t('ssh.remoteHost')} className="px-2 py-1 rounded bg-background border border-border" disabled={type === 'dynamic'} />
                    <input value={remotePort} onChange={e => setRemotePort(e.target.value)} placeholder={t('ssh.remotePort')} className="px-2 py-1 rounded bg-background border border-border" disabled={type === 'dynamic'} />
                </div>
                <div className="flex gap-2">
                    <button className="primary-btn" onClick={() => { void createTunnel(); }}>{t('ssh.createTunnel')}</button>
                    <input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder={t('ssh.presetName')} className="px-2 py-1 rounded bg-background border border-border flex-1" />
                    <button className="secondary-btn" onClick={() => { void savePreset(); }} disabled={!presetName.trim()}>{t('ssh.savePreset')}</button>
                </div>
            </section>

            <section className="border border-border rounded-lg p-3 space-y-2">
                <h4 className="font-medium">{t('ssh.activeTunnels')}</h4>
                <div className="space-y-2 max-h-40 overflow-auto pr-1">
                    {tunnels.map(tunnel => (
                        <div key={tunnel.id} className="flex items-center justify-between border border-border rounded px-2 py-1">
                            <div className="text-xs">{tunnel.type} {tunnel.localHost}:{tunnel.localPort} → {tunnel.remoteHost}:{tunnel.remotePort}</div>
                            <button className="secondary-btn text-xs px-2 py-1" onClick={() => {
                                void window.electron.ssh.closeTunnel(tunnel.id)
                                    .then(() => loadData())
                                    .catch((error: Error) => {
                                        appLogger.error('SSHTunnels', 'Failed to close tunnel', error);
                                    });
                            }}>{t('ssh.closeTunnel')}</button>
                        </div>
                    ))}
                    {tunnels.length === 0 ? <div className="text-xs text-muted-foreground">{t('ssh.noTunnels')}</div> : null}
                </div>
            </section>

            <section className="border border-border rounded-lg p-3 space-y-2">
                <h4 className="font-medium">{t('ssh.tunnelPresets')}</h4>
                <div className="space-y-2 max-h-40 overflow-auto pr-1">
                    {presets.map(preset => (
                        <div key={preset.id} className="flex items-center justify-between border border-border rounded px-2 py-1">
                            <button
                                className="text-xs text-left flex-1"
                                onClick={() => {
                                    setType(preset.type);
                                    setLocalHost(preset.localHost);
                                    setLocalPort(String(preset.localPort));
                                    setRemoteHost(preset.remoteHost);
                                    setRemotePort(String(preset.remotePort));
                                }}
                            >
                                {preset.name}
                            </button>
                            <button className="secondary-btn text-xs px-2 py-1" onClick={() => {
                                void window.electron.ssh.deleteTunnelPreset(preset.id)
                                    .then(() => loadData())
                                    .catch((error: Error) => {
                                        appLogger.error('SSHTunnels', 'Failed to delete tunnel preset', error);
                                    });
                            }}>{t('common.delete')}</button>
                        </div>
                    ))}
                    {presets.length === 0 ? <div className="text-xs text-muted-foreground">{t('ssh.noTunnelPresets')}</div> : null}
                </div>
            </section>
        </div>
    );
};
