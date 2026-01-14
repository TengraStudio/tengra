import { exec } from 'child_process'
import * as http from 'http'
import { promisify } from 'util'

import { getErrorMessage } from '@shared/utils/error.util'
import { BrowserWindow, dialog } from 'electron'


const execAsync = promisify(exec)

// Force IPv4 fetch helper
function fetchIPv4(url: string, options?: RequestInit): Promise<Response> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url)
        const headers = options?.headers
            ? Object.fromEntries(new Headers(options.headers).entries())
            : undefined
        const reqOptions: http.RequestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname + urlObj.search,
            method: options?.method || 'GET',
            headers,
            family: 4 // Force IPv4
        }

        const req = http.request(reqOptions, (res) => {
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => {
                resolve({
                    ok: res.statusCode! >= 200 && res.statusCode! < 300,
                    status: res.statusCode!,
                    json: () => Promise.resolve(JSON.parse(data)),
                    text: () => Promise.resolve(data)
                } as Response)
            })
        })

        req.on('error', reject)
        req.setTimeout(5000, () => {
            req.destroy()
            reject(new Error('Request timeout'))
        })

        if (options?.body) {
            req.write(options.body as string)
        }
        req.end()
    })
}

export async function isOllamaRunning(): Promise<boolean> {
    try {
        const response = await fetchIPv4('http://127.0.0.1:11434/api/tags')
        return response.ok
    } catch {
        return false
    }
}

async function isOllamaInstalled(): Promise<boolean> {
    try {
        await execAsync('where ollama', { shell: 'powershell.exe' })
        return true
    } catch {
        try {
            const result = await execAsync('Test-Path "$env:LOCALAPPDATA\\Programs\\Ollama\\ollama.exe"', { shell: 'powershell.exe' })
            return result.stdout.trim().toLowerCase() === 'true'
        } catch {
            return false
        }
    }
}

export async function startOllama(
    getMainWindow: () => BrowserWindow | null,
    askPermission: boolean = false
): Promise<{ success: boolean; message: string }> {
    try {
        if (await isOllamaRunning()) {
            return { success: true, message: 'Ollama zaten ÇõalŽñYŽñyor' }
        }

        const installed = await isOllamaInstalled()
        if (!installed) {
            return {
                success: false,
                message: 'Ollama kurulu deŽYil. https://ollama.com adresinden indirin.'
            }
        }

        if (askPermission) {
            const win = getMainWindow()
            if (win) {
                const result = await dialog.showMessageBox(win, {
                    type: 'question',
                    buttons: ['Evet', 'HayŽñr'],
                    defaultId: 0,
                    title: 'Ollama BaYlat',
                    message: 'Ollama baYlatŽñlsŽñn mŽñ?',
                    detail: 'AI modellerini kullanmak iÇõin Ollama\'nŽñn ÇõalŽñYŽñyor olmasŽñ gerekiyor.'
                })

                if (result.response !== 0) {
                    return { success: false, message: 'KullanŽñcŽñ Ollama baYlatmayŽñ reddetti' }
                }
            }
        }

        try {
            await execAsync(
                'Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden',
                { shell: 'powershell.exe' }
            )
        } catch {
            try {
                await execAsync(
                    'Start-Process -FilePath "$env:LOCALAPPDATA\\Programs\\Ollama\\ollama.exe" -ArgumentList "serve" -WindowStyle Hidden',
                    { shell: 'powershell.exe' }
                )
            } catch {
                return { success: false, message: 'Ollama baYlatŽñlamadŽñ' }
            }
        }

        for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 500))
            if (await isOllamaRunning()) {
                return { success: true, message: 'Ollama baYlatŽñldŽñ' }
            }
        }

        return { success: false, message: 'Ollama baYlatŽñlamadŽñ. LÇ¬tfen manuel olarak baYlatŽñn.' }
    } catch (error) {
        const message = getErrorMessage(error as Error)
        return { success: false, message: `Ollama ba Ylatma hatasŽñ: ${message}` }
    }
}
