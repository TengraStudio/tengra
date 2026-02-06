import { Download, FileText, X } from 'lucide-react';
import React, { useState } from 'react';

import { useTranslation } from '@/i18n';
import { Chat, Message } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface ExportModalProps {
    isOpen: boolean
    onClose: () => void
    chat: Chat
    messages: Message[]
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, chat, messages }) => {
    const { t } = useTranslation();
    const [format, setFormat] = useState<'markdown' | 'pdf'>('markdown');
    const [isExporting, setIsExporting] = useState(false);

    if (!isOpen) {return null;}

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const filename = `${chat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${format === 'markdown' ? 'md' : 'pdf'}`;
            const saveResult = await window.electron.saveFile('', filename);

            if (saveResult.success && saveResult.path) {
                if (format === 'markdown') {
                    const content = messages.map(m => `## ${m.role}\n\n${m.content}`).join('\n\n---\n\n');
                    await window.electron.exportMarkdown(content, saveResult.path);
                } else {
                    const htmlContent = `
                        <html>
                        <head>
                            <style>
                                body { font-family: sans-serif; padding: 20px; }
                                .message { margin-bottom: 20px; border-bottom: 1px solid border-border; padding-bottom: 10px; }
                                .role { font-weight: bold; text-transform: capitalize; margin-bottom: 5px; }
                                .content { white-space: pre-wrap; }
                            </style>
                        </head>
                        <body>
                            <h1>${chat.title}</h1>
                            ${messages.map(m => `
                                <div class="message">
                                    <div class="role">${m.role}</div>
                                    <div class="content">${m.content}</div>
                                </div>
                            `).join('')}
                        </body>
                        </html>
                    `;
                    await window.electron.exportPDF(htmlContent, saveResult.path);
                }
                onClose();
            }
        } catch (error) {
            appLogger.error('ExportModal', 'Export failed', error as Error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background border border-border rounded-lg shadow-lg w-[400px] p-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">{t('export.title')}</h2>
                    <button onClick={onClose}><X className="w-4 h-4" /></button>
                </div>

                <div className="space-y-4">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFormat('markdown')}
                            className={`flex-1 p-3 border rounded-md flex flex-col items-center gap-2 ${format === 'markdown' ? 'border-primary bg-primary/5' : 'border-border'}`}
                        >
                            <FileText className="w-6 h-6" />
                            <span className="text-sm">{t('export.formatMarkdown')}</span>
                        </button>
                        <button
                            onClick={() => setFormat('pdf')}
                            className={`flex-1 p-3 border rounded-md flex flex-col items-center gap-2 ${format === 'pdf' ? 'border-primary bg-primary/5' : 'border-border'}`}
                        >
                            <Download className="w-6 h-6" />
                            <span className="text-sm">{t('export.formatPdf')}</span>
                        </button>
                    </div>

                    <button
                        onClick={() => { void (async () => { await handleExport(); })(); }}
                        disabled={isExporting}
                        className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {isExporting ? t('export.exporting') : t('export.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};
