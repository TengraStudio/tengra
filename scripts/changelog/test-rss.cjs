const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const RSS_PATH = path.join(ROOT, 'docs', 'changelog', 'generated', 'CHANGELOG.rss.xml');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  assert(fs.existsSync(RSS_PATH), 'RSS file not found. Run "npm run changelog:rss" first.');
  const xml = fs.readFileSync(RSS_PATH, 'utf8');
  assert(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Invalid XML declaration');
  assert(xml.includes('<rss version="2.0">'), 'Missing RSS root');
  assert(xml.includes('<channel>'), 'Missing channel node');
  assert(xml.includes('<item>'), 'Feed has no items');
  assert(xml.includes('<title>'), 'Missing title');
  assert(xml.includes('<description>'), 'Missing description');
  console.log('RSS feed test passed.');
}

run();

