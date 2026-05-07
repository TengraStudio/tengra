/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { SSHKnownHostEntry, SSHManagedKey } from '@shared/types/ssh';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { safeStorage } from 'electron';

interface StoredSSHManagedKey {
    id: string;
    name: string;
    algorithm: 'ed25519';
    publicKey: string;
    fingerprint: string;
    privateKey: string;
    passphrase?: string;
    createdAt: number;
    updatedAt: number;
    rotationCount: number;
}

/**
 * SSH Key Manager
 * Handles SSH key generation, import, rotation, and known hosts management
 */
export class SSHKeyManager {
    private storagePath: string;
    private initPromise: Promise<void> | null = null;

    constructor(storagePath: string) {
        this.storagePath = storagePath;
    }

    private get keysPath(): string {
        return path.join(this.storagePath, 'ssh-keys.json');
    }

    private get knownHostsPath(): string {
        return path.join(this.storagePath, 'known_hosts');
    }

    private async ensureInitialization(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise;
        }
        this.initPromise = (async () => {
            try {
                await fs.promises.mkdir(this.storagePath, { recursive: true, mode: 0o700 });

                try {
                    await fs.promises.access(this.keysPath);
                } catch {
                    await fs.promises.writeFile(this.keysPath, JSON.stringify([], null, 2));
                }

                try {
                    await fs.promises.access(this.knownHostsPath);
                } catch {
                    await fs.promises.writeFile(this.knownHostsPath, '');
                }
            } catch (error) {
                appLogger.error(
                    'SSHKeyManager',
                    `Initialization failed: ${getErrorMessage(error as Error)}`
                );
                this.initPromise = null;
                throw error;
            }
        })();
        return this.initPromise;
    }

    private toManagedKey(stored: StoredSSHManagedKey): SSHManagedKey {
        return {
            id: stored.id,
            name: stored.name,
            algorithm: stored.algorithm,
            publicKey: stored.publicKey,
            fingerprint: stored.fingerprint,
            hasPassphrase: Boolean(stored.passphrase),
            createdAt: stored.createdAt,
            updatedAt: stored.updatedAt,
            rotationCount: stored.rotationCount
        };
    }

    private async readStoredKeys(): Promise<StoredSSHManagedKey[]> {
        await this.ensureInitialization();
        const content = await fs.promises.readFile(this.keysPath, 'utf-8');
        return safeJsonParse<StoredSSHManagedKey[]>(content, []);
    }

    private async writeStoredKeys(keys: StoredSSHManagedKey[]): Promise<void> {
        await fs.promises.writeFile(this.keysPath, JSON.stringify(keys, null, 2));
    }

    private createFingerprint(publicKey: string): string {
        const digest = crypto.createHash('sha256').update(publicKey).digest('base64');
        return `SHA256:${digest}`;
    }

    private encryptCredential(credential: string): string {
        if (safeStorage.isEncryptionAvailable()) {
            const encrypted = safeStorage.encryptString(credential);
            return encrypted.toString('base64');
        }
        return Buffer.from(credential).toString('base64');
    }

    private decryptCredential(encrypted: string): string {
        if (safeStorage.isEncryptionAvailable()) {
            return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
        }
        return Buffer.from(encrypted, 'base64').toString();
    }

    async listManagedKeys(): Promise<SSHManagedKey[]> {
        const keys = await this.readStoredKeys();
        return keys.map(key => this.toManagedKey(key));
    }

    async generateManagedKey(name: string, passphrase?: string): Promise<{
        key: SSHManagedKey;
        privateKey: string;
        publicKey: string;
    }> {
        const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
        const privateKeyPem = (passphrase
            ? privateKey.export({
                type: 'pkcs8',
                format: 'pem',
                cipher: 'aes-256-cbc',
                passphrase
            })
            : privateKey.export({
                type: 'pkcs8',
                format: 'pem'
            })).toString();
        const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
        const now = Date.now();
        const entry: StoredSSHManagedKey = {
            id: crypto.randomUUID(),
            name: name.trim() || `ssh-key-${now}`,
            algorithm: 'ed25519',
            publicKey: publicKeyPem,
            fingerprint: this.createFingerprint(publicKeyPem),
            privateKey: this.encryptCredential(privateKeyPem),
            passphrase: passphrase ? this.encryptCredential(passphrase) : undefined,
            createdAt: now,
            updatedAt: now,
            rotationCount: 0
        };
        const keys = await this.readStoredKeys();
        keys.push(entry);
        await this.writeStoredKeys(keys);
        return { key: this.toManagedKey(entry), privateKey: privateKeyPem, publicKey: publicKeyPem };
    }

    async importManagedKey(name: string, privateKey: string, passphrase?: string): Promise<SSHManagedKey> {
        const parsed = crypto.createPrivateKey({
            key: privateKey,
            format: 'pem',
            passphrase
        });
        const publicKeyPem = crypto.createPublicKey(parsed).export({ type: 'spki', format: 'pem' }).toString();
        const now = Date.now();
        const entry: StoredSSHManagedKey = {
            id: crypto.randomUUID(),
            name: name.trim() || `imported-key-${now}`,
            algorithm: 'ed25519',
            publicKey: publicKeyPem,
            fingerprint: this.createFingerprint(publicKeyPem),
            privateKey: this.encryptCredential(privateKey),
            passphrase: passphrase ? this.encryptCredential(passphrase) : undefined,
            createdAt: now,
            updatedAt: now,
            rotationCount: 0
        };
        const keys = await this.readStoredKeys();
        keys.push(entry);
        await this.writeStoredKeys(keys);
        return this.toManagedKey(entry);
    }

    async deleteManagedKey(id: string): Promise<boolean> {
        const keys = await this.readStoredKeys();
        const filtered = keys.filter(key => key.id !== id);
        if (filtered.length === keys.length) {
            return false;
        }
        await this.writeStoredKeys(filtered);
        return true;
    }

    async rotateManagedKey(id: string, nextPassphrase?: string): Promise<SSHManagedKey | null> {
        const keys = await this.readStoredKeys();
        const index = keys.findIndex(key => key.id === id);
        if (index === -1) {
            return null;
        }
        const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
        const privateKeyPem = (nextPassphrase
            ? privateKey.export({
                type: 'pkcs8',
                format: 'pem',
                cipher: 'aes-256-cbc',
                passphrase: nextPassphrase
            })
            : privateKey.export({
                type: 'pkcs8',
                format: 'pem'
            })).toString();
        const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
        const updated: StoredSSHManagedKey = {
            ...keys[index],
            publicKey: publicKeyPem,
            fingerprint: this.createFingerprint(publicKeyPem),
            privateKey: this.encryptCredential(privateKeyPem),
            passphrase: nextPassphrase ? this.encryptCredential(nextPassphrase) : undefined,
            updatedAt: Date.now(),
            rotationCount: keys[index].rotationCount + 1
        };
        keys[index] = updated;
        await this.writeStoredKeys(keys);
        return this.toManagedKey(updated);
    }

    async backupManagedKey(id: string): Promise<{ filename: string; privateKey: string } | null> {
        const keys = await this.readStoredKeys();
        const key = keys.find(entry => entry.id === id);
        if (!key) {
            return null;
        }
        return {
            filename: `${key.name.replace(/\s+/g, '-').toLowerCase()}-${key.id.slice(0, 8)}.pem`,
            privateKey: this.decryptCredential(key.privateKey)
        };
    }

    async listKnownHosts(): Promise<SSHKnownHostEntry[]> {
        await this.ensureInitialization();
        const content = await fs.promises.readFile(this.knownHostsPath, 'utf-8');
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'))
            .map(line => {
                const parts = line.split(/\s+/);
                return {
                    host: parts[0] ?? '',
                    keyType: parts[1] ?? '',
                    publicKey: parts[2] ?? ''
                };
            })
            .filter(entry => Boolean(entry.host && entry.keyType && entry.publicKey));
    }

    async addKnownHost(entry: SSHKnownHostEntry): Promise<boolean> {
        const hosts = await this.listKnownHosts();
        const exists = hosts.some(
            host =>
                host.host === entry.host &&
                host.keyType === entry.keyType &&
                host.publicKey === entry.publicKey
        );
        if (exists) {
            return true;
        }
        await fs.promises.appendFile(
            this.knownHostsPath,
            `${entry.host.trim()} ${entry.keyType.trim()} ${entry.publicKey.trim()}\n`
        );
        return true;
    }

    async removeKnownHost(host: string, keyType?: string): Promise<boolean> {
        const entries = await this.listKnownHosts();
        const filtered = entries.filter(entry => {
            if (entry.host !== host) {
                return true;
            }
            if (!keyType) {
                return false;
            }
            return entry.keyType !== keyType;
        });
        if (filtered.length === entries.length) {
            return false;
        }
        const content = filtered
            .map(entry => `${entry.host} ${entry.keyType} ${entry.publicKey}`)
            .join('\n');
        await fs.promises.writeFile(this.knownHostsPath, content ? `${content}\n` : '');
        return true;
    }
}

