import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkspaceMount, WorkspaceEntry } from '@/types';

interface WorkspaceModalsProps {
    showMountModal: boolean;
    setShowMountModal: (val: boolean) => void;
    mountForm: any;
    setMountForm: (val: any) => void;
    addMount: () => void;
    pickLocalFolder: () => void;
    entryModal: { type: string, entry?: WorkspaceEntry } | null;
    closeEntryModal: () => void;
    entryName: string;
    setEntryName: (val: string) => void;
    submitEntryModal: () => void;
    entryBusy: boolean;
}

/**
 * WorkspaceModals Component
 * 
 * Consolidates all dialogs and modals used within the workspace:
 * - Mount creation (Local/SSH)
 * - File/Folder CRUD operations (Create, Rename, Delete)
 * - Search dialog
 */
export const WorkspaceModals: React.FC<WorkspaceModalsProps> = ({
    showMountModal,
    setShowMountModal,
    mountForm,
    setMountForm,
    addMount,
    pickLocalFolder,
    entryModal,
    closeEntryModal,
    entryName,
    setEntryName,
    submitEntryModal,
    entryBusy
}) => {
    return (
        <>
            {/* Mount Modal */}
            {showMountModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <h3 className="text-sm font-bold text-white">Mevcut KlasÃ¶r veya Sunucu Ekle</h3>
                            <button onClick={() => setShowMountModal(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-2 bg-black/20 p-1 rounded-lg">
                                <button
                                    onClick={() => setMountForm((prev: any) => ({ ...prev, type: 'local' }))}
                                    className={cn("py-2 text-xs font-medium rounded-md transition-all", mountForm.type === 'local' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300")}
                                >
                                    Mevcut KlasÃ¶r
                                </button>
                                <button
                                    onClick={() => setMountForm((prev: any) => ({ ...prev, type: 'ssh' }))}
                                    className={cn("py-2 text-xs font-medium rounded-md transition-all", mountForm.type === 'ssh' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300")}
                                >
                                    SSH Sunucu
                                </button>
                            </div>

                            {mountForm.type === 'local' ? (
                                <div className="space-y-2">
                                    <label className="text-xs text-zinc-400 font-medium">KlasÃ¶r Yolu</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={mountForm.rootPath}
                                            onChange={e => setMountForm((prev: any) => ({ ...prev, rootPath: e.target.value }))}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                                            placeholder="C:\Users\Project"
                                        />
                                        <button onClick={pickLocalFolder} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-medium">SeÃ§</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2 space-y-1">
                                            <label className="text-xs text-zinc-400">Host</label>
                                            <input type="text" value={mountForm.host} onChange={e => setMountForm((prev: any) => ({ ...prev, host: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-zinc-400">Port</label>
                                            <input type="text" value={mountForm.port} onChange={e => setMountForm((prev: any) => ({ ...prev, port: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-zinc-400">KullanÄ±cÄ± AdÄ±</label>
                                        <input type="text" value={mountForm.username} onChange={e => setMountForm((prev: any) => ({ ...prev, username: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 mt-4">
                                <button onClick={() => setShowMountModal(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5">Ä°ptal</button>
                                <button
                                    onClick={addMount}
                                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400"
                                >
                                    Ekle
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Entry Actions Modal (Rename/Delete/Create/Search) */}
            {entryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#121214] border border-white/10 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-white capitalize">{entryModal.type}</h3>
                            <button onClick={closeEntryModal} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            {entryModal.type !== 'delete' && (
                                <input
                                    autoFocus
                                    type="text"
                                    value={entryName}
                                    onChange={(e) => setEntryName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && submitEntryModal()}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                                    placeholder="Name..."
                                />
                            )}
                            {entryModal.type === 'delete' && (
                                <p className="text-sm text-zinc-400">Are you sure you want to delete <span className="text-white font-medium">{entryModal.entry?.name}</span>?</p>
                            )}
                            <div className="flex justify-end gap-2">
                                <button onClick={closeEntryModal} className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5">Cancel</button>
                                <button
                                    onClick={submitEntryModal}
                                    disabled={entryBusy}
                                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-50"
                                >
                                    {entryBusy ? '...' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
