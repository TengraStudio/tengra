import { memo } from 'react';
import {
    AudioLines,
    File as FileIcon,
    FileCode,
    FileText,
    Image as ImageIcon,
    Video,
    X,
} from 'lucide-react';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { Attachment } from '@/types';

export interface AttachmentListProps {
    attachments: Attachment[];
    onRemove: (index: number) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

const getFileIcon = (type: string) => {
    if (type === 'image') return <ImageIcon size={14} />;
    if (type === 'video') return <Video size={14} />;
    if (type === 'audio') return <AudioLines size={14} />;
    if (type.includes('text') || type.includes('json') || type.includes('md')) return <FileText size={14} />;
    if (type.includes('code') || type.includes('javascript') || type.includes('python')) return <FileCode size={14} />;
    return <FileIcon size={14} />;
};

/**
 * AttachmentList component
 * 
 * Displays a list of files attached to the current chat message.
 */
export const AttachmentList = memo(({ attachments, onRemove, t }: AttachmentListProps) => (
    <AnimatePresence>
        {attachments.length > 0 && (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex flex-wrap gap-2 mb-3 px-2"
            >
                {attachments.map((att, i) => (
                    <div
                        key={i}
                        className="group relative flex items-center gap-2 bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-xs text-muted-foreground pr-8"
                    >
                        {(att.type === 'image' || att.type === 'video') && typeof att.preview === 'string' ? (
                            <img
                                src={att.preview}
                                alt={t('input.attachmentPreview')}
                                className="w-8 h-8 rounded-md object-cover border border-border/50"
                            />
                        ) : (
                            <span
                                className={cn(
                                    'p-1.5 rounded-md',
                                    att.type === 'image' || att.type === 'video'
                                        ? 'bg-primary/20 text-primary'
                                        : 'bg-accent/20 text-accent-foreground'
                                )}
                            >
                                {getFileIcon(att.type)}
                            </span>
                        )}
                        <span className="truncate max-w-[150px]">{att.name}</span>
                        <span className="text-neutral text-xxs">
                            ({(att.size / 1024).toFixed(1)} {t('common.kb')})
                        </span>
                        <button
                            onClick={() => onRemove(i)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-destructive opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity focus-visible:opacity-100"
                            aria-label={t('input.removeAttachment', { name: att.name })}
                        >
                            <X size={12} aria-hidden="true" />
                        </button>
                    </div>
                ))}
            </motion.div>
        )}
    </AnimatePresence>
));

AttachmentList.displayName = 'AttachmentList';
