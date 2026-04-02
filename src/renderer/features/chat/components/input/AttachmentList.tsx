import { AudioLines, File as FileIcon, FileCode, FileText, Image as ImageIcon, Video, X } from 'lucide-react';
import { memo } from 'react';

import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { Attachment } from '@/types';

interface AttachmentListProps {
    attachments: Attachment[];
    onRemove: (i: number) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

/**
 * AttachmentList - Displays a set of attached files with previews and remove buttons.
 */
export const AttachmentList = memo(({ attachments, onRemove, t }: AttachmentListProps) => {
    const getFileIcon = (type: string) => {
        if (type === 'image') {return <ImageIcon size={12} />;}
        if (type === 'video') {return <Video size={12} />;}
        if (type === 'audio') {return <AudioLines size={12} />;}
        if (type.includes('text') || type.includes('json') || type.includes('md')) {return <FileText size={12} />;}
        if (type.includes('code') || type.includes('javascript') || type.includes('python')) {return <FileCode size={12} />;}
        return <FileIcon size={12} />;
    };

    return (
        <AnimatePresence>
            {attachments.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-wrap gap-1.5 py-2 overflow-hidden"
                >
                    {attachments.map((att, i) => (
                        <div
                            key={i}
                            className="group relative flex items-center gap-1.5 rounded-xl border border-border/20 bg-muted/10 px-2 py-1 pr-6 text-[11px] text-muted-foreground transition-colors hover:bg-muted/20"
                        >
                            {(att.type === 'image' || att.type === 'video') && typeof att.preview === 'string' ? (
                                <img
                                    src={att.preview}
                                    alt={t('input.attachmentPreview')}
                                    className="h-5 w-5 rounded-md border border-border/20 object-cover"
                                />
                            ) : (
                                <span className={cn(
                                    'rounded-md p-1 bg-background/50 outline outline-1 outline-border/5',
                                    att.type === 'image' || att.type === 'video' ? 'text-primary' : 'text-accent-foreground'
                                )}>
                                    {getFileIcon(att.type)}
                                </span>
                            )}
                            <span className="max-w-[100px] truncate">{att.name}</span>
                            <button
                                onClick={() => onRemove(i)}
                                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
                                aria-label={t('input.removeAttachment', { name: att.name })}
                            >
                                <X size={12} aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    );
});

AttachmentList.displayName = 'AttachmentList';
