#!/usr/bin/env node
/**
 * Translation Memory Export Tool (IDEA-015)
 * Reads all 8 i18n files and generates a JSON/CSV report for translators.
 * Usage: node scripts/export-translations.mjs [--csv]
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LANGS = ['en', 'tr', 'de', 'fr', 'es', 'ja', 'zh', 'ar']
const I18N_DIR = resolve(__dirname, '..', 'src', 'renderer', 'i18n')

/** Flatten nested object into dot-notation keys */
function flatten(obj, prefix = '') {
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(result, flatten(v, key))
    } else {
      result[key] = String(v ?? '')
    }
  }
  return result
}

/** Extract the exported object from a TS file by evaluating it as a module */
function loadLang(lang) {
  const content = readFileSync(resolve(I18N_DIR, `${lang}.ts`), 'utf-8')
  // Replace `export const xx =` with `module.exports.xx =` for eval
  const cjs = content.replace(/export\s+const\s+(\w+)\s*=/g, 'exports.$1 =')
  const exports = {}
  new Function('exports', cjs)(exports)
  return exports[lang]
}

function main() {
  const csvMode = process.argv.includes('--csv')
  const translations = {}
  for (const lang of LANGS) {
    translations[lang] = flatten(loadLang(lang))
  }

  const allKeys = [...new Set(Object.keys(translations.en))].sort()
  const missing = []

  if (csvMode) {
    const esc = (s) => `"${s.replace(/"/g, '""')}"`
    const header = ['key', ...LANGS, 'missing'].join(',')
    const rows = allKeys.map((key) => {
      const vals = LANGS.map((l) => esc(translations[l]?.[key] ?? ''))
      const miss = LANGS.filter((l) => l !== 'en' && !translations[l]?.[key])
      if (miss.length) missing.push({ key, languages: miss })
      return [esc(key), ...vals, miss.length ? esc(miss.join(';')) : '""'].join(',')
    })
    process.stdout.write([header, ...rows].join('\n') + '\n')
  } else {
    const rows = allKeys.map((key) => {
      const entry = { key }
      for (const lang of LANGS) entry[lang] = translations[lang]?.[key] ?? ''
      const miss = LANGS.filter((l) => l !== 'en' && !translations[l]?.[key])
      if (miss.length) {
        entry._missing = miss.join(', ')
        missing.push({ key, languages: miss })
      }
      return entry
    })
    const report = { totalKeys: allKeys.length, missingCount: missing.length, translations: rows }
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  }

  process.stderr.write(`\n✅ Exported ${allKeys.length} keys across ${LANGS.length} languages. Missing: ${missing.length} entries.\n`)
}

main()
