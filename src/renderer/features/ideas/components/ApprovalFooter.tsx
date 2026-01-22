import { CheckCircle, FolderOpen, XCircle } from 'lucide-react'
import React from 'react'

import { useTranslation } from '@/i18n'

interface ApprovalFooterProps {
    projectPath: string
    setProjectPath: (path: string) => void
    handleSelectFolder: () => Promise<void>
    onReject: () => Promise<void>
    handleApprove: () => Promise<void>
    isApproving: boolean
    isRejecting: boolean
}

export const ApprovalFooter: React.FC<ApprovalFooterProps> = ({
    projectPath,
    setProjectPath,
    handleSelectFolder,
    onReject,
    handleApprove,
    isApproving,
    isRejecting
}) => {
    const { t } = useTranslation()

    return (
        <div className="p-6 border-t border-white/10 bg-black/40">
            <div className="flex items-end gap-4">
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 block">
                        {t('ideas.idea.selectPath')}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={projectPath}
                            onChange={e => setProjectPath(e.target.value)}
                            placeholder="C:\Projects\my-project"
                            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/60 placeholder-white/10 focus:outline-none focus:border-purple-500/30 transition-all font-mono text-xs"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                void handleSelectFolder()
                            }}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                        >
                            <FolderOpen className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            void onReject()
                        }}
                        disabled={isRejecting || isApproving}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <XCircle className="w-4 h-4" />
                        {t('ideas.idea.reject')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            void handleApprove()
                        }}
                        disabled={!projectPath || isApproving || isRejecting}
                        className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <CheckCircle className="w-4 h-4" />
                        {isApproving ? t('ideas.idea.creating') : t('ideas.idea.approve')}
                    </button>
                </div>
            </div>
        </div>
    )
}
