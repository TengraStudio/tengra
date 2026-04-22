const fs = require('fs');
const path = require('path');

const roots = [
  path.join(process.cwd(), 'src/renderer'),
  path.join(process.cwd(), 'src/tests/renderer'),
];

const issues = [];
const globalAllowedArbitraryPatterns = [];

const allowedArbitraryValuesByFile = new Map(Object.entries({
  'src/renderer/features/workspace/workspace-explorer/WorkspaceExplorerRow.tsx': ['w-[1px]'],
  'src/renderer/features/workspace/workspace-explorer/WorkspaceExplorerInlineRow.tsx': ['rounded-[6px]'],
  'src/renderer/features/workspace/workspace-dashboard/WorkspaceTodoTab.tsx': [],
  'src/renderer/features/workspace/workspace-dashboard/WorkspaceSettingsPanel.tsx': [],
  'src/renderer/features/workspace/workspace-dashboard/WorkspaceGitTab.tsx': ['min-w-[1.25rem]'],
  'src/renderer/features/workspace/workspace-shell/WorkspaceDetails.tsx': ['transition-[margin]'],
  'src/renderer/features/workspace/components/settings/DevServerSection.tsx': ['translate-y-[1px]'],
  'src/renderer/features/workspace/components/git/GitCommitSection.tsx': [],
  'src/renderer/features/workspace/components/git/GitDiffLine.tsx': ['min-h-[1.5rem]'],
  'src/renderer/features/workspace/components/git/GitCommitHistory.tsx': ['left-[38px]', 'top-[36px]', 'w-[1px]'],
  'src/renderer/features/workspace/components/dashboard/FilesTab.tsx': ['shadow-[0_0_8px_rgb(var(--primary)_/_0.5)]'],
  'src/renderer/components/layout/sidebar/SidebarNavigation.tsx': [],
  'src/renderer/components/shared/GalleryView.tsx': [
    'max-h-[90vh]',
    'max-w-[95vw]',
    'min-h-[300px]',
    'min-h-[500px]',
    'w-[420px]',
  ],
  'src/renderer/features/settings/components/MCPServersTab.tsx': ['scale-[0.98]'],
  'src/renderer/features/workspace/workspace-shell/WorkspaceCard.tsx': [
    'blur-[1px]',
    'opacity-[0.02]',
    'opacity-[0.04]',
  ],
  'src/renderer/features/workspace/workspace-shell/WorkspaceHeader.tsx': [
    'scale-[0.98]',
    'scale-[1.02]',
    'stroke-[2.5px]',
    'w-[140px]',
  ],
  'src/renderer/features/workspace/workspace-shell/WorkspaceListContent.tsx': [
    'max-w-[200px]',
  ],
}).map(([file, tokens]) => [file, new Set(tokens)]));

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, files);
      continue;
    }
    if (entry.isFile() && abs.endsWith('.tsx')) {
      files.push(abs);
    }
  }
  return files;
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

for (const root of roots) {
  const files = walk(root);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');

    const twRegex = /\btw-[A-Za-z0-9_:\-/\[\].]+/g;
    let match;
    while ((match = twRegex.exec(content)) !== null) {
      issues.push({
        file,
        line: lineOf(content, match.index),
        type: 'tw-prefix',
        token: match[0],
      });
    }

    const arbitraryRegex = /(?:\b[a-z-]+-\[[^\]\s]+\]|\[[a-z-]+:[^\]\s]+\])/g;
    while ((match = arbitraryRegex.exec(content)) !== null) {
      const token = match[0];
      if (token.startsWith('data-[')) {
        continue;
      }
      const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
      if (globalAllowedArbitraryPatterns.some(p => p.test(token))) {
        continue;
      }
      if (allowedArbitraryValuesByFile.get(rel)?.has(token)) {
        continue;
      }
      issues.push({
        file,
        line: lineOf(content, match.index),
        type: 'arbitrary-value',
        token,
      });
    }
  }
}

if (issues.length === 0) {
  console.log('Renderer style audit passed: no tw-* or disallowed arbitrary-value classes found.');
  process.exit(0);
}

console.error(`Renderer style audit failed with ${issues.length} issue(s).`);
for (const issue of issues.slice(0, 200)) {
  const rel = path.relative(process.cwd(), issue.file).replace(/\\/g, '/');
  console.error(`${rel}:${issue.line} [${issue.type}] ${issue.token}`);
}
if (issues.length > 200) {
  console.error(`...and ${issues.length - 200} more issue(s).`);
}
process.exit(1);
