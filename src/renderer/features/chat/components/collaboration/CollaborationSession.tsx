import { Copy } from 'lucide-react';
import { memo } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface CollaborationSessionProps {
    sessionRecording: boolean;
    setSessionRecording: (value: boolean | ((current: boolean) => boolean)) => void;
    appendRecordingEvent: (eventText: string) => void;
    shareLink: string;
    generateShareLink: () => void;
    recordedEvents: string[];
    t: (key: string) => string;
}

export const CollaborationSession = memo(({
    sessionRecording,
    setSessionRecording,
    appendRecordingEvent,
    shareLink,
    generateShareLink,
    recordedEvents,
    t
}: CollaborationSessionProps) => {
    return (
        <Card className="p-4 space-y-4 bg-muted/20 border-muted-foreground/10 hover:bg-muted/40 transition-colors">
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    size="sm"
                    variant={sessionRecording ? 'destructive' : 'outline'}
                    onClick={() => {
                        setSessionRecording((current) => !current);
                        appendRecordingEvent(t('chat.collaboration.recordingToggled'));
                    }}
                    className={`h-8 px-4 text-[10px] font-bold uppercase transition-all duration-300 relative group overflow-hidden ${sessionRecording ? 'shadow-lg shadow-destructive/20 border-destructive/20' : 'hover:border-primary/40'
                        }`}
                >
                    {sessionRecording && (
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-ping mr-2.5 inline-block shrink-0 shadow-sm" />
                    )}
                    <span className="relative z-10 transition-colors">
                        {sessionRecording ? t('chat.collaboration.stopRecording') : t('chat.collaboration.startRecording')}
                    </span>
                    <span className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={generateShareLink}
                    className="h-8 px-4 text-[10px] font-bold uppercase transition-transform hover:scale-105 hover:border-primary/40 hover:bg-primary/5 group"
                >
                    <Copy className="w-3.5 h-3.5 mr-2.5 transition-transform group-hover:rotate-12" />
                    {t('chat.collaboration.generateShareLink')}
                </Button>
            </div>

            {(shareLink || recordedEvents.length > 0) && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {shareLink && (
                        <div className="relative group transition-all">
                            <Input
                                value={shareLink}
                                readOnly
                                className="h-8 text-[11px] font-mono font-medium truncate pr-16 bg-muted border-muted-foreground/10 focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
                            />
                            <div className="absolute right-0 top-0 h-full flex items-center pr-2.5 group-hover:opacity-100 opacity-50 transition-opacity">
                                <span className="text-[10px] uppercase font-bold tracking-tighter text-primary">{t('chat.collaboration.copied')}</span>
                            </div>
                        </div>
                    )}
                    <div className="max-h-32 overflow-y-auto space-y-1.5 scrollbar-thin pr-1 text-[10px] font-mono font-medium tracking-tight">
                        {recordedEvents.length === 0 ? (
                            <div className="p-3 border border-dashed border-muted-foreground/10 rounded-md text-center">
                                <span className="text-[10px] text-muted-foreground italic font-medium opacity-50 uppercase tracking-widest leading-relaxed">
                                    {t('chat.collaboration.noEventsInSession')}
                                </span>
                            </div>
                        ) : (
                            recordedEvents.map((event, index) => (
                                <div key={index} className="flex gap-2.5 items-start opacity-70 hover:opacity-100 transition-opacity group">
                                    <span className="text-primary font-black opacity-30 select-none group-hover:opacity-100 transition-opacity">›</span>
                                    <p className="text-muted-foreground break-all leading-tight">
                                        {event}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
});

CollaborationSession.displayName = 'CollaborationSession';
