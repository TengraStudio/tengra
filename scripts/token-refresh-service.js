#!/usr/bin/env node
/**
 * Orbit Token Refresh Service (Standalone)
 * 
 * This service automatically refreshes authentication tokens using our own logic
 * instead of relying on CLIProxyAPI. It runs independently even when the main
 * Orbit application is not running.
 * 
 * Usage:
 *   node scripts/token-refresh-service.js
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const SERVICE_NAME = 'OrbitTokenRefresh';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const COPILOT_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// OAuth Client IDs and Secrets
const ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const ANTIGRAVITY_CLIENT_SECRET = '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';

const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const CODEX_TOKEN_URL = 'https://auth.openai.com/oauth/token';

const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const CLAUDE_TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';

// Get paths
function getUserDataPath() {
    if (process.platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Orbit', 'runtime');
    } else if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Orbit', 'runtime');
    } else {
        return path.join(os.homedir(), '.config', 'Orbit', 'runtime');
    }
}

function getConfigPath() {
    const userDataPath = getUserDataPath();
    return path.join(userDataPath, 'data', 'config', 'settings.json');
}

function getAuthDir() {
    const userDataPath = getUserDataPath();
    return path.join(userDataPath, 'data', 'auth');
}

function readConfig() {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            console.error(`[${SERVICE_NAME}] Failed to read config:`, e.message);
            return {};
        }
    }
    return {};
}

/**
 * Decrypt using OS-level APIs (Windows DPAPI, macOS Keychain, Linux Secret Service)
 * This is a fallback for when Electron's safeStorage isn't available
 */
function decryptWithOS(encryptedText) {
    try {
        // Try Windows DPAPI first
        if (process.platform === 'win32') {
            try {
                // Use @primno/dpapi if available, otherwise we can't decrypt
                const { Dpapi, isPlatformSupported } = require('@primno/dpapi');
                if (!isPlatformSupported) {
                    console.warn(`[${SERVICE_NAME}] Windows DPAPI not supported on this platform.`);
                    return null;
                }
                const buffer = Buffer.from(encryptedText, 'base64');
                const decrypted = Dpapi.unprotectData(buffer, null, 'CurrentUser');
                return decrypted.toString('utf8');
            } catch (e) {
                // @primno/dpapi not available or failed
                console.warn(`[${SERVICE_NAME}] Windows DPAPI decryption not available. Install @primno/dpapi for standalone token refresh.`);
                return null;
            }
        }
        
        // macOS and Linux would need keytar or similar
        // For now, we can't decrypt without Electron
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Read auth file - tries to parse as JSON, handles encrypted format
 * Attempts to decrypt using OS-level APIs if Electron safeStorage isn't available
 */
function readAuthFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        let json;
        
        try {
            json = JSON.parse(content);
        } catch {
            return null;
        }
        
        // If it's already a plain object with token data, return it
        if (json.access_token || json.refresh_token) {
            return json;
        }
        
        // Handle encrypted format { provider, token: encrypted, updatedAt }
        if (json.token && typeof json.token === 'string') {
            // Try to decrypt using OS-level APIs
            const decrypted = decryptWithOS(json.token);
            if (decrypted) {
                try {
                    // Decrypted content might be JSON
                    return JSON.parse(decrypted);
                } catch {
                    // Or it might be a raw token string
                    return { access_token: decrypted };
                }
            } else {
                // Can't decrypt - log and skip
                console.warn(`[${SERVICE_NAME}] Cannot decrypt token file ${path.basename(filePath)}. Install @primno/dpapi (Windows) for standalone token refresh, or use the main app.`);
                return null;
            }
        }
        
        // Handle old encrypted format { encryptedPayload, version }
        if (json.encryptedPayload && typeof json.encryptedPayload === 'string') {
            const decrypted = decryptWithOS(json.encryptedPayload);
            if (decrypted) {
                try {
                    return JSON.parse(decrypted);
                } catch {
                    return null;
                }
            }
            return null;
        }
        
        return json;
    } catch (error) {
        console.error(`[${SERVICE_NAME}] Failed to read auth file ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Encrypt using OS-level APIs (Windows DPAPI, macOS Keychain, Linux Secret Service)
 */
function encryptWithOS(text) {
    try {
        if (process.platform === 'win32') {
            try {
                const { Dpapi, isPlatformSupported } = require('@primno/dpapi');
                if (!isPlatformSupported) {
                    console.warn(`[${SERVICE_NAME}] Windows DPAPI not supported on this platform.`);
                    return null;
                }
                const buffer = Buffer.from(text, 'utf8');
                const encrypted = Dpapi.protectData(buffer, null, 'CurrentUser');
                return encrypted.toString('base64');
            } catch (e) {
                console.warn(`[${SERVICE_NAME}] Windows DPAPI encryption not available. Saving as plain JSON (not secure).`);
                return null;
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Save auth file - attempts to encrypt using OS-level APIs
 * Falls back to plain JSON if encryption unavailable (main app will re-encrypt)
 */
function saveAuthFile(filePath, data) {
    try {
        const dataString = JSON.stringify(data);
        const encrypted = encryptWithOS(dataString);
        
        if (encrypted) {
            // Save in encrypted format matching main app
            const wrapper = {
                provider: path.basename(filePath, path.extname(filePath)),
                token: encrypted,
                updatedAt: Date.now()
            };
            fs.writeFileSync(filePath, JSON.stringify(wrapper, null, 2), 'utf8');
        } else {
            // Fallback: save as plain JSON (main app will re-encrypt when it runs)
            console.warn(`[${SERVICE_NAME}] Saving ${path.basename(filePath)} as plain JSON. Main app will re-encrypt.`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        }
    } catch (error) {
        console.error(`[${SERVICE_NAME}] Failed to save auth file ${filePath}:`, error.message);
    }
}

/**
 * Check which providers are logged in
 */
function getLoggedInProviders() {
    const settings = readConfig();
    const authDir = getAuthDir();
    
    const providers = {
        google: false,
        codex: false,
        claude: false,
        copilot: false
    };
    
    // Check settings
    if (settings.antigravity?.connected && settings.antigravity?.token) {
        providers.google = true;
    }
    if (settings.codex?.connected && settings.codex?.token) {
        providers.codex = true;
    }
    if (settings.claude?.connected) {
        providers.claude = true;
    }
    if ((settings.github?.token && settings.github.token.length > 0) ||
        (settings.copilot?.connected && settings.copilot?.token && settings.copilot.token.length > 0)) {
        providers.copilot = true;
    }
    
    // Check auth directory
    if (fs.existsSync(authDir)) {
        try {
            const files = fs.readdirSync(authDir);
            files.forEach(f => {
                const name = f.toLowerCase().replace(/\.(json|enc)$/, '');
                if (name.startsWith('antigravity') || name.startsWith('google')) {
                    providers.google = true;
                } else if (name.startsWith('codex') || name.startsWith('openai')) {
                    providers.codex = true;
                } else if (name.startsWith('claude') || name.startsWith('anthropic')) {
                    providers.claude = true;
                }
            });
        } catch (e) {
            console.warn(`[${SERVICE_NAME}] Failed to read auth directory:`, e.message);
        }
    }
    
    return providers;
}

/**
 * Refresh Google/Antigravity token
 */
async function refreshGoogleToken() {
    const authDir = getAuthDir();
    if (!fs.existsSync(authDir)) return;
    
    const files = fs.readdirSync(authDir).filter(f => {
        const name = f.toLowerCase().replace(/\.(json|enc)$/, '');
        return name.startsWith('antigravity') || name.startsWith('google');
    });
    
    for (const file of files) {
        try {
            const filePath = path.join(authDir, file);
            const authData = readAuthFile(filePath);
            if (!authData) continue;
            
            const refreshToken = authData.refresh_token;
            if (!refreshToken) continue;
            
            const expiresIn = authData.expires_in || 3600;
            const timestamp = authData.timestamp || 0;
            
            // Check if token is expired or will expire soon (within 5 minutes)
            const expiry = timestamp + (expiresIn * 1000);
            if (Date.now() < expiry - 5 * 60 * 1000) {
                continue; // Token still valid
            }
            
            console.log(`[${SERVICE_NAME}] Refreshing Google/Antigravity token...`);
            
            const params = new URLSearchParams({
                client_id: ANTIGRAVITY_CLIENT_ID,
                client_secret: ANTIGRAVITY_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            });
            
            const response = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 10000
            });
            
            const updatedData = {
                ...authData,
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token || refreshToken,
                expires_in: response.data.expires_in || 3600,
                timestamp: Date.now()
            };
            
            saveAuthFile(filePath, updatedData);
            console.log(`[${SERVICE_NAME}] Google/Antigravity token refreshed successfully`);
        } catch (error) {
            console.error(`[${SERVICE_NAME}] Failed to refresh Google token from ${file}:`, error.message);
        }
    }
}

/**
 * Refresh Codex token
 */
async function refreshCodexToken() {
    const authDir = getAuthDir();
    if (!fs.existsSync(authDir)) return;
    
    const files = fs.readdirSync(authDir).filter(f => {
        const name = f.toLowerCase().replace(/\.(json|enc)$/, '');
        return name.startsWith('codex') || name.startsWith('openai');
    });
    
    for (const file of files) {
        try {
            const filePath = path.join(authDir, file);
            const authData = readAuthFile(filePath);
            if (!authData) continue;
            
            const refreshToken = authData.refresh_token;
            if (!refreshToken) continue;
            
            const expire = authData.expired || authData.expire;
            if (expire) {
                const expiryDate = new Date(expire);
                if (Date.now() < expiryDate.getTime() - 5 * 60 * 1000) {
                    continue; // Token still valid
                }
            }
            
            console.log(`[${SERVICE_NAME}] Refreshing Codex token...`);
            
            const params = new URLSearchParams({
                client_id: CODEX_CLIENT_ID,
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                scope: 'openid profile email'
            });
            
            const response = await axios.post(CODEX_TOKEN_URL, params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                timeout: 10000
            });
            
            const expiresIn = response.data.expires_in || 3600;
            const expiryDate = new Date(Date.now() + expiresIn * 1000).toISOString();
            
            const updatedData = {
                ...authData,
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token || refreshToken,
                id_token: response.data.id_token || authData.id_token,
                expired: expiryDate,
                last_refresh: new Date().toISOString()
            };
            
            saveAuthFile(filePath, updatedData);
            console.log(`[${SERVICE_NAME}] Codex token refreshed successfully`);
        } catch (error) {
            console.error(`[${SERVICE_NAME}] Failed to refresh Codex token from ${file}:`, error.message);
        }
    }
}

/**
 * Refresh Claude token
 */
async function refreshClaudeToken() {
    const authDir = getAuthDir();
    if (!fs.existsSync(authDir)) return;
    
    const files = fs.readdirSync(authDir).filter(f => {
        const name = f.toLowerCase().replace(/\.(json|enc)$/, '');
        return name.startsWith('claude') || name.startsWith('anthropic');
    });
    
    for (const file of files) {
        try {
            const filePath = path.join(authDir, file);
            const authData = readAuthFile(filePath);
            if (!authData) continue;
            
            const refreshToken = authData.refresh_token;
            if (!refreshToken) continue;
            
            const expire = authData.expired || authData.expire;
            if (expire) {
                const expiryDate = new Date(expire);
                if (Date.now() < expiryDate.getTime() - 5 * 60 * 1000) {
                    continue; // Token still valid
                }
            }
            
            console.log(`[${SERVICE_NAME}] Refreshing Claude token...`);
            
            const response = await axios.post(CLAUDE_TOKEN_URL, {
                client_id: CLAUDE_CLIENT_ID,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000
            });
            
            const expiresIn = response.data.expires_in || 3600;
            const expiryDate = new Date(Date.now() + expiresIn * 1000).toISOString();
            
            const updatedData = {
                ...authData,
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token || refreshToken,
                expired: expiryDate,
                email: response.data.account?.email_address || authData.email,
                last_refresh: new Date().toISOString()
            };
            
            saveAuthFile(filePath, updatedData);
            console.log(`[${SERVICE_NAME}] Claude token refreshed successfully`);
        } catch (error) {
            console.error(`[${SERVICE_NAME}] Failed to refresh Claude token from ${file}:`, error.message);
        }
    }
}

/**
 * Refresh all OAuth tokens
 */
async function refreshAllTokens() {
    const providers = getLoggedInProviders();
    
    const tasks = [];
    
    if (providers.google) {
        tasks.push(refreshGoogleToken().catch(err => {
            console.error(`[${SERVICE_NAME}] Google token refresh failed:`, err.message);
        }));
    }
    
    if (providers.codex) {
        tasks.push(refreshCodexToken().catch(err => {
            console.error(`[${SERVICE_NAME}] Codex token refresh failed:`, err.message);
        }));
    }
    
    if (providers.claude) {
        tasks.push(refreshClaudeToken().catch(err => {
            console.error(`[${SERVICE_NAME}] Claude token refresh failed:`, err.message);
        }));
    }
    
    if (tasks.length > 0) {
        await Promise.all(tasks);
        console.log(`[${SERVICE_NAME}] Token refresh completed for ${tasks.length} provider(s)`);
    } else {
        console.log(`[${SERVICE_NAME}] No providers logged in, skipping refresh`);
    }
}

/**
 * Main service loop
 */
function startService() {
    console.log(`[${SERVICE_NAME}] Starting unified token refresh service...`);
    console.log(`[${SERVICE_NAME}] Using our own token refresh logic (no CLIProxyAPI)`);
    
    // Initial refresh
    refreshAllTokens();
    
    // Set up periodic refresh
    setInterval(() => {
        refreshAllTokens();
    }, REFRESH_INTERVAL_MS);
    
    // Keep process alive
    console.log(`[${SERVICE_NAME}] Service running. Refreshing tokens every ${REFRESH_INTERVAL_MS / 1000 / 60} minutes.`);
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log(`[${SERVICE_NAME}] Received SIGTERM, shutting down gracefully...`);
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log(`[${SERVICE_NAME}] Received SIGINT, shutting down gracefully...`);
    process.exit(0);
});

// Start the service
if (require.main === module) {
    startService();
}

module.exports = { startService, refreshAllTokens };
