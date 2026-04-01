import React, { useEffect, useState } from 'react';
import { Awareness } from 'y-protocols/awareness';

interface UserPresence {
    name: string;
    color: string;
}

interface CollaboratorsProps {
    awareness: Awareness | null;
}

/**
 * Collaborators
 * 
 * Component to display current online users in a collaborative session.
 */
export const Collaborators: React.FC<CollaboratorsProps> = ({ awareness }) => {
    const [collaborators, setCollaborators] = useState<Map<number, UserPresence>>(new Map());

    useEffect(() => {
        if (!awareness) {
            return;
        }

        const handleUpdate = () => {
            const states = awareness.getStates();
            const nextMap = new Map<number, UserPresence>();

            states.forEach((state, clientId) => {
                if (state.user) {
                    nextMap.set(clientId, state.user);
                }
            });

            setCollaborators(nextMap);
        };

        awareness.on('change', handleUpdate);
        handleUpdate();

        return () => {
            awareness.off('change', handleUpdate);
        };
    }, [awareness]);

    const list = Array.from(collaborators.entries());

    if (list.length === 0) {
        return null;
    }

    return (
        <div className="flex -space-x-2 overflow-hidden items-center">
            {list.map(([clientId, user]) => (
                <div
                    key={clientId}
                    title={user.name}
                    className="inline-block h-8 w-8 rounded-full ring-2 ring-background flex items-center justify-center text-xs font-bold text-foreground shadow-sm"
                    style={{ backgroundColor: user.color }}
                >
                    {user.name.charAt(0).toUpperCase()}
                </div>
            ))}
            <span className="pl-4 text-xs font-medium text-muted-foreground">
                {list.length} {list.length === 1 ? 'collaborator' : 'collaborators'}
            </span>
        </div>
    );
};
