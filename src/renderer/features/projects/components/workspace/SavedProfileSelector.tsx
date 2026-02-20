import { Server } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { SSHConnection } from '@/types/ssh';

interface SavedProfileSelectorProps {
    onSelect: (profile: SSHConnection) => void;
    t: (key: string) => string;
}

/**
 * SavedProfileSelector Component
 * 
 * Lists saved SSH profiles from the main process and allows one-click selection
 * to populate the mount form.
 */
export const SavedProfileSelector: React.FC<SavedProfileSelectorProps> = ({ onSelect, t }) => {
    const [profiles, setProfiles] = useState<SSHConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchProfiles = async () => {
            try {
                const result = await window.electron.ssh.getProfiles();
                if (isMounted) {
                    setProfiles(result);
                    setLoadFailed(false);
                }
            } catch (error) {
                window.electron.log.error('Failed to fetch SSH profiles', error);
                if (isMounted) {
                    setLoadFailed(true);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };
        void fetchProfiles();
        return () => {
            isMounted = false;
        };
    }, []);

    if (loading) {
        return (
            <div className="text-[10px] text-muted-foreground animate-pulse p-2 mb-4 bg-white/5 rounded-lg border border-dashed border-white/10">
                {t('common.loading')}
            </div>
        );
    }

    if (profiles.length === 0) {
        return (
            <div className="text-[10px] text-muted-foreground p-2 mb-4 bg-white/5 rounded-lg border border-dashed border-white/10">
                {loadFailed ? t('errors.unexpected') : t('terminal.no_ssh_profiles')}
            </div>
        );
    }

    return (
        <div className="space-y-2 mb-4">
            <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Server className="w-3 h-3" />
                {t('workspaceModals.savedProfiles')}
            </label>
            <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                {profiles.map(profile => (
                    <button
                        key={profile.id}
                        onClick={() => onSelect(profile)}
                        className="flex flex-col items-start px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-left transition-all border border-transparent hover:border-white/10 group"
                    >
                        <span className="text-xs font-medium text-foreground group-hover:text-success transition-colors">
                            {profile.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate w-full">
                            {profile.username}@{profile.host}:{profile.port}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};
