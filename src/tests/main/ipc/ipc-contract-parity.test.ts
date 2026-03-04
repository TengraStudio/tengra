import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();
const SRC_ROOT = path.join(PROJECT_ROOT, 'src');
const IPC_DIR = path.join(SRC_ROOT, 'main', 'ipc');
const PRELOAD_FILE = path.join(SRC_ROOT, 'main', 'preload.ts');
const PRELOAD_DOMAINS_DIR = path.join(SRC_ROOT, 'main', 'preload', 'domains');
const SHARED_CHANNELS_FILE = path.join(SRC_ROOT, 'shared', 'constants', 'ipc-channels.ts');
const IPC_INDEX_FILE = path.join(SRC_ROOT, 'main', 'ipc', 'index.ts');

function getTypeScriptFiles(dirPath: string): string[] {
    return fs.readdirSync(dirPath)
        .filter(fileName => fileName.endsWith('.ts'))
        .map(fileName => path.join(dirPath, fileName));
}

function getMainHandlerChannels(): Set<string> {
    const channels = new Set<string>();
    const handlerRegexes = [
        /ipcMain\.handle\(\s*['"`]([^'"`]+)['"`]/g,
        /ipcMain\.on\(\s*['"`]([^'"`]+)['"`]/g,
        /registerBatchableHandler\(\s*['"`]([^'"`]+)['"`]/g,
        /registerSecureBatchableHandler\(\s*['"`]([^'"`]+)['"`]/g,
        /secureHandle\(\s*\n?\s*['"`]([^'"`]+)['"`]/g
    ];

    for (const filePath of getTypeScriptFiles(IPC_DIR)) {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const pattern of handlerRegexes) {
            for (const match of content.matchAll(pattern)) {
                channels.add(match[1]);
            }
        }
    }

    return channels;
}

function getMainEventChannels(): Set<string> {
    const channels = new Set<string>();
    const eventRegex = /webContents\.send\(\s*['"`]([^'"`]+)['"`]/g;

    for (const filePath of getTypeScriptFiles(IPC_DIR)) {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const match of content.matchAll(eventRegex)) {
            channels.add(match[1]);
        }
    }

    return channels;
}

function getPreloadChannels(): { invokeOrSend: Set<string>; on: Set<string> } {
    const invokeOrSend = new Set<string>();
    const on = new Set<string>();
    const invokeOrSendRegex = /\.(?:invoke|send)\(\s*['"`]([^'"`]+)['"`]/g;
    const onRegex = /\.on\(\s*['"`]([^'"`]+)['"`]/g;

    for (const filePath of getTypeScriptFiles(PRELOAD_DOMAINS_DIR)) {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const match of content.matchAll(invokeOrSendRegex)) {
            invokeOrSend.add(match[1]);
        }
        for (const match of content.matchAll(onRegex)) {
            on.add(match[1]);
        }
    }

    return { invokeOrSend, on };
}

function getSharedChannels(): Set<string> {
    const content = fs.readFileSync(SHARED_CHANNELS_FILE, 'utf8');
    const channels = new Set<string>();
    const channelRegex = /['"`]([a-z0-9-]+:[A-Za-z0-9:._-]+)['"`]/g;
    for (const match of content.matchAll(channelRegex)) {
        channels.add(match[1]);
    }
    return channels;
}

function getPreloadBridgeCreatorsFromDomains(): string[] {
    const creators: string[] = [];
    const exportRegex = /export function (create[A-Za-z0-9]+Bridge)\(/g;
    for (const filePath of getTypeScriptFiles(PRELOAD_DOMAINS_DIR)) {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const match of content.matchAll(exportRegex)) {
            creators.push(match[1]);
        }
    }
    return creators.sort();
}

function getPreloadBridgeCreatorsFromMainPreload(): string[] {
    const preloadContent = fs.readFileSync(PRELOAD_FILE, 'utf8');
    const creators: string[] = [];
    const importRegex = /import \{ (create[A-Za-z0-9]+Bridge) \} from '\.\/preload\/domains\/[^']+'/g;
    for (const match of preloadContent.matchAll(importRegex)) {
        creators.push(match[1]);
    }
    return creators.sort();
}

function getValidatedHandlerFiles(): string[] {
    return getTypeScriptFiles(IPC_DIR).filter(filePath => {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.includes('createValidatedIpcHandler(');
    });
}

function getRegistrationImportsAndCalls(): { imports: string[]; calls: string[] } {
    const content = fs.readFileSync(IPC_INDEX_FILE, 'utf8');
    const imports: string[] = [];
    const calls: string[] = [];
    const importRegex = /import \{([^}]+)\} from '@main\/ipc\/[^']+'/g;
    const callRegex = /\b(register[A-Za-z0-9]+(?:Ipc|Handlers?))\(/g;

    for (const match of content.matchAll(importRegex)) {
        const names = match[1]
            .split(',')
            .map(part => part.trim())
            .filter(name => name.startsWith('register'))
            .map(name => name.split(' as ')[0]);
        imports.push(...names);
    }

    for (const match of content.matchAll(callRegex)) {
        calls.push(match[1]);
    }

    return { imports: Array.from(new Set(imports)).sort(), calls: Array.from(new Set(calls)).sort() };
}

describe('SAFE-005 IPC contract parity', () => {
    it('keeps preload invoke/send channels aligned with registered handlers', () => {
        const mainChannels = getMainHandlerChannels();
        const { invokeOrSend } = getPreloadChannels();

        const missing = Array.from(invokeOrSend).filter(channel => !mainChannels.has(channel));
        expect(
            missing,
            `Preload invoke/send channels missing in main handlers: ${missing.join(', ')}`
        ).toHaveLength(0);
    });

    it('keeps preload event listeners aligned with emitted main events', () => {
        const mainEventChannels = getMainEventChannels();
        const { on } = getPreloadChannels();

        const missing = Array.from(on).filter(channel => !mainEventChannels.has(channel));
        expect(
            missing,
            `Preload listener channels missing in main webContents.send calls: ${missing.join(', ')}`
        ).toHaveLength(0);
    });

    it('keeps preload domain bridge exports in sync with main preload exposure imports', () => {
        const fromDomains = getPreloadBridgeCreatorsFromDomains();
        const fromMainPreload = getPreloadBridgeCreatorsFromMainPreload();
        const missingImports = fromDomains.filter(creator => !fromMainPreload.includes(creator));
        const staleImports = fromMainPreload.filter(creator => !fromDomains.includes(creator));

        expect(
            missingImports,
            `Domain bridges not imported by preload.ts: ${missingImports.join(', ')}`
        ).toHaveLength(0);
        expect(
            staleImports,
            `preload.ts imports missing domain bridge creators: ${staleImports.join(', ')}`
        ).toHaveLength(0);
    });

    it('keeps shared IPC channel constants in sync with preload-used channels', () => {
        const sharedChannels = getSharedChannels();
        const { invokeOrSend, on } = getPreloadChannels();
        const preloadChannels = new Set<string>([...invokeOrSend, ...on]);

        const missing = Array.from(preloadChannels).filter(channel => !sharedChannels.has(channel));
        expect(
            missing,
            `Channels used in preload but missing in shared/constants/ipc-channels.ts: ${missing.join(', ')}`
        ).toHaveLength(0);
    });

    it('keeps validated IPC handlers tied to shared schemas/types imports', () => {
        const files = getValidatedHandlerFiles();
        const nonSharedTypedFiles: string[] = [];

        for (const filePath of files) {
            const content = fs.readFileSync(filePath, 'utf8');
            const hasSharedSchemaImport = /from ['"]@shared\/schemas\/[^'"]+['"]/.test(content);
            const hasSharedTypeImport = /from ['"]@shared\/types(?:\/[^'"]+)?['"]/.test(content);
            if (!hasSharedSchemaImport && !hasSharedTypeImport) {
                nonSharedTypedFiles.push(path.relative(PROJECT_ROOT, filePath));
            }
        }

        expect(
            nonSharedTypedFiles,
            `Validated IPC files missing shared schema/type imports: ${nonSharedTypedFiles.join(', ')}`
        ).toHaveLength(0);
    });

    it('keeps registerAllIpc imports and registrations synchronized', () => {
        const { imports, calls } = getRegistrationImportsAndCalls();
        const missingCalls = imports.filter(imported => !calls.includes(imported));

        expect(
            missingCalls,
            `Imported register functions in ipc/index.ts not called by registerAllIpc: ${missingCalls.join(', ')}`
        ).toHaveLength(0);
    });
});
