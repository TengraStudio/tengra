import { useCallback, useEffect, useRef, useState } from 'react'

import { AppSettings } from '@/types'

import { DeviceCodeModalState } from '../components/DeviceCodeModal'
import { AuthFile, AuthStatusState } from '../types'

const INITIAL_MODAL_STATE: DeviceCodeModalState = {
    isOpen: false,
    userCode: '',
    verificationUri: '',
    provider: 'github',
    status: 'pending',
    errorMessage: undefined
}

export function useSettingsAuth(
    settings: AppSettings | null,
    updateSettings: (s: AppSettings, save: boolean) => Promise<void>,
    onRefreshModels?: () => void,
    onRefreshAccounts?: () => Promise<void>
) {
    const [statusMessage, setStatusMessage] = useState('')
    const [authMessage, setAuthMessage] = useState('')
    const [authBusy, setAuthBusy] = useState<string | null>(null)
    const [isOllamaRunning, setIsOllamaRunning] = useState(false)
    const [authStatus, setAuthStatus] = useState<AuthStatusState>({ codex: false, claude: false, antigravity: false, copilot: false })
    const [deviceCodeModal, setDeviceCodeModal] = useState<DeviceCodeModalState>(INITIAL_MODAL_STATE)
    const authMessageTimer = useRef<NodeJS.Timeout | null>(null)

    const refreshAuthStatus = useCallback(async () => {
        try {
            const status = await window.electron.checkAuthStatus()
            const files = (status?.files || []) as AuthFile[]
            const hasProvider = (providerNames: string[]) => {
                return files.some((f: AuthFile) => {
                    const fileProvider = (f.provider || f.type || '').toLowerCase()
                    const fileName = (f.name || '').toLowerCase()
                    return providerNames.some(name =>
                        fileProvider === name || fileName.startsWith(name + '-')
                    )
                })
            }

            console.log('[SettingsAuth] refreshAuthStatus: Auth files found:', JSON.stringify(files));
            const newStatus = {
                codex: hasProvider(['codex', 'openai']),
                claude: hasProvider(['claude', 'anthropic']),
                antigravity: hasProvider(['antigravity']),
                copilot: hasProvider(['copilot', 'copilot_token'])
            };
            setAuthStatus(newStatus)
        } catch (error) {
            console.error('Auth check failed:', error)
        }
    }, [])

    const checkOllama = useCallback(async () => {
        try {
            const running = await window.electron.isOllamaRunning()
            setIsOllamaRunning(!!running)
        } catch {
            setIsOllamaRunning(false)
        }
    }, [])

    useEffect(() => {
        void refreshAuthStatus()
        void checkOllama()
    }, [refreshAuthStatus, checkOllama])

    const startOllama = async () => {
        try {
            const result = await window.electron.startOllama()
            if (result?.message) {
                setStatusMessage(result.message)
                setTimeout(() => setStatusMessage(''), 2000)
            }
        } catch (error) {
            console.error('Failed to start Ollama:', error)
        } finally {
            checkOllama()
        }
    }

    const setAuthNotice = (message: string, duration = 5000) => {
        if (authMessageTimer.current) { clearTimeout(authMessageTimer.current) }
        setAuthMessage(message)
        if (message && duration > 0) {
            authMessageTimer.current = setTimeout(() => setAuthMessage(''), duration)
        }
    }

    const connectGitHubProfile = async () => {
        if (!settings) { return }
        setAuthBusy('github')
        setAuthNotice('')
        try {
            const data = await window.electron.githubLogin('profile')

            // Open the modal with device code
            if (data?.user_code && data?.verification_uri) {
                setDeviceCodeModal({
                    isOpen: true,
                    userCode: data.user_code,
                    verificationUri: data.verification_uri,
                    provider: 'github',
                    status: 'pending',
                    errorMessage: undefined
                })
                window.electron.openExternal(data.verification_uri)
            }

            const pollResult = await window.electron.pollToken(data.device_code, data.interval, 'profile')
            if (pollResult.success && pollResult.token) {
                const updated: AppSettings = {
                    ...settings,
                    github: { username: (settings.github as { username?: string })?.username ?? 'GitHub User', token: pollResult.token }
                }
                await updateSettings(updated, true)
                setDeviceCodeModal(prev => ({ ...prev, status: 'success' }))
                setTimeout(() => setDeviceCodeModal(INITIAL_MODAL_STATE), 2000)
            } else {
                setDeviceCodeModal(prev => ({ ...prev, status: 'error', errorMessage: 'GitHub bağlanamadı.' }))
            }
        } catch (error) {
            console.error('GitHub auth failed:', error)
            setDeviceCodeModal(prev => ({ ...prev, status: 'error', errorMessage: 'GitHub bağlanamadı.' }))
        } finally {
            setAuthBusy(null)
        }
    }

    const connectCopilot = async () => {
        if (!settings) { return }
        setAuthBusy('copilot')
        setAuthNotice('')
        try {
            const data = await window.electron.githubLogin('copilot')

            // Open the modal with device code
            if (data?.user_code && data?.verification_uri) {
                setDeviceCodeModal({
                    isOpen: true,
                    userCode: data.user_code,
                    verificationUri: data.verification_uri,
                    provider: 'copilot',
                    status: 'pending',
                    errorMessage: undefined
                })
                window.electron.openExternal(data.verification_uri)
            }

            const pollResult = await window.electron.pollToken(data.device_code, data.interval, 'copilot')
            if (pollResult.success && pollResult.token) {
                const updated: AppSettings = {
                    ...settings,
                    copilot: { ...(settings.copilot ?? { connected: false }), connected: true, token: pollResult.token }
                }
                await updateSettings(updated, true)
                setDeviceCodeModal(prev => ({ ...prev, status: 'success' }))
                setTimeout(() => setDeviceCodeModal(INITIAL_MODAL_STATE), 2000)
            } else {
                setDeviceCodeModal(prev => ({ ...prev, status: 'error', errorMessage: 'Copilot bağlanamadı.' }))
            }
        } catch (error) {
            console.error('Copilot auth failed:', error)
            setDeviceCodeModal(prev => ({ ...prev, status: 'error', errorMessage: 'Copilot bağlanamadı.' }))
        } finally {
            setAuthBusy(null)
        }
    }

    const closeDeviceCodeModal = useCallback(() => {
        setDeviceCodeModal(INITIAL_MODAL_STATE)
    }, [])

    const connectBrowserProvider = async (provider: 'codex' | 'claude' | 'antigravity') => {
        setAuthBusy(provider)
        setAuthNotice('')
        try {
            const loginFn = {
                codex: window.electron.codexLogin,
                claude: window.electron.claudeLogin,
                antigravity: window.electron.antigravityLogin
            }[provider]

            const result = await loginFn()
            if (result?.url) {
                window.electron.openExternal(result.url)
                navigator.clipboard.writeText(result.url).then(() => {
                    setAuthNotice('Link kopyalandi! Tarayicida acilmadiysa, yeni sekme acip yapistirin.')
                }).catch(() => {
                    setAuthNotice('Link aciliyor... Lutfen tarayicida giris yapin.', 10000)
                })
            }

            let attempts = 0
            const maxAttempts = 20
            const pollInterval = 3000

            const check = async () => {
                attempts++
                try {
                    const status = await window.electron.checkAuthStatus()
                    const files = (status?.files || []) as AuthFile[]
                    const providerIdentifiers: string[] = []
                    switch (provider) {
                        case 'claude': providerIdentifiers.push('claude', 'anthropic'); break
                        case 'antigravity': providerIdentifiers.push('antigravity'); break
                        case 'codex': providerIdentifiers.push('codex', 'openai'); break
                    }

                    const isConnected = files.some((f: AuthFile) => {
                        const fileProvider = (f.provider || f.type || '').toLowerCase()
                        const fileName = (f.name || '').toLowerCase()
                        return providerIdentifiers.some(name => fileProvider === name || fileName.startsWith(name + '-'))
                    })

                    if (isConnected) {
                        setAuthNotice('Baglanti Basarili!')
                        await refreshAuthStatus()
                        await onRefreshAccounts?.()
                        onRefreshModels?.()
                        return true
                    }
                } catch (e) {
                    console.error('[SettingsAuth] Poll error:', e)
                }

                if (attempts < maxAttempts) {
                    setTimeout(check, pollInterval)
                } else {
                    setAuthNotice('Zaman asimi: Token tespit edilemedi. Lutfen sayfayi yenileyin.', 0)
                }
                return false
            }
            setTimeout(check, 2000)
        } catch (error) {
            console.error(`${provider} auth failed:`, error)
            setAuthNotice('Baglanti basarisiz.')
        } finally {
            setAuthBusy(null)
        }
    }

    const disconnectProvider = async (provider: 'copilot' | 'codex' | 'claude' | 'antigravity') => {
        if (!settings) { return }
        const updated: AppSettings = { ...settings }

        try {
            const status = await window.electron.checkAuthStatus()
            const files = (status?.files || []) as AuthFile[]
            const providerIdentifiers: string[] = []
            switch (provider) {
                case 'claude': providerIdentifiers.push('claude', 'anthropic'); break
                case 'antigravity': providerIdentifiers.push('antigravity'); break
                case 'codex': providerIdentifiers.push('codex'); break
                case 'copilot': providerIdentifiers.push('copilot'); break
            }

            const targets = files.filter((f) => {
                const fileProvider = (f.provider || f.type || '').toLowerCase()
                const fileName = (f.name || '').toLowerCase()
                return providerIdentifiers.some(id => fileProvider === id || fileName.startsWith(id + '-'))
            })

            for (const t of targets) {
                await window.electron.deleteProxyAuthFile(t.name || '')
            }
        } catch (e) {
            console.error('[SettingsAuth] Backend auth deletion failed:', e)
        }

        if (provider === 'copilot') { updated.copilot = { connected: false } }
        if (provider === 'codex') {
            if (updated.openai?.apiKey === 'connected') { updated.openai = { ...updated.openai, apiKey: '' } }
            updated.codex = { connected: false }
            setAuthStatus(prev => ({ ...prev, codex: false }))
        }
        if (provider === 'claude') {
            if (updated.claude?.apiKey === 'connected') { updated.claude = { ...updated.claude, apiKey: '' } }
            if (updated.anthropic?.apiKey === 'connected') { updated.anthropic = { ...updated.anthropic, apiKey: '' } }
            setAuthStatus(prev => ({ ...prev, claude: false }))
        }

        if (provider === 'antigravity') {
            updated.antigravity = { ...(updated.antigravity || { connected: false }), connected: false }
            setAuthStatus(prev => ({ ...prev, antigravity: false }))
        }

        await updateSettings(updated, true)
        await new Promise(resolve => setTimeout(resolve, 500))
        await refreshAuthStatus()
    }

    return {
        statusMessage,
        setStatusMessage,
        authMessage,
        authBusy,
        isOllamaRunning,
        authStatus,
        startOllama,
        checkOllama,
        refreshAuthStatus,
        connectGitHubProfile,
        connectCopilot,
        connectBrowserProvider,
        disconnectProvider,
        deviceCodeModal,
        closeDeviceCodeModal
    }
}
