 
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const OVERRIDES_FILE = path.join(
    ROOT_DIR,
    'docs',
    'changelog',
    'i18n',
    'tr.overrides.json'
);

const REPLACEMENTS = [
    ['Yüksek Lisans', 'LLM'],
    ['Yüksek lisans', 'LLM'],
    ['yüksek lisans', 'LLM'],
    ['geliştirmeler oluşturun', 'derleme iyileştirmeleri'],
    ['Geliştirmeler Oluşturun', 'Derleme İyileştirmeleri'],
    ['Tozlaşmalara (bulut)', 'Pollinations (bulut)'],
    ['Tozlaşmalar', 'Pollinations'],
    ['Pazaryeri', 'Pazar Yeri'],
    ['pazaryeri', 'pazar yeri'],
    ['Pazaryerine', 'Pazar yerine'],
    ['pazaryerine', 'pazar yerine'],
    ['Pazar yeri', 'pazar yeri'],
    ['Kazıyıcı', 'Tarayıcı'],
    ['kazıyıcı', 'tarayıcı'],
    ['kazıntıları', 'içeriğini tarar'],
    ['kazınır', 'taranır'],
    ['Kütüphane Kazıma', 'Kütüphane Tarama'],
    ['kütüphane kazınır', 'kütüphane taranır'],
    ['çekmeler', 'indirme sayısı'],
    ['Çalışma Alanı', 'Çalışma alanı'],
    ['Workspace Explorer', 'Workspace Explorer'],
    ['Proje Temsilcisi', 'Project Agent'],
    ['Proje Aracısı', 'Project Agent'],
    ['Döngüdeki İnsan', 'Human-in-the-Loop'],
    ['kullanıcı arayüzü', 'UI'],
    ['Kullanıcı Arayüzü', 'UI'],
    ['Sürükle ve Bırakarak Taşıma', 'Sürükle-Bırak ile Taşıma'],
    ['boş olmayan onaylar', 'non-null assertions'],
    ['Boş Olmayan Onaylar', 'Non-null Assertions'],
    ['Boş Birleştirme', 'Nullish Coalescing'],
    ['Nullish Coalescing', 'Nullish Coalescing'],
    ['İçe Aktarma', 'Import'],
    ['tüylenme', 'lint'],
    ['yavaş yüklenen', 'lazy-loaded'],
    ['işleyici', 'handler'],
    ['İşleyicileri', 'Handler\'ları'],
    ['İşleyiciler', 'Handler\'lar'],
    ['paketleyicileri', 'wrapper\'ları'],
    ['paketleyicileri', 'wrapper\'ları'],
    ['günlüğü', 'log'],
    ['günlüğe kaydetme', 'logging'],
    ['Önbelleğe alma', 'Önbellekleme'],
    ['Geç Yükleme', 'Lazy Loading'],
    ['Çalışma Zamanı', 'Runtime'],
    ['çalışma zamanı', 'runtime'],
    ['dalı', 'branch\'i'],
    ['görev düğümü', 'task node'],
    ['Geri Dönüş', 'Fallback'],
    ['geri dönüş', 'fallback'],
    ['Süreç', 'Süreç'],
    ['theme.ts**: Alfasayısal', 'theme.ts**: Alfasayısal'],
];

const CURATED_ENTRY_FIXES = {
    '2026-02-12-models-page-ollama-marketplace-scraper': {
        title: 'Modeller Sayfası ve Ollama Pazar Yeri Taraması',
        summary:
            'Çoklu hesap desteği, kota görünümü ve Ollama kütüphane taramasıyla bağımsız bir Modeller sayfası oluşturuldu.',
    },
    '2026-02-11-workspace-explorer-polish-ux': {
        title: 'Workspace Explorer İyileştirmeleri ve UX Güncellemeleri',
    },
    '2026-02-11-workspace-file-operations-dnd-polish-windows-support': {
        title: 'Çalışma Alanı Dosya İşlemleri (DND İyileştirmeleri ve Windows Desteği)',
    },
    '2026-02-11-workspace-file-operations-windows-support-localization': {
        title: 'Çalışma Alanı Dosya İşlemleri (Windows Desteği ve Yerelleştirme)',
    },
    '2026-02-11-workspace-file-operations-delete-drag-and-drop': {
        title: 'Çalışma Alanı Dosya İşlemleri (Silme ve Sürükle-Bırak)',
    },
    '2026-02-11-go-proxy-build-fix': {
        title: 'Go Proxy Derleme Düzeltmesi',
    },
    '2026-02-11-api-core-file-by-file-audit': {
        summary:
            '`src/main/api` ve `src/main/core` altındaki 8 dosya için kapsamlı denetim, refactor ve dokümantasyon çalışması tamamlandı.',
    },
    '2026-01-15-critical-todo-items-resolved': {
        title: 'Kritik TODO Maddeleri Çözüldü',
    },
    '2026-01-14-build-improvements': {
        title: 'Derleme İyileştirmeleri',
    },
};

function applyPolish(value) {
    let output = value;
    for (const [from, to] of REPLACEMENTS) {
        output = output.split(from).join(to);
    }
    output = output.replace(/\bhandlernin\b/g, 'handler\'ın');
    output = output.replace(/\bhandlerler\b/g, 'handler\'lar');
    output = output.replace(/\bwrapper'larıne\b/g, 'wrapper\'larına');
    output = output.replace(/\bbranch'inı\b/g, 'branch\'i');
    output = output.replace(/\btüy\/tür\b/g, 'lint/tip');
    output = output.replace(/\bappLogger'na\b/g, 'appLogger\'a');
    output = output.replace(/\bboş birleştirilmiş dönüşümlerin geçersiz kılınması\b/g, 'nullish coalescing dönüşümleri');
    output = output.replace(/\bilk geri dönüş\b/g, 'fallback');
    output = output.replace(/\bgeri dönecek şekilde\b/g, 'fallback yapacak şekilde');
    output = output.replace(/\bgeri dönüş mantığı\b/g, 'fallback mantığı');
    output = output.replace(/\bpazar yeri için\b/g, 'Pazar yeri için');
    output = output.replace(/\bSürükle ve Bırak\b/g, 'Sürükle-Bırak');
    output = output.replace(/\blehçesi\b/gi, 'iyileştirmesi');
    output = output.replace(/\bkonsensüs\b/g, 'consensus');
    output = output.replace(/\byorumsuz yükleme süresi kaydı\b/g, 'yükleme süresi loglama');
    output = output.replace(/\bTÜM açık `any` türleri\b/g, 'Tüm açık `any` kullanımları');
    return output;
}

function isVersionHistoryLine(line) {
    const trimmed = line.trim();
    return (
        trimmed.startsWith('## Sürüm Geçmişi') ||
        /^### v\d/.test(trimmed) ||
        trimmed.includes('Birleşik Mikro Hizmet Senkronizasyonu') ||
        trimmed.includes('İlk Sürüm') ||
        trimmed.includes('HTTP tabanlı çift yönlü jeton senkronizasyonuna geçildi.') ||
        trimmed.includes('OpenAI ve Anthropic ile temel sohbet işlevi.') ||
        trimmed.includes('Yerel Ollama desteği.') ||
        trimmed.includes('Proje yönetimi görünümü.') ||
        trimmed.includes('Tema desteği (Koyu/Açık).')
    );
}

function sentenceCase(value) {
    if (!value || value.length === 0) {
        return value;
    }
    const first = value[0];
    return `${first.toLocaleUpperCase('tr-TR')}${value.slice(1)}`;
}

function run() {
    const overrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));

    for (const [entryId, entry] of Object.entries(overrides)) {
        if (!entry || typeof entry !== 'object') {
            continue;
        }

        if (typeof entry.title === 'string') {
            entry.title = applyPolish(entry.title);
        }
        if (typeof entry.summary === 'string') {
            entry.summary = sentenceCase(applyPolish(entry.summary.trim()));
        }
        if (Array.isArray(entry.items)) {
            entry.items = entry.items
                .filter((line) => typeof line === 'string' && !isVersionHistoryLine(line))
                .map((line) => applyPolish(line));
        }

        const curated = CURATED_ENTRY_FIXES[entryId];
        if (curated) {
            if (typeof curated.title === 'string') {
                entry.title = curated.title;
            }
            if (typeof curated.summary === 'string') {
                entry.summary = curated.summary;
            }
        }
    }

    fs.writeFileSync(OVERRIDES_FILE, `${JSON.stringify(overrides, null, 2)}\n`, 'utf8');
    console.log(`Manual polish completed for ${Object.keys(overrides).length} entries.`);
}

run();

