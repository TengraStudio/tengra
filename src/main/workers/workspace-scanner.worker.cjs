'use strict';

const fs = require('fs');
const path = require('path');

function getPort() {
    return process.parentPort || null;
}

function sendMessage(message) {
    const port = getPort();
    if (port) {
        port.postMessage(message);
        return true;
    }

    if (typeof process.send === 'function') {
        process.send(message);
        return true;
    }

    return false;
}

function postResponse(requestId, success, payload, error) {
    sendMessage({ requestId, success, payload, error });
}

function registerMessageHandler(handler) {
    const port = getPort();
    if (port) {
        port.on('message', (event) => {
            // Electron 30+ parentPort message event has data property
            const data = event.data !== undefined ? event.data : event;
            handler(data);
        });
        return true;
    }

    process.on('message', handler);
    return true;
}

// --- Ignore Logic (Extensive implementation to match WorkspaceService) ---

function normalizePath(p) {
    const resolved = path.resolve(p).replace(/\\/g, '/').replace(/\/+$/, '');
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function normalizeRelativePath(p) {
    return p.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '').replace(/\/+$/, '');
}

function escapeRegExp(s) {
    return s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function buildGlob(pattern) {
    let result = '';
    for (let i = 0; i < pattern.length; i++) {
        const c = pattern[i];
        const n = pattern[i + 1];
        const an = pattern[i + 2];

        if (c === '*' && n === '*') {
            if (an === '/') {
                result += '(?:.*/)?';
                i += 2;
                continue;
            }
            result += '.*';
            i += 1;
            continue;
        }
        if (c === '*') {
            result += '[^/]*';
            continue;
        }
        if (c === '?') {
            result += '[^/]';
            continue;
        }
        result += escapeRegExp(c);
    }
    return result;
}

function compileRule(pattern) {
    const trimmed = pattern.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;

    const negate = trimmed.startsWith('!');
    const unwrapped = negate ? trimmed.slice(1).trim() : trimmed;
    if (!unwrapped) return null;

    const normalized = normalizeRelativePath(unwrapped.replace(/^\\([#!])/u, '$1').replace(/\/\*\*$/u, '/'));
    if (!normalized) return null;

    const basenameOnly = !normalized.includes('/');
    const regexSource = buildGlob(normalized);
    const flags = process.platform === 'win32' ? 'i' : '';
    const regex = basenameOnly 
        ? new RegExp(`^${regexSource}$`, flags)
        : new RegExp(`^${regexSource}(?:/.*)?$`, flags);

    return { basenameOnly, negate, regex };
}

function matchesRule(rule, rel) {
    if (!rel) return false;
    if (!rule.basenameOnly) return rule.regex.test(rel);
    return rel.split('/').some(s => rule.regex.test(s));
}

function isBinaryOrLargeAsset(name) {
    const lowerName = name.toLowerCase();
    const ignoredExtensions = [
        '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
        '.pyc', '.pyo', '.pyd', '.class', '.jar', '.war', '.ear',
        '.zip', '.tar', '.gz', '.7z', '.rar',
        '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
        '.mp3', '.mp4', '.wav', '.mov', '.pdf', '.doc', '.docx',
        '.pdb', '.ilk', '.tlog', '.idb', '.ipdb', '.iobj', '.pch', '.sdf',
        '.opensdf', '.cache', '.bmp', '.depend'
    ];
    return ignoredExtensions.some(ext => lowerName.endsWith(ext));
}

function buildMatcher(root, patterns) {
    const normRoot = normalizePath(root);
    const rules = (patterns || []).map(compileRule).filter(r => r !== null);

    return (candidate, name) => {
        // 1. Check hardcoded binary extensions
        if (name && isBinaryOrLargeAsset(name)) return true;

        // 2. Standard glob pattern matching
        const normCand = normalizePath(candidate);
        if (normCand !== normRoot && !normCand.startsWith(normRoot + '/')) return false;
        const rel = normCand.slice(normRoot.length);
        const normRel = normalizeRelativePath(rel);
        if (!normRel) return false;

        let ignored = false;
        for (const rule of rules) {
            if (matchesRule(rule, normRel)) {
                ignored = !rule.negate;
            }
        }
        return ignored;
    };
}

// --- Scanner Logic ---

async function scan(requestId, root, patterns, maxFiles) {
    const files = [];
    const dirs = [root];
    const isIgnored = buildMatcher(root, patterns);
    let complete = true;

    try {
        while (dirs.length > 0) {
            const current = dirs.pop();
            const entries = await fs.promises.readdir(current, { withFileTypes: true });

            for (const entry of entries) {
                const full = path.join(current, entry.name);
                
                // Base filter
                if (entry.name === '.git' || entry.name === 'node_modules') {
                    if (isIgnored(full, entry.name)) continue;
                }
                
                if (isIgnored(full, entry.name)) continue;

                if (entry.isDirectory()) {
                    dirs.push(full);
                } else if (entry.isFile()) {
                    files.push(full);
                    if (maxFiles && files.length >= maxFiles) {
                        complete = false;
                        // Return partial result
                        postResponse(requestId, true, { files, complete });
                        return;
                    }
                }
            }
        }
        postResponse(requestId, true, { files, complete });
    } catch (err) {
        postResponse(requestId, false, null, err.message);
    }
}

registerMessageHandler((message) => {
    const { requestId, type, payload } = message;

    if (type === 'workspace.scan') {
        const { root, patterns, maxFiles } = payload;
        scan(requestId, root, patterns, maxFiles);
        return;
    }

    if (type === 'ping') {
        postResponse(requestId, true, 'pong');
        return;
    }

    postResponse(requestId, false, null, `Unknown message type: ${type}`);
});
