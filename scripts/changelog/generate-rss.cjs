const fs = require('fs');
const path = require('path');
const { z } = require('zod');

const ROOT = path.resolve(__dirname, '..', '..');
const INDEX_PATH = path.join(ROOT, 'src', 'renderer', 'data', 'changelog.index.json');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'changelog', 'generated', 'CHANGELOG.rss.xml');
const ANALYTICS_PATH = path.join(ROOT, 'docs', 'changelog', 'generated', 'CHANGELOG.rss.analytics.json');

const ArgsSchema = z.object({
  locale: z.string().min(2).default('en'),
  limit: z.number().int().min(1).max(500).default(50),
  type: z.string().optional(),
  channel: z.string().optional(),
  baseUrl: z.string().url().default('https://tengra.local/changelog'),
  title: z.string().min(1).default('Tengra Changelog'),
  watchMinutes: z.number().int().min(1).max(1440).optional(),
});

function parseArgs(argv) {
  const raw = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [k, v = ''] = arg.slice(2).split('=');
    raw[k] = v;
  }
  return ArgsSchema.parse({
    locale: raw.locale || undefined,
    limit: raw.limit ? Number(raw.limit) : undefined,
    type: raw.type || undefined,
    channel: raw.channel || undefined,
    baseUrl: raw.baseUrl || undefined,
    title: raw.title || undefined,
    watchMinutes: raw.watchMinutes ? Number(raw.watchMinutes) : undefined,
  });
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function validateFeed(xml) {
  const checks = [
    ['xml declaration', xml.startsWith('<?xml')],
    ['rss root', xml.includes('<rss version="2.0">')],
    ['channel title', xml.includes('<title>')],
    ['at least one item', xml.includes('<item>')],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length > 0) {
    throw new Error(`RSS validation failed: ${failed.map(([label]) => label).join(', ')}`);
  }
}

function readIndex() {
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(`Missing changelog index: ${INDEX_PATH}. Run "npm run changelog:build" first.`);
  }
  return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
}

function buildFeed(config) {
  const index = readIndex();
  const entries = index.entries
    .filter(entry => !config.type || entry.type === config.type)
    .filter(entry => !config.channel || entry.channel === config.channel)
    .slice(0, config.limit);

  const itemsXml = entries
    .map(entry => {
      const content = entry.contentByLocale?.[config.locale] || entry.contentByLocale?.en;
      const summary = content?.summary || '';
      const details = Array.isArray(content?.items) ? content.items.join('\n') : '';
      const description = `${summary}\n${details}`.trim();
      return [
        '<item>',
        `<guid>${escapeXml(entry.id)}</guid>`,
        `<title>${escapeXml(content?.title || entry.id)}</title>`,
        `<link>${escapeXml(`${config.baseUrl}#${entry.id}`)}</link>`,
        `<pubDate>${new Date(`${entry.date}T00:00:00.000Z`).toUTCString()}</pubDate>`,
        `<description>${escapeXml(description)}</description>`,
        `<category>${escapeXml(entry.type)}</category>`,
        '</item>',
      ].join('');
    })
    .join('\n');

  const rss = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    `<title>${escapeXml(config.title)}</title>`,
    `<link>${escapeXml(config.baseUrl)}</link>`,
    `<description>${escapeXml(`${config.title} feed`)}</description>`,
    `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    `<language>${escapeXml(config.locale)}</language>`,
    itemsXml,
    '</channel>',
    '</rss>',
    '',
  ].join('\n');

  validateFeed(rss);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, rss, 'utf8');
  fs.writeFileSync(ANALYTICS_PATH, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    locale: config.locale,
    count: entries.length,
    type: config.type ?? null,
    channel: config.channel ?? null,
    output: path.relative(ROOT, OUTPUT_PATH).replace(/\\/g, '/'),
  }, null, 2)}\n`, 'utf8');

  console.log(`RSS feed generated (${entries.length} items): ${path.relative(ROOT, OUTPUT_PATH)}`);
  return entries.length;
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  buildFeed(args);

  if (args.watchMinutes) {
    const intervalMs = args.watchMinutes * 60 * 1000;
    console.log(`RSS schedule enabled. Rebuilding every ${args.watchMinutes} minute(s).`);
    setInterval(() => {
      try {
        const count = buildFeed(args);
        console.log(`[rss] updated (${count} entries) at ${new Date().toISOString()}`);
      } catch (error) {
        console.error(`[rss] update failed: ${error.message}`);
      }
    }, intervalMs);
  }
}

run();


