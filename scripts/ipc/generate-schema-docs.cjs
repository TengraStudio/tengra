const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const IPC_DIR = path.join(ROOT, 'src', 'main', 'ipc');
const OUTPUT = path.join(ROOT, 'docs', 'IPC_SCHEMAS.md');

function walkTsFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTsFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

function parseChannels(content) {
  const channels = [];
  const re = /ipcMain\.handle\(\s*['"`]([^'"`]+)['"`]\s*,\s*(createValidatedIpcHandler|createIpcHandler)/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    channels.push({
      channel: match[1],
      wrapper: match[2],
    });
  }
  return channels;
}

function generate() {
  const files = walkTsFiles(IPC_DIR);
  const rows = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const channels = parseChannels(content);
    for (const ch of channels) {
      rows.push({
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        channel: ch.channel,
        validation: ch.wrapper === 'createValidatedIpcHandler' ? 'zod' : 'manual',
      });
    }
  }

  rows.sort((a, b) => a.channel.localeCompare(b.channel));
  const now = new Date().toISOString();
  const lines = [
    '# IPC Schema Documentation',
    '',
    `Generated at: ${now}`,
    '',
    '| Channel | Validation | File |',
    '|---|---|---|',
    ...rows.map(row => `| \`${row.channel}\` | ${row.validation} | \`${row.file}\` |`),
    '',
    '## Versioning Policy',
    '',
    '- Schema versions are handled at handler level (`createValidatedIpcHandler` `schemaVersion`).',
    '- Backward-incompatible payload changes require a new channel or compatibility normalization.',
    '- Validation failures must be logged and reviewed in security audit logs.',
    '',
  ];

  fs.writeFileSync(OUTPUT, `${lines.join('\n')}\n`, 'utf8');
  console.log(`IPC schema docs generated: ${path.relative(ROOT, OUTPUT)}`);
}

generate();

