#!/usr/bin/env node
 
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const IPC_DIR = path.join(ROOT, 'src', 'main', 'ipc');
const OUT_FILE = path.join(ROOT, 'docs', 'IPC_CHANNELS.md');

function walk(dir) {
    const result = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            result.push(...walk(full));
        } else if (entry.isFile() && full.endsWith('.ts')) {
            result.push(full);
        }
    }
    return result;
}

function extractChannels(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    const re = /ipcMain\.handle\(\s*['"`]([^'"`]+)['"`]/g;
    const channels = [];
    let m;
    while ((m = re.exec(text)) !== null) {
        channels.push(m[1]);
    }
    return channels;
}

const files = walk(IPC_DIR).sort();
const channelRows = [];
for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const channels = extractChannels(file);
    for (const channel of channels) {
        const namespace = channel.includes(':') ? channel.split(':')[0] : 'misc';
        channelRows.push({ namespace, channel, file: rel });
    }
}

channelRows.sort((a, b) => a.channel.localeCompare(b.channel));

const byNamespace = new Map();
for (const row of channelRows) {
    if (!byNamespace.has(row.namespace)) byNamespace.set(row.namespace, []);
    byNamespace.get(row.namespace).push(row);
}

const namespaces = Array.from(byNamespace.keys()).sort();
const lines = [];
lines.push('# IPC Channels Reference');
lines.push('');
lines.push('This document is auto-generated from `src/main/ipc/*.ts` handler registrations.');
lines.push('');
lines.push(`- Generated at: ${new Date().toISOString()}`);
lines.push(`- Total channels: ${channelRows.length}`);
lines.push(`- Namespaces: ${namespaces.length}`);
lines.push('');
lines.push('## Usage Example');
lines.push('');
lines.push('```ts');
lines.push("const chats = await window.electron.invoke('db:getChats');");
lines.push("const status = await window.electron.invoke('git:getStatus', '/repo/path');");
lines.push('```');
lines.push('');

for (const ns of namespaces) {
    const items = byNamespace.get(ns);
    lines.push(`## ${ns}`);
    lines.push('');
    lines.push(`Count: ${items.length}`);
    lines.push('');
    for (const item of items) {
        lines.push(`- \`${item.channel}\` (${item.file})`);
    }
    lines.push('');
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${OUT_FILE} with ${channelRows.length} channels`);
