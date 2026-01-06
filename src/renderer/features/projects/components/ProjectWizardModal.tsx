import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, FolderOpen, Code, Terminal, Database, Smartphone, Globe, ArrowRight, ChevronLeft, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProjectWizardModalProps {
    isOpen: boolean
    onClose: () => void
    onProjectCreated: (path: string, name: string, description: string) => void
    onImportProject: () => void
}

type Step = 'selection' | 'details' | 'creating'

const CATEGORIES = [
    { id: 'web', name: 'Web Application', icon: Globe, color: 'text-blue-400' },
    { id: 'backend', name: 'Backend Service', icon: Database, color: 'text-emerald-400' },
    { id: 'cli', name: 'CLI / Script', icon: Terminal, color: 'text-amber-400' },
    { id: 'mobile', name: 'Mobile App', icon: Smartphone, color: 'text-purple-400' },
    { id: 'other', name: 'Custom Project', icon: Code, color: 'text-gray-400' },
]

export const ProjectWizardModal: React.FC<ProjectWizardModalProps> = ({ isOpen, onClose, onProjectCreated, onImportProject }) => {
    const [step, setStep] = useState<Step>('selection')
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category: 'web',
        goal: ''
    })

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setStep('selection')
            setFormData({ name: '', description: '', category: 'web', goal: '' })
        }
    }, [isOpen])

    const handleCreate = async () => {
        if (!formData.name) return

        setStep('creating')

        try {
            // 1. Get Home Dir
            const { stdout } = await window.electron.runCommand('echo %USERPROFILE%', [], '')
            const homeDir = stdout.trim()
            const orbitDir = `${homeDir}\\Documents\\Orbit`
            const projectsDir = `${orbitDir}\\Projects`
            const projectPath = `${projectsDir}\\${formData.name.replace(/[^a-zA-Z0-9-_]/g, '-')}`

            // 2. Ensure Directories
            await window.electron.createDirectory(orbitDir)
            await window.electron.createDirectory(projectsDir)
            await window.electron.createDirectory(`${orbitDir}\\Gallery`)
            await window.electron.createDirectory(`${orbitDir}\\Config`)

            // 3. Create Project Directory
            const dirResult = await window.electron.createDirectory(projectPath)
            if (!dirResult.success && dirResult.error?.includes('exists')) {
                // If exists, strictly we might want to warn, but for now we proceed or fail?
                // Proceeding allows attaching to empty folder
            }

            // 4. Create README.md with content
            const readmeContent = `# ${formData.name}\n\n${formData.description}\n\n## Project Goal\n${formData.goal}\n\n## Category\n${CATEGORIES.find(c => c.id === formData.category)?.name}\n`
            await window.electron.writeFile(`${projectPath}\\README.md`, readmeContent)

            // 5. Callback to create in DB
            onProjectCreated(projectPath, formData.name, formData.description) // This will close modal typically

        } catch (error) {
            console.error('Wizard Creation Failed:', error)
            // handle error state?
            setStep('details')
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={step === 'selection' ? 'Yeni Proje' : 'Proje DetaylarÄ±'}>
            <div className="min-h-[400px] flex flex-col">
                <AnimatePresence mode="wait">
                    {step === 'selection' && (
                        <motion.div
                            key="selection"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="grid grid-cols-2 gap-4 flex-1 items-center content-center pt-8"
                        >
                            <button
                                onClick={() => setStep('details')}
                                className="group h-48 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all hover:scale-105"
                            >
                                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                                    <Plus className="w-8 h-8" />
                                </div>
                                <h3 className="font-medium text-lg text-foreground">Yeni OluÅŸtur</h3>
                                <p className="text-sm text-muted-foreground mt-2">SÄ±fÄ±rdan yeni bir proje baÅŸlat</p>
                            </button>

                            <button
                                onClick={onImportProject}
                                className="group h-48 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all hover:scale-105"
                            >
                                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                                    <FolderOpen className="w-8 h-8" />
                                </div>
                                <h3 className="font-medium text-lg text-foreground">Ä°Ã§e Aktar</h3>
                                <p className="text-sm text-muted-foreground mt-2">Mevcut bir klasÃ¶rÃ¼ ekle</p>
                            </button>
                        </motion.div>
                    )}

                    {step === 'details' && (
                        <motion.div
                            key="details"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6 flex-1 pt-4"
                        >
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Proje AdÄ±</label>
                                    <input
                                        autoFocus
                                        value={formData.name}
                                        onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors"
                                        placeholder="Ã–rn: Super App"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Kategori</label>
                                        <div className="grid gap-2">
                                            {CATEGORIES.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => setFormData(p => ({ ...p, category: cat.id }))}
                                                    className={cn(
                                                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm border transition-all text-left",
                                                        formData.category === cat.id
                                                            ? "bg-primary/10 border-primary/50 text-primary"
                                                            : "bg-white/5 border-transparent hover:bg-white/10 text-muted-foreground"
                                                    )}
                                                >
                                                    <cat.icon className={cn("w-4 h-4", cat.color)} />
                                                    {cat.name}
                                                    {formData.category === cat.id && <Check className="w-3.5 h-3.5 ml-auto" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">AÃ§Ä±klama</label>
                                            <textarea
                                                value={formData.description}
                                                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                                className="w-full h-20 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none"
                                                placeholder="KÄ±sa bir aÃ§Ä±klama..."
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Proje Hedefi</label>
                                            <textarea
                                                value={formData.goal}
                                                onChange={e => setFormData(p => ({ ...p, goal: e.target.value }))}
                                                className="w-full h-32 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none font-mono"
                                                placeholder="Bu projenin temel amacÄ± nedir? (AI baÄŸlamÄ± iÃ§in kullanÄ±lÄ±r)"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 'creating' && (
                        <motion.div
                            key="creating"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex-1 flex flex-col items-center justify-center text-center space-y-4"
                        >
                            <Loader2 className="w-12 h-12 animate-spin text-primary" />
                            <div>
                                <h3 className="text-xl font-light">Proje HazÄ±rlanÄ±yor...</h3>
                                <p className="text-muted-foreground mt-1">Dosyalar oluÅŸturuluyor ve yapÄ±landÄ±rÄ±lÄ±yor</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {step === 'details' && (
                    <div className="flex justify-between items-center pt-6 border-t border-white/10 mt-auto">
                        <button
                            onClick={() => setStep('selection')}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Geri
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={!formData.name}
                            className="px-6 py-2.5 bg-primary rounded-lg text-primary-foreground font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            OluÅŸtur
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    )
}
