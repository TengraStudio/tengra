import { ArrowRight, Check, ChevronLeft, Code, Database, FolderOpen, Globe, Loader2, Plus, Server,Smartphone, Terminal } from 'lucide-react'
import React, { useEffect,useState } from 'react'

import { Modal } from '@/components/ui/modal'
import { Language,useTranslation } from '@/i18n'
import { AnimatePresence,motion } from '@/lib/framer-motion-compat'
import { cn } from '@/lib/utils'
import { ProjectMount, SSHFile } from '@/types'

interface ProjectWizardModalProps {
    isOpen: boolean
    onClose: () => void
    onProjectCreated: (path: string, name: string, description: string, mounts?: ProjectMount[]) => void
    language: Language
}

type Step = 'selection' | 'details' | 'ssh-connection' | 'ssh-browser' | 'creating'

const CATEGORIES = [
    { id: 'web', nameKey: 'projectWizard.categories.web', icon: Globe, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'backend', nameKey: 'projectWizard.categories.backend', icon: Database, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'cli', nameKey: 'projectWizard.categories.cli', icon: Terminal, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { id: 'mobile', nameKey: 'projectWizard.categories.mobile', icon: Smartphone, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { id: 'other', nameKey: 'projectWizard.categories.other', icon: Code, color: 'text-gray-400', bg: 'bg-gray-500/10' },
]

export const ProjectWizardModal: React.FC<ProjectWizardModalProps> = ({ isOpen, onClose, onProjectCreated, language }) => {
    const { t } = useTranslation(language)
    const [step, setStep] = useState<Step>('details')
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category: 'web',
        goal: ''
    })
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [sshForm, setSshForm] = useState({
        host: '',
        port: '22',
        username: '',
        authType: 'password' as 'password' | 'key',
        password: '',
        privateKey: '',
        passphrase: ''
    })

    const [sshConnectionId, setSshConnectionId] = useState<string | null>(null)
    const [sshPath, setSshPath] = useState<string>('/')
    const [sshFiles, setSshFiles] = useState<SSHFile[]>([])

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setStep('details')
            setFormData({ name: '', description: '', category: 'web', goal: '' })
            setSshForm({
                host: '',
                port: '22',
                username: '',
                authType: 'password',
                password: '',
                privateKey: '',
                passphrase: ''
            })
            setSshConnectionId(null)
            setSshPath('/')
            setSshFiles([])
            setIsLoading(false)
            setError(null)
        }
    }, [isOpen])

    const handleImportLocal = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await window.electron.selectDirectory()
            if (result.success && result.path) {
                onProjectCreated(result.path, formData.name, formData.description)
                onClose()
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to select directory')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSSHConnect = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await window.electron.ssh.connect({
                host: sshForm.host,
                port: parseInt(sshForm.port),
                username: sshForm.username,
                password: sshForm.password,
                privateKey: sshForm.privateKey,
                passphrase: sshForm.passphrase
            })

            if (result.success && result.id) {
                setSshConnectionId(result.id)
                setStep('ssh-browser')
                loadRemoteDirectory(result.id, '/')
            } else {
                setError(result.error || 'Failed to connect')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Connection failed')
        } finally {
            setIsLoading(false)
        }
    }

    const loadRemoteDirectory = async (connId: string, path: string) => {
        setIsLoading(true)
        try {
            const result = await window.electron.ssh.listDir(connId, path)
            if (result.success && result.files) {
                setSshFiles(result.files)
                setSshPath(path)
            } else {
                setError(result.error || 'Failed to list directory')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to list directory')
        } finally {
            setIsLoading(false)
        }
    }

    const handleCreate = async () => {
        if (!formData.name) {return}
        setIsLoading(true)
        setError(null)
        setStep('creating')

        try {
            const userData = await window.electron.getUserDataPath()
            const projectsDir = `${userData}\\projects`
            const projectPath = `${projectsDir}\\${formData.name.replace(/[^a-zA-Z0-9-_]/g, '-')}`

            await window.electron.createDirectory(projectsDir)
            await window.electron.createDirectory(projectPath)

            const readmeContent = `# ${formData.name}\n\n${formData.description}\n`
            await window.electron.writeFile(`${projectPath}\\README.md`, readmeContent)

            onProjectCreated(projectPath, formData.name, formData.description)
            onClose()

        } catch (err) {
            console.error('Project Creation Failed:', err)
            setError(err instanceof Error ? err.message : 'Failed to create project')
            setStep('selection')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('projectWizard.title')} size="3xl">
            <div className="relative min-h-[500px] flex flex-col">
                {isLoading && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center rounded-2xl">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-10 h-10 animate-spin text-primary" />
                            <span className="text-sm font-medium text-white/80 animate-pulse tracking-widest uppercase">
                                {step === 'creating' ? t('projectWizard.creating') : t('common.loading')}
                            </span>
                        </div>
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {step === 'details' && (
                        <motion.div
                            key="details"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6 flex-1 pt-4"
                        >
                            <div className="space-y-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('projectWizard.projectName')}</label>
                                        <input
                                            autoFocus
                                            value={formData.name}
                                            onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors text-white"
                                            placeholder={t('projectWizard.namePlaceholder')}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-3 block opacity-70 tracking-widest">{t('projects.categoryLabel')}</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                            {CATEGORIES.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => setFormData(p => ({ ...p, category: cat.id }))}
                                                    className={cn(
                                                        "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all gap-3 group relative overflow-hidden",
                                                        formData.category === cat.id
                                                            ? "bg-primary/20 border-primary shadow-lg shadow-primary/10"
                                                            : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                                                    )}
                                                >
                                                    {formData.category === cat.id && (
                                                        <div className="absolute top-2 right-2">
                                                            <Check className="w-3 h-3 text-primary" />
                                                        </div>
                                                    )}
                                                    <div className={cn("p-2.5 rounded-xl group-hover:scale-110 transition-transform shadow-sm", cat.bg, cat.color)}>
                                                        <cat.icon className="w-5 h-5" />
                                                    </div>
                                                    <span className={cn("text-[10px] font-black uppercase tracking-widest truncate w-full px-1 text-center", formData.category === cat.id ? "text-primary" : "text-muted-foreground")}>
                                                        {t(cat.nameKey)}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('projectWizard.description')}</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                            className="w-full h-24 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none text-white"
                                            placeholder={t('projectWizard.descPlaceholder')}
                                        />
                                    </div>
                                    {error && (
                                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs">
                                            {error}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 'selection' && (
                        <motion.div
                            key="selection"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                            className="flex flex-col items-center justify-center flex-1 h-full py-12"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl mx-auto px-2">
                                <button
                                    onClick={handleImportLocal}
                                    className="group relative h-72 bg-card hover:bg-accent/40 border border-border hover:border-primary/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-2xl hover:shadow-primary/10 overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-6 ring-1 ring-primary/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                                        <FolderOpen className="w-12 h-12" />
                                    </div>
                                    <h3 className="font-black text-2xl text-foreground tracking-tight leading-none">{t('projectWizard.alreadyExists')}</h3>
                                    <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed font-medium uppercase tracking-wider opacity-70">{t('projectWizard.alreadyExistsDesc')}</p>
                                    <div className="absolute bottom-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300">
                                        <ArrowRight className="w-5 h-5 text-primary" />
                                    </div>
                                </button>

                                <button
                                    onClick={() => setStep('ssh-connection')}
                                    className="group relative h-72 bg-card hover:bg-accent/40 border border-border hover:border-purple-500/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-2xl hover:shadow-purple-500/10 overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="w-24 h-24 rounded-3xl bg-purple-500/5 flex items-center justify-center text-purple-400 mb-6 ring-1 ring-purple-500/10 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                                        <Server className="w-12 h-12" />
                                    </div>
                                    <h3 className="font-black text-2xl text-foreground tracking-tight leading-none">{t('projectWizard.sshTodo')}</h3>
                                    <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed font-medium uppercase tracking-wider opacity-70">{t('projectWizard.sshTodoDesc')}</p>
                                </button>

                                <button
                                    onClick={handleCreate}
                                    className="group relative h-72 bg-card hover:bg-accent/40 border border-border hover:border-blue-500/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="w-24 h-24 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-6 ring-1 ring-blue-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                                        <Plus className="w-12 h-12" />
                                    </div>
                                    <h3 className="font-black text-2xl text-foreground tracking-tight leading-none">{t('projectWizard.newCreateTodo')}</h3>
                                    <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed font-medium uppercase tracking-wider opacity-70">{t('projectWizard.newCreateTodoDesc')}</p>
                                    <div className="absolute bottom-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300">
                                        <ArrowRight className="w-5 h-5 text-blue-400" />
                                    </div>
                                </button>
                            </div>

                        </motion.div>
                    )}

                    {step === 'ssh-connection' && (
                        <motion.div
                            key="ssh-connection"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6 flex-1 pt-4"
                        >
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('common.host')}</label>
                                        <input
                                            autoFocus
                                            value={sshForm.host}
                                            onChange={e => setSshForm(p => ({ ...p, host: e.target.value }))}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors text-white"
                                            placeholder="example.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('common.port')}</label>
                                        <input
                                            value={sshForm.port}
                                            onChange={e => setSshForm(p => ({ ...p, port: e.target.value }))}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors text-white"
                                            placeholder="22"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('common.username')}</label>
                                    <input
                                        value={sshForm.username}
                                        onChange={e => setSshForm(p => ({ ...p, username: e.target.value }))}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors text-white"
                                        placeholder="root"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('common.authType')}</label>
                                    <div className="flex bg-black/20 rounded-lg p-1 border border-white/10">
                                        <button
                                            onClick={() => setSshForm(p => ({ ...p, authType: 'password' }))}
                                            className={cn(
                                                "flex-1 py-2 rounded-md text-xs font-medium transition-all",
                                                sshForm.authType === 'password' ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground hover:text-white"
                                            )}
                                        >
                                            Password
                                        </button>
                                        <button
                                            onClick={() => setSshForm(p => ({ ...p, authType: 'key' }))}
                                            className={cn(
                                                "flex-1 py-2 rounded-md text-xs font-medium transition-all",
                                                sshForm.authType === 'key' ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground hover:text-white"
                                            )}
                                        >
                                            Private Key
                                        </button>
                                    </div>
                                </div>

                                {sshForm.authType === 'password' ? (
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('common.password')}</label>
                                        <input
                                            type="password"
                                            value={sshForm.password}
                                            onChange={e => setSshForm(p => ({ ...p, password: e.target.value }))}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors text-white"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('common.privateKey')}</label>
                                            <textarea
                                                value={sshForm.privateKey}
                                                onChange={e => setSshForm(p => ({ ...p, privateKey: e.target.value }))}
                                                className="w-full h-24 bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors text-white font-mono text-xs resize-none"
                                                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('common.passphrase')} (Optional)</label>
                                            <input
                                                type="password"
                                                value={sshForm.passphrase}
                                                onChange={e => setSshForm(p => ({ ...p, passphrase: e.target.value }))}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors text-white"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {step === 'ssh-browser' && (
                        <motion.div
                            key="ssh-browser"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-4 flex-1 pt-4 flex flex-col min-h-0"
                        >
                            <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/10">
                                <Terminal className="w-4 h-4 text-purple-400 shrink-0" />
                                <input
                                    value={sshPath}
                                    onChange={e => setSshPath(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && sshConnectionId) {
                                            loadRemoteDirectory(sshConnectionId, sshPath)
                                        }
                                    }}
                                    className="flex-1 bg-transparent text-sm text-white focus:outline-none font-mono"
                                />
                                <button
                                    onClick={() => sshConnectionId && loadRemoteDirectory(sshConnectionId, sshPath)}
                                    className="p-1 hover:bg-white/10 rounded-md transition-colors"
                                >
                                    <ArrowRight className="w-4 h-4 text-white/50" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-black/20 rounded-xl border border-white/10 p-2 space-y-1">
                                {sshPath !== '/' && (
                                    <button
                                        onClick={() => {
                                            const parent = sshPath.split('/').slice(0, -1).join('/') || '/'
                                            if (sshConnectionId) {loadRemoteDirectory(sshConnectionId, parent)}
                                        }}
                                        className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg text-left transition-colors group"
                                    >
                                        <FolderOpen className="w-4 h-4 text-yellow-500/70 group-hover:text-yellow-400" />
                                        <span className="text-sm text-white/70 group-hover:text-white">..</span>
                                    </button>
                                )}
                                {sshFiles.map((file, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            if (file.isDirectory && sshConnectionId) {
                                                const newPath = sshPath === '/' ? `/${file.name}` : `${sshPath}/${file.name}`
                                                loadRemoteDirectory(sshConnectionId, newPath)
                                            }
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg text-left transition-colors group",
                                            !file.isDirectory && "opacity-50 cursor-default"
                                        )}
                                    >
                                        {file.isDirectory ? (
                                            <FolderOpen className="w-4 h-4 text-blue-400/70 group-hover:text-blue-400" />
                                        ) : (
                                            <Code className="w-4 h-4 text-white/30" />
                                        )}
                                        <span className="text-sm text-white/80 group-hover:text-white truncate">{file.name}</span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {step === 'creating' && (
                        <motion.div
                            key="creating"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
                        >
                            <div className="relative">
                                <Loader2 className="w-16 h-16 animate-spin text-primary" />
                                <Check className="w-6 h-6 text-primary absolute inset-0 m-auto opacity-0 animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-light text-white">{t('projectWizard.creating')}</h3>
                                <p className="text-muted-foreground mt-2 max-w-[280px] mx-auto text-sm">
                                    {t('projectWizard.configuring')}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {step !== 'creating' && (
                    <div className="flex justify-between items-center pt-6 border-t border-white/5 mt-auto">
                        <button
                            onClick={() => {
                                if (step === 'selection') {setStep('details')}
                                else if (step === 'ssh-connection') {setStep('selection')}
                                else {onClose()}
                            }}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                        >
                            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            {t('projectWizard.back')}
                        </button>

                        <div className="flex gap-3">
                            {step === 'details' && (
                                <button
                                    onClick={() => {
                                        if (!formData.name) {return}
                                        setStep('selection')
                                    }}
                                    disabled={!formData.name}
                                    className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2 shadow-lg shadow-primary/20"
                                >
                                    {t('projectWizard.next')}
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            )}

                            {step === 'ssh-connection' && (
                                <button
                                    onClick={handleSSHConnect}
                                    disabled={!sshForm.host || !sshForm.username || isLoading}
                                    className="px-6 py-2.5 bg-purple-500 text-white rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2 shadow-lg shadow-purple-500/20"
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                    {t('common.connect')}
                                </button>
                            )}

                            {step === 'ssh-browser' && (
                                <button
                                    onClick={() => {
                                        const remotePath = `ssh://${sshForm.username}@${sshForm.host}:${sshPath}`
                                        onProjectCreated(remotePath, formData.name, formData.description)
                                        onClose()
                                    }}
                                    className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
                                >
                                    {t('projectWizard.select')}
                                    <Check className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    )
}
