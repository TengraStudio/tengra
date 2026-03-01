import { Copy } from 'lucide-react';
import { memo } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PresenceParticipant {
    id: string;
    name: string;
    role: 'owner' | 'guest' | 'ai';
    isOnline: boolean;
}

export const PresenceSection = memo(({
    presence,
    allowGuests,
    onToggleGuests,
    t
}: {
    presence: PresenceParticipant[],
    allowGuests: boolean,
    onToggleGuests: () => void,
    t: (key: string) => string
}) => (
    <Card className="p-3 space-y-2">
        <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t('chat.collaboration.presence')}</span>
            <Button
                variant={allowGuests ? 'secondary' : 'outline'}
                size="sm"
                onClick={onToggleGuests}
                className="h-7 text-xs"
            >
                {allowGuests ? t('chat.collaboration.guestsAllowed') : t('chat.collaboration.guestsBlocked')}
            </Button>
        </div>
        <div className="space-y-1.5">
            {presence.map((participant) => (
                <div key={participant.id} className="text-xs flex items-center gap-2">
                    <span className={cn(
                        "w-2 h-2 rounded-full",
                        participant.isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-muted-foreground'
                    )} />
                    <span className="font-medium">{participant.name}</span>
                    <span className="text-[10px] text-muted-foreground px-1 bg-muted rounded">{participant.role}</span>
                </div>
            ))}
        </div>
    </Card>
));
PresenceSection.displayName = 'PresenceSection';

export const MemorySection = memo(({
    sharedMemory,
    sharedMemoryNote,
    onNoteChange,
    onAddMemory,
    t
}: {
    sharedMemory: string[],
    sharedMemoryNote: string,
    onNoteChange: (v: string) => void,
    onAddMemory: () => void,
    t: (key: string) => string
}) => (
    <Card className="p-3 space-y-2">
        <label className="text-sm font-semibold">{t('chat.collaboration.sharedMemory')}</label>
        <div className="flex gap-2">
            <Input
                value={sharedMemoryNote}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder={t('chat.collaboration.memoryPlaceholder')}
                className="h-8 text-xs"
            />
            <Button size="sm" onClick={onAddMemory} className="h-8 text-xs">{t('common.add')}</Button>
        </div>
        <div className="max-h-24 overflow-y-auto space-y-1 px-1">
            {sharedMemory.map((entry, i) => (
                <p key={i} className="text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded border border-border/50">{entry}</p>
            ))}
        </div>
    </Card>
));
MemorySection.displayName = 'MemorySection';

export const ActivitySection = memo(({
    cursorMarkers,
    annotations,
    onAddMarker,
    onAddAnnotation,
    t
}: {
    cursorMarkers: { id: string; user: string; target: string }[],
    annotations: { id: string; author: string; note: string }[],
    onAddMarker: () => void,
    onAddAnnotation: () => void,
    t: (key: string) => string
}) => (
    <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-3 space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">{t('chat.collaboration.cursorMarkers')}</label>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={onAddMarker}
                    className="h-7 text-xs"
                >
                    {t('chat.collaboration.addMarker')}
                </Button>
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1">
                {cursorMarkers.map((marker) => (
                    <p key={marker.id} className="text-[11px] text-muted-foreground italic">
                        {marker.user} → {marker.target}
                    </p>
                ))}
            </div>
        </Card>
        <Card className="p-3 space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">{t('chat.collaboration.changeAnnotations')}</label>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={onAddAnnotation}
                    className="h-7 text-xs"
                >
                    {t('chat.collaboration.annotate')}
                </Button>
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1">
                {annotations.map((annotation) => (
                    <p key={annotation.id} className="text-[11px] text-muted-foreground border-l-2 border-primary/30 pl-2">
                        <span className="font-medium text-foreground/70">{annotation.author}:</span> {annotation.note}
                    </p>
                ))}
            </div>
        </Card>
    </div>
));
ActivitySection.displayName = 'ActivitySection';

export const SharingSection = memo(({
    isRecording,
    onToggleRecording,
    shareLink,
    onGenerateLink,
    recordedEvents,
    t
}: {
    isRecording: boolean,
    onToggleRecording: () => void,
    shareLink: string,
    onGenerateLink: () => void,
    recordedEvents: string[],
    t: (key: string) => string
}) => (
    <Card className="p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
            <Button
                size="sm"
                variant={isRecording ? 'destructive' : 'outline'}
                onClick={onToggleRecording}
                className="h-8 text-xs"
            >
                <span className={cn("w-2 h-2 rounded-full mr-2", isRecording ? "bg-white animate-pulse" : "bg-destructive")} />
                {isRecording ? t('chat.collaboration.stopRecording') : t('chat.collaboration.startRecording')}
            </Button>
            <Button
                size="sm"
                variant="outline"
                onClick={onGenerateLink}
                className="h-8 text-xs"
            >
                <Copy className="w-3 h-3 mr-2" />
                {t('chat.collaboration.generateShareLink')}
            </Button>
        </div>
        {shareLink && <Input value={shareLink} readOnly className="h-8 text-xs bg-muted/50" />}
        <div className="max-h-32 overflow-y-auto space-y-1 px-1 font-mono text-[10px] bg-black/5 p-2 rounded border border-border/50">
            {recordedEvents.length === 0 && <p className="text-muted-foreground/50 italic">{t('chat.collaboration.noEvents')}</p>}
            {recordedEvents.map((event, index) => (
                <p key={index} className="text-muted-foreground leading-tight hover:text-foreground transition-colors">{event}</p>
            ))}
        </div>
    </Card>
));
SharingSection.displayName = 'SharingSection';
