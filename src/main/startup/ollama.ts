import { exec } from 'child_process';
import * as http from 'http';
import { promisify } from 'util';

import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { BrowserWindow, dialog } from 'electron';

import { appLogger } from '../logging/logger';


const execAsync = promisify(exec);

// Force IPv4 fetch helper
function fetchIPv4(url: string, options?: RequestInit): Promise<Response> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const headers = options?.headers
            ? Object.fromEntries(new Headers(options.headers).entries())
            : undefined;
        const reqOptions: http.RequestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port ? parseInt(urlObj.port) : 80,
            path: urlObj.pathname + urlObj.search,
            method: options?.method ?? 'GET',
            headers,
            family: 4 // Force IPv4
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const statusCode = res.statusCode ?? 0;
                resolve({
                    ok: statusCode >= 200 && statusCode < 300,
                    status: statusCode,
                    json: () => Promise.resolve(safeJsonParse(data, {})),
                    text: () => Promise.resolve(data)
                } as unknown as Response);
            });
        });

        req.on('error', reject);
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options?.body) {
            req.write(options.body as string);
        }
        req.end();
    });
}

export async function isOllamaRunning(): Promise<boolean> {
    try {
        const response = await fetchIPv4('http://127.0.0.1:11434/api/tags');
        return response.ok;
    } catch {
        return false;
    }
}

async function isOllamaInstalled(): Promise<boolean> {
    try {
        // Try native check first (clean command)
        await execAsync('where ollama', { shell: 'powershell.exe' });
        return true;
    } catch {
        try {
            // Check formatted path
            const checkCommand = 'Test-Path "$env:LOCALAPPDATA\\Programs\\Ollama\\ollama.exe"';
            const result = await execAsync(checkCommand, { shell: 'powershell.exe' });
            return result.stdout.trim().toLowerCase() === 'true';
        } catch {
            return false;
        }
    }
}

export async function startOllama(
    getMainWindow: () => BrowserWindow | null,
    askPermission: boolean = false
): Promise<{ success: boolean; message: string }> {
    try {
        if (await isOllamaRunning()) {
            return { success: true, message: 'Ollama zaten çalışıyor' };
        }

        const installed = await isOllamaInstalled();
        if (!installed) {
            return {
                success: false,
                message: 'Ollama kurulu değil. https://ollama.com adresinden indirin.'
            };
        }

        if (askPermission) {
            const win = getMainWindow();
            if (win) {
                const result = await dialog.showMessageBox(win, {
                    type: 'question',
                    buttons: ['Evet', 'Hayır'],
                    defaultId: 0,
                    title: 'Ollama Başlat',
                    message: 'Ollama başlatılsın mı?',
                    detail: 'AI modellerini kullanmak için Ollama\'nın çalışıyor olması gerekiyor.'
                });

                if (result.response !== 0) {
                    return { success: false, message: 'Kullanıcı Ollama başlatmayı reddetti' };
                }
            }
        }

        appLogger.info('Ollama', 'Attempting to start Ollama...');

        try {
            // First try starting solely by command name
            await execAsync(
                'Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden',
                { shell: 'powershell.exe' }
            );
        } catch (e) {
            appLogger.warn('Ollama', `Failed to start via command: ${getErrorMessage(e as Error)}. Trying direct path...`);
            try {
                // Fallback to default installation path
                await execAsync(
                    'Start-Process -FilePath "$env:LOCALAPPDATA\\Programs\\Ollama\\ollama.exe" -ArgumentList "serve" -WindowStyle Hidden',
                    { shell: 'powershell.exe' }
                );
            } catch (e2) {
                appLogger.error('Ollama', `Failed to start via path: ${getErrorMessage(e2 as Error)}`);
                return { success: false, message: 'Ollama başlatılamadı' };
            }
        }

        // Wait for it to become ready
        for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            if (await isOllamaRunning()) {
                appLogger.info('Ollama', 'Ollama started successfully');
                return { success: true, message: 'Ollama başlatıldı' };
            }
        }

        return { success: false, message: 'Ollama başlatılamadı. Lütfen manuel olarak başlatın.' };
    } catch (error) {
        const message = getErrorMessage(error as Error);
        appLogger.error('Ollama', `Unexpected error starting Ollama: ${message}`);
        return { success: false, message: `Ollama başlatma hatası: ${message}` };
    }
}
