import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export interface PresenceParticipant {
    id: string;
    name: string;
    role: 'owner' | 'guest' | 'ai';
    isOnline: boolean;
}

interface CollaborationPresenceProps {
    presence: PresenceParticipant[];
    allowGuests: boolean;
    setAllowGuests: (value: boolean | ((current: boolean) => boolean)) => void;
    appendRecordingEvent: (eventText: string) => void;
    t: (key: string) => string;
}

export const CollaborationPresence = memo(({
    presence,
    allowGuests,
    setAllowGuests,
    appendRecordingEvent,
    t
}: CollaborationPresenceProps) => {
    return (
        <Card className="p-4 space-y-3 bg-muted/20 border-muted-foreground/10 hover:bg-muted/40 transition-colors">
            <div className="flex items-center justify-between">
                <span className="text-sm font-bold tracking-tight uppercase text-muted-foreground/80">
                    {t('chat.collaboration.presence')}
                </span>
                <Button
                    variant={allowGuests ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => {
                        setAllowGuests((current) => !current);
                        appendRecordingEvent(t('chat.collaboration.guestPolicyChanged'));
                    }}
                    className={`h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${allowGuests ? 'bg-secondary/80 hover:bg-secondary' : 'hover:border-primary/40'
                        }`}
                >
                    {allowGuests ? t('chat.collaboration.guestsAllowed') : t('chat.collaboration.guestsBlocked')}
                </Button>
            </div>
            <div className="space-y-2">
                {presence.map((participant) => (
                    <div key={participant.id} className="text-xs flex items-center gap-3 font-medium transition-opacity hover:opacity-100">
                        <div className="relative">
                            <span className={`flex w-2.5 h-2.5 rounded-full shadow-sm ring-2 ring-background transition-colors ${participant.isOnline ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'
                                }`} />
                            {participant.isOnline && (
                                <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-25" />
                            )}
                        </div>
                        <span className={`transition-colors ${participant.isOnline ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                            {participant.name}
                        </span>
                        {participant.role === 'owner' && (
                            <span className="text-[9px] uppercase font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded tracking-tighter">
                                Host
                            </span>
                        )}
                        {participant.role === 'ai' && (
                            <span className="text-[9px] uppercase font-black bg-secondary/10 text-secondary px-1.5 py-0.5 rounded tracking-tighter">
                                AI
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );
});

CollaborationPresence.displayName = 'CollaborationPresence';
