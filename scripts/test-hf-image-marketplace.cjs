const fs = require('fs');
const path = require('path');
const axios = require('axios');

const HF_API = 'https://huggingface.co/api/models';
const SUPPORTED_EXTENSIONS = ['.safetensors', '.ckpt', '.gguf'];
const OUTPUT_PATH = path.join(process.cwd(), 'reports', 'hf-image-marketplace-test.json');
const MAX_MODELS = 300;
const MAX_GGUF_MODELS = 600;
const README_FETCH_LIMIT = Number(process.env.HF_README_LIMIT || 80);
const README_CONCURRENCY = Number(process.env.HF_README_CONCURRENCY || 8);
const IMAGE_PIPELINE_TAGS = [
  'text-to-image',
  'image-to-image',
  'inpainting',
  'unconditional-image-generation',
];
const TEXT_PIPELINE_TAGS = [
  'text-generation',
  'text2text-generation',
  'conversational',
];

function hasSupportedExtension(file) {
  const lower = String(file || '').toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function extractFormats(siblings) {
  const set = new Set();
  for (const s of siblings || []) {
    const name = String(s?.rfilename || '').toLowerCase();
    for (const ext of SUPPORTED_EXTENSIONS) {
      if (name.endsWith(ext)) {
        set.add(ext.replace('.', ''));
      }
    }
  }
  return Array.from(set);
}

function categorizeModel(name, tags, formats) {
  const text = `${name} ${(tags || []).join(' ')} ${(formats || []).join(' ')}`.toLowerCase();
  const categories = [];

  if (text.includes('text-generation') || text.includes('chat') || text.includes('instruct')) {
    categories.push('text');
  }

  if (text.includes('image') || text.includes('diffusion') || text.includes('inpainting')) {
    categories.push('image');
  }

  if (formats.includes('gguf')) categories.push('llama.cpp');
  if (formats.includes('safetensors') || formats.includes('ckpt') || formats.includes('gguf')) {
    categories.push('sd-cpp');
  }

  if (text.includes('sdxl')) categories.push('sdxl');
  if (text.includes('flux')) categories.push('flux');
  if (text.includes('stable-diffusion-1') || text.includes('sd15') || text.includes('1.5')) categories.push('sd1.5');
  if (text.includes('pony')) categories.push('pony');

  for (const f of formats) categories.push(f);

  return Array.from(new Set(categories));
}

function encodeRepoId(repoId) {
  return String(repoId || '')
    .split('/')
    .map(part => encodeURIComponent(part))
    .join('/');
}

async function fetchReadmeMarkdown(modelName) {
  const repoPath = encodeRepoId(modelName);
  const url = `https://huggingface.co/${repoPath}/raw/main/README.md`;

  try {
    const res = await axios.get(url, {
      timeout: 15000,
      responseType: 'text',
      headers: {
        'User-Agent': 'tandem-hf-test-script/1.0',
        'Accept': 'text/markdown, text/plain; q=0.9, */*; q=0.1',
      },
      validateStatus: () => true,
    });

    if (res.status !== 200) return null;
    const text = typeof res.data === 'string' ? res.data.trim() : '';
    if (!text) return null;
    if (text.startsWith('<!doctype html') || text.startsWith('<html')) return null;
    return text;
  } catch {
    return null;
  }
}

async function enrichModelsWithReadme(models) {
  const limit = Math.max(0, Math.min(README_FETCH_LIMIT, models.length));
  if (limit === 0) return { attempted: 0, succeeded: 0 };

  const workers = Math.max(1, README_CONCURRENCY);
  let cursor = 0;
  let succeeded = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= limit) break;
      const model = models[idx];
      const markdown = await fetchReadmeMarkdown(model.name);
      if (markdown) {
        model.longDescriptionMarkdown = markdown;
        succeeded += 1;
      } else {
        model.longDescriptionMarkdown = null;
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return { attempted: limit, succeeded };
}

async function fetchModelsByPipeline(pipelineTag) {
  const params = {
    pipeline_tag: pipelineTag,
    sort: 'downloads',
    direction: -1,
    limit: MAX_MODELS,
    full: true,
  };

  const res = await axios.get(HF_API, {
    params,
    timeout: 30000,
    headers: {
      'User-Agent': 'tandem-hf-test-script/1.0',
      'Accept': 'application/json',
    },
  });

  const items = Array.isArray(res.data) ? res.data : [];
  return items.map(m => ({ ...m, __sourcePipeline: pipelineTag }));
}

async function fetchGGUFModels() {
  const params = {
    filter: 'gguf',
    sort: 'downloads',
    direction: -1,
    limit: MAX_GGUF_MODELS,
    full: true,
  };

  const res = await axios.get(HF_API, {
    params,
    timeout: 30000,
    headers: {
      'User-Agent': 'tandem-hf-test-script/1.0',
      'Accept': 'application/json',
    },
  });

  const items = Array.isArray(res.data) ? res.data : [];
  return items.map(m => ({ ...m, __sourcePipeline: 'gguf-filter' }));
}

async function main() {
  const allPipelineTags = [...IMAGE_PIPELINE_TAGS, ...TEXT_PIPELINE_TAGS];

  const fetchedByPipeline = await Promise.all(
    allPipelineTags.map(async tag => {
      const models = await fetchModelsByPipeline(tag);
      return { tag, models };
    })
  );

  const ggufModels = await fetchGGUFModels();

  const mergedMap = new Map();
  function upsertModel(m) {
    const id = m.modelId || m.id;
    if (!id) return;

    if (!mergedMap.has(id)) {
      const source = m.__sourcePipeline ? [m.__sourcePipeline] : [];
      mergedMap.set(id, { ...m, __sourcePipelines: source });
      return;
    }

    const existing = mergedMap.get(id);
    const existingDownloads = Number(existing.downloads || 0);
    const currentDownloads = Number(m.downloads || 0);
    const currentSource = m.__sourcePipeline ? [m.__sourcePipeline] : [];
    const mergedSources = Array.from(
      new Set([...(existing.__sourcePipelines || []), ...currentSource])
    );

    if (currentDownloads > existingDownloads) {
      mergedMap.set(id, { ...m, __sourcePipelines: mergedSources });
    } else {
      existing.__sourcePipelines = mergedSources;
      mergedMap.set(id, existing);
    }
  }

  for (const group of fetchedByPipeline) {
    for (const m of group.models) {
      upsertModel(m);
    }
  }
  for (const m of ggufModels) {
    upsertModel(m);
  }

  const raw = Array.from(mergedMap.values());

  const filtered = raw
    .filter(m => !m?.gated && !m?.private)
    .filter(m => (m?.siblings || []).some(s => hasSupportedExtension(s?.rfilename)))
    .map(m => {
      const formats = extractFormats(m.siblings || []);
      const tags = Array.isArray(m.tags) ? m.tags : [];
      const name = m.modelId || m.id || '';

      return {
        name,
        provider: 'huggingface',
        downloads: Number(m.downloads || 0),
        likes: Number(m.likes || 0),
        author: m.author || null,
        lastUpdated: m.lastModified || null,
        shortDescription: m.cardData?.short_description || m.cardData?.summary || null,
        longDescriptionMarkdown: null,
        sourcePipelines: Array.isArray(m.__sourcePipelines) ? m.__sourcePipelines : [],
        formats,
        categories: categorizeModel(name, tags, formats),
      };
    })
    .sort((a, b) => b.downloads - a.downloads);

  const readmeStats = await enrichModelsWithReadme(filtered);

  const out = {
    fetchedAt: new Date().toISOString(),
    source: {
      endpoint: HF_API,
      pipelineTags: allPipelineTags,
      imagePipelineTags: IMAGE_PIPELINE_TAGS,
      textPipelineTags: TEXT_PIPELINE_TAGS,
      includeGGUFFilter: true,
      readme: {
        enabled: true,
        limit: README_FETCH_LIMIT,
        concurrency: README_CONCURRENCY,
      },
      perPipelineParams: {
        sort: 'downloads',
        direction: -1,
        limit: MAX_MODELS,
        full: true,
      },
      ggufParams: {
        filter: 'gguf',
        sort: 'downloads',
        direction: -1,
        limit: MAX_GGUF_MODELS,
        full: true,
      },
    },
    supportedExtensions: SUPPORTED_EXTENSIONS,
    counts: {
      raw: raw.length,
      filtered: filtered.length,
      readmeAttempted: readmeStats.attempted,
      readmeSucceeded: readmeStats.succeeded,
    },
    sampleTop20: filtered.slice(0, 20),
    models: filtered,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2), 'utf8');

  console.log(`raw=${out.counts.raw}`);
  console.log(`filtered=${out.counts.filtered}`);
  console.log(`saved=${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error(err?.message || err);
  process.exit(1);
});
