const fs = require('fs');
const path = require('path');

const roots = [
  path.join(process.cwd(), 'src/renderer'),
  path.join(process.cwd(), 'src/tests/renderer'),
];

const replacementPairs = [
  ['xl-grid-cols-360-main', 'xl:grid-cols-360-main'],
  ['hover-shadow-primary-glow', 'hover:shadow-primary-glow'],
  ['active-scale-98', 'active:scale-98'],

  ['text-[10px]', 'text-10'],
  ['text-[8px]', 'text-8'],
  ['w-[340px]', 'w-340'],
  ['w-[400px]', 'w-400'],
  ['w-[70%]', 'w-70p'],
  ['w-[min(100%,72rem)]', 'w-modal-72'],
  ['w-[min(100%,32rem)]', 'w-modal-32'],
  ['w-[min(20rem,calc(100vw-2rem))]', 'w-command-menu'],

  ['h-[7.5rem]', 'h-120'],
  ['h-[60vh]', 'h-60vh'],
  ['h-[calc(100vh-200px)]', 'h-screen-minus-200'],
  ['h-[var(--radix-select-trigger-height)]', 'h-radix-select-trigger'],

  ['min-h-[70px]', 'min-h-70'],
  ['min-h-[84px]', 'min-h-84'],
  ['min-h-[80px]', 'min-h-80'],
  ['min-h-[90px]', 'min-h-90'],
  ['min-h-[120px]', 'min-h-120'],

  ['min-w-[172px]', 'min-w-172'],
  ['min-w-[148px]', 'min-w-148'],
  ['min-w-[200px]', 'min-w-200'],
  ['min-w-[300px]', 'min-w-300'],
  ['min-w-[1.75rem]', 'min-w-7'],
  ['min-w-[var(--radix-select-trigger-width)]', 'min-w-radix-select-trigger'],

  ['max-h-[85vh]', 'max-h-85vh'],
  ['max-h-[100vh]', 'max-h-screen'],
  ['max-h-[500px]', 'max-h-500'],
  ['max-h-[350px]', 'max-h-350'],
  ['max-h-[300px]', 'max-h-300'],
  ['max-h-[200px]', 'max-h-200'],
  ['max-h-[88vh]', 'max-h-88vh'],
  ['max-h-[calc(100vh-8rem)]', 'max-h-screen-minus-32'],
  ['max-h-[min(88vh,44rem)]', 'max-h-dialog'],

  ['max-w-[95vw]', 'max-w-95vw'],
  ['max-w-[90%]', 'max-w-90p'],
  ['max-w-[28rem]', 'max-w-112'],
  ['max-w-[18rem]', 'max-w-72'],
  ['max-w-[12rem]', 'max-w-48'],

  ['left-[calc(100%+0.5rem)]', 'left-full-plus-2'],
  ['right-[-4px]', '-right-1'],
  ['left-[-4px]', '-left-1'],
  ['top-[-4px]', '-top-1'],
  ['bottom-[-4px]', '-bottom-1'],

  ['p-[2px]', 'p-0.5'],
  ['z-[100]', 'z-100'],
  ['z-[9999]', 'z-9999'],

  ['backdrop-blur-[4px]', 'backdrop-blur-4'],
  ['backdrop-blur-[8px]', 'backdrop-blur-8'],
  ['backdrop-blur-[16px]', 'backdrop-blur-16'],

  ['tracking-[0.05em]', 'tracking-50'],
  ['translate-x-[-4px]', '-translate-x-1'],
  ['scale-[0.98]', 'scale-98'],
  ['scale-[1.02]', 'scale-102'],
  ['stroke-[3]', 'stroke-3'],

  ['shadow-[0_0_0_2px_hsl(var(--background))]', 'shadow-outline-background-2'],
  ['shadow-[0_0_0_1px_hsl(var(--primary)/0.5)]', 'shadow-outline-primary-1'],
  ['shadow-[0_0_10px_rgba(var(--primary),0.5)]', 'shadow-glow-primary-strong'],
  ['shadow-[0_0_10px_rgba(var(--primary),0.2)]', 'shadow-glow-primary-soft'],
  ['shadow-[0_0_10px_rgba(var(--primary-rgb),0.4)]', 'shadow-glow-primary-rgb'],
  ['shadow-[0_0_8px_rgba(var(--primary),0.5)]', 'shadow-glow-primary'],
  ['shadow-[0_0_8px_rgba(var(--primary),0.3)]', 'shadow-glow-primary-subtle'],
  ['shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]', 'shadow-glow-primary-rgb-soft'],
  ['shadow-[0_0_8px_rgba(var(--destructive),0.6)]', 'shadow-glow-destructive'],
  ['shadow-[0_0_8px_rgba(var(--destructive-rgb),0.5)]', 'shadow-glow-destructive-rgb'],
  ['shadow-[0_0_8px_rgba(34,197,94,0.5)]', 'shadow-glow-success'],
  ['shadow-[0_0_8px_rgba(var(--warning),0.4)]', 'shadow-glow-warning'],
  ['shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]', 'shadow-glow-primary-ring'],
  ['shadow-[2px_0_8px_rgba(var(--primary-rgb),0.5)]', 'shadow-edge-primary'],
  ['shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]', 'shadow-glow-primary-lg'],
  ['shadow-[0_0_20px_hsl(var(--primary)/0.3)]', 'shadow-glow-primary-hsl'],
  ['shadow-[0_25px_50px_-12px_hsl(var(--foreground)/25%)]', 'shadow-modal-foreground'],

  ['bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem]', 'progress-animated'],
  ['bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)]', 'bg-progress-stripes-white'],
  ['bg-[length:1rem_1rem]', 'bg-size-progress'],
  ['after:bg-[linear-gradient(90deg,transparent_0%,hsl(var(--muted-foreground)/0.1)_50%,transparent_100%)]', 'after:bg-skeleton-shimmer'],
  ['bg-[#0c0c0c]', 'bg-black'],

  ['grid-cols-[380px,1fr]', 'grid-cols-380-main'],
  ['grid-cols-[2fr_1fr]', 'grid-cols-2fr-1fr'],
  ['grid-cols-[20rem_minmax(0,1fr)]', 'grid-cols-80-main'],
  ['grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]', 'grid-cols-balance-95-105'],

  ['[transform-style:preserve-3d]', 'transform-3d'],
  ['[animation-delay:-0.3s]', 'animate-delay-300'],
  ['[animation-delay:-0.15s]', 'animate-delay-150'],
  ['will-change-[opacity]', 'will-change-opacity'],
  ['transition-[width]', 'transition-width'],
];

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

let changed = 0;
for (const root of roots) {
  const files = walk(root);
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;

    content = content.replace(/\btw-/g, '');

    for (const [from, to] of replacementPairs) {
      content = content.split(from).join(to);
    }

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      changed += 1;
    }
  }
}

console.log(`Updated ${changed} TSX files.`);
