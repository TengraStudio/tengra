import { AlertCircle, Download, ExternalLink, X } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';

interface ExtensionInstallPromptProps {
    onClose: () => void;
    onDismiss: () => void;
}

/**
 * Dialog prompting user to install browser extension
 */
export const ExtensionInstallPrompt: React.FC<ExtensionInstallPromptProps> = ({
    onClose,
    onDismiss
}) => {
    const { t } = useTranslation();

    const handleOpenExtensionFolder = () => {
        const extensionPath = process.cwd() + '/extension';
        // Sanitize path before creating file:// URL
        const sanitizedPath = extensionPath.replace(/[<>:"\\|?*]/g, '').replace(/\\/g, '/');
        window.electron.openExternal('file:///' + sanitizedPath);
    };

    const handleOpenInstructions = () => {
        window.electron.openExternal(
            'https://github.com/TengraStudio/tandem/wiki/Browser-Extension-Installation'
        );
    };

    const handleDismiss = () => {
        onDismiss();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl mx-4 bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="relative bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                        aria-label={t('common.close')}
                    >
                        <X size={20} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur">
                            <Download size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                {t('extensionPrompt.title')}
                            </h2>
                            <p className="text-white/80 text-sm">
                                {t('extensionPrompt.subtitle')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-5 space-y-4">
                    {/* Info Box */}
                    <div className="flex gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <AlertCircle size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-gray-300">
                            <p className="font-medium text-white mb-1">
                                {t('extensionPrompt.infoTitle')}
                            </p>
                            <p>
                                {t('extensionPrompt.infoBody')}
                            </p>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-white">{t('extensionPrompt.featuresTitle')}</h3>
                        <ul className="space-y-2 text-sm text-gray-300">
                            <li className="flex items-start gap-2">
                                <span className="text-green-400 mt-1">✓</span>
                                <span>
                                    <strong className="text-white">{t('extensionPrompt.features.aiChatTitle')}</strong>{' '}
                                    {t('extensionPrompt.features.aiChatDesc')}
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-400 mt-1">✓</span>
                                <span>
                                    <strong className="text-white">{t('extensionPrompt.features.pageInteractionTitle')}</strong>{' '}
                                    {t('extensionPrompt.features.pageInteractionDesc')}
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-400 mt-1">✓</span>
                                <span>
                                    <strong className="text-white">{t('extensionPrompt.features.contentExtractionTitle')}</strong>{' '}
                                    {t('extensionPrompt.features.contentExtractionDesc')}
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-400 mt-1">✓</span>
                                <span>
                                    <strong className="text-white">{t('extensionPrompt.features.secureConnectionTitle')}</strong>{' '}
                                    {t('extensionPrompt.features.secureConnectionDesc')}
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* Installation Steps */}
                    <div className="space-y-2 mt-4">
                        <h3 className="text-sm font-semibold text-white">{t('extensionPrompt.installTitle')}</h3>
                        <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
                            <li>{t('extensionPrompt.steps.step1')}</li>
                            <li>{t('extensionPrompt.steps.step2')}</li>
                            <li>{t('extensionPrompt.steps.step3')}</li>
                            <li>
                                {t('extensionPrompt.steps.step4Prefix')}{' '}
                                <code className="text-purple-400 bg-gray-800 px-1 rounded">extension</code>{' '}
                                {t('extensionPrompt.steps.step4Suffix')}
                            </li>
                        </ol>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex gap-3">
                    <button
                        onClick={handleOpenExtensionFolder}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all"
                    >
                        <Download size={18} />
                        {t('extensionPrompt.openFolder')}
                    </button>
                    <button
                        onClick={handleOpenInstructions}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                    >
                        <ExternalLink size={18} />
                        {t('extensionPrompt.viewInstructions')}
                    </button>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-gray-900/50 border-t border-gray-800 flex justify-between items-center">
                    <button
                        onClick={handleDismiss}
                        className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
                    >
                        {t('extensionPrompt.dismiss')}
                    </button>
                    <button
                        onClick={onClose}
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium"
                    >
                        {t('extensionPrompt.remindLater')}
                    </button>
                </div>
            </div>
        </div>
    );
};
