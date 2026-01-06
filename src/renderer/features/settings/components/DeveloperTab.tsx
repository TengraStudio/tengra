import React from 'react'
import { Terminal, RefreshCw } from 'lucide-react'
import { AppSettings } from '../../hooks/useSettingsLogic'

interface DeveloperTabProps {
    settings: AppSettings | null
    setStatusMessage: (m: string) => void
    onRefreshModels: () => void
    loadSettings: () => Promise<void>
    setIsLoading: (v: boolean) => void
}

export const DeveloperTab: React.FC<DeveloperTabProps> = ({ settings, setStatusMessage, onRefreshModels, loadSettings, setIsLoading }) => {
    return (
        <div className="space-y-6">
            <div className="bg-card p-6 rounded-xl border border-border">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary"><Terminal className="w-5 h-5" /></div>
                    <div><h3 className="text-lg font-bold text-white">GeliÅŸtirici SeÃ§enekleri</h3><p className="text-xs text-muted-foreground">GeliÅŸmiÅŸ ayarlar ve hata ayÄ±klama araÃ§larÄ±.</p></div>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                        <div><div className="text-sm font-bold text-white">Ã–nbelleÄŸi Temizle</div><div className="text-xs text-muted-foreground">Uygulama Ã¶nbelleÄŸini ve geÃ§ici dosyalarÄ± siler.</div></div>
                        <button onClick={() => { localStorage.clear(); sessionStorage.clear(); setStatusMessage('Ã–nbellek temizlendi!'); setTimeout(() => setStatusMessage(''), 3000); }} className="px-3 py-2 rounded-lg text-xs font-bold bg-white/5 text-muted-foreground border border-white/10">Temizle</button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                        <div><div className="text-sm font-bold text-white">TÃ¼m Verileri Yenile</div><div className="text-xs text-muted-foreground">TÃ¼m veri kaynaklarÄ±nÄ± yeniden yÃ¼kler.</div></div>
                        <button onClick={async () => { try { setIsLoading(true); onRefreshModels(); await loadSettings(); setStatusMessage('Veriler yenilendi!'); setTimeout(() => setStatusMessage(''), 3000); } finally { setIsLoading(false); } }} className="px-3 py-2 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" /> Yenile</button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                        <div><div className="text-sm font-bold text-white">AyarlarÄ± DÄ±ÅŸa Aktar</div><div className="text-xs text-muted-foreground">TÃ¼m ayarlarÄ±nÄ±zÄ± JSON dosyasÄ± olarak indirin.</div></div>
                        <button onClick={() => { if (!settings) return; const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `orbit-settings-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url); setStatusMessage('Ayarlar dÄ±ÅŸa aktarÄ±ldÄ±!'); setTimeout(() => setStatusMessage(''), 3000); }} className="px-3 py-2 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20">DÄ±ÅŸa Aktar</button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                        <div><div className="text-sm font-bold text-white">AyarlarÄ± Ä°Ã§e Aktar</div><div className="text-xs text-muted-foreground">Daha Ã¶nce dÄ±ÅŸa aktarÄ±lan ayarlarÄ± geri yÃ¼kleyin.</div></div>
                        <label className="px-3 py-2 rounded-lg text-xs font-bold bg-white/5 text-muted-foreground border border-white/10 cursor-pointer">Ä°Ã§e Aktar<input type="file" accept=".json" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const imported = JSON.parse(await file.text()); await window.electron.saveSettings(imported); await loadSettings(); setStatusMessage('Ayarlar iÃ§e aktarÄ±ldÄ±!'); setTimeout(() => setStatusMessage(''), 3000); } catch (err) { alert('GeÃ§ersiz ayar dosyasÄ±!'); } }} /></label>
                    </div>
                </div>
            </div>
        </div>
    )
}
