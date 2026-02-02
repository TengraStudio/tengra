import { AlertCircle,Download, ExternalLink, X } from 'lucide-react';
import React from 'react';

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
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur">
                            <Download size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                Enhance Your Experience
                            </h2>
                            <p className="text-white/80 text-sm">
                                Install the Tandem Browser Extension
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
                                What is the browser extension?
                            </p>
                            <p>
                                The Tandem browser extension allows the AI to interact directly with web
                                pages. It can read content, fill forms, click buttons, and perform
                                automated actions based on your commands.
                            </p>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-white">Features:</h3>
                        <ul className="space-y-2 text-sm text-gray-300">
                            <li className="flex items-start gap-2">
                                <span className="text-green-400 mt-1">✓</span>
                                <span>
                                    <strong className="text-white">AI Chat in Browser:</strong> Chat with
                                    AI directly from any webpage
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-400 mt-1">✓</span>
                                <span>
                                    <strong className="text-white">Page Interaction:</strong> AI can read,
                                    click, and fill forms automatically
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-400 mt-1">✓</span>
                                <span>
                                    <strong className="text-white">Content Extraction:</strong> Extract and
                                    summarize page content with one click
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-400 mt-1">✓</span>
                                <span>
                                    <strong className="text-white">Secure Connection:</strong> All
                                    communication stays local on your computer
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* Installation Steps */}
                    <div className="space-y-2 mt-4">
                        <h3 className="text-sm font-semibold text-white">Quick Installation:</h3>
                        <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
                            <li>Open Chrome and go to chrome://extensions/</li>
                            <li>Enable &quot;Developer mode&quot; (toggle in top-right)</li>
                            <li>Click &quot;Load unpacked&quot;</li>
                            <li>
                                Select the <code className="text-purple-400 bg-gray-800 px-1 rounded">extension</code> folder from Tandem directory
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
                        Open Extension Folder
                    </button>
                    <button
                        onClick={handleOpenInstructions}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                    >
                        <ExternalLink size={18} />
                        View Instructions
                    </button>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-gray-900/50 border-t border-gray-800 flex justify-between items-center">
                    <button
                        onClick={handleDismiss}
                        className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
                    >
                        Don&apos;t show this again
                    </button>
                    <button
                        onClick={onClose}
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium"
                    >
                        Remind me later
                    </button>
                </div>
            </div>
        </div>
    );
};
