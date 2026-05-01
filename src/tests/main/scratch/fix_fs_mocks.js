const fs = require('fs');
const path = require('path');

const files = [
    'src/tests/main/services/ui/theme.service.test.ts',
    'src/tests/main/services/ui/theme.service.telemetry.test.ts',
    'src/tests/main/services/ui/theme.service.integration.test.ts',
    'src/tests/main/services/terminal/backends/warp.backend.test.ts',
    'src/tests/main/services/terminal/backends/kitty.backend.test.ts',
    'src/tests/main/services/terminal/backends/ghostty.backend.test.ts',
    'src/tests/main/services/terminal/backends/alacritty.backend.test.ts',
    'src/tests/main/services/system/update.service.test.ts',
    'src/tests/main/services/system/runtime-path.service.test.ts',
    'src/tests/main/services/system/runtime-health.service.test.ts',
    'src/tests/main/services/system/runtime-bootstrap.service.test.ts',
    'src/tests/main/services/system/process.service.test.ts',
    'src/tests/main/services/system/process-manager.service.test.ts',
    'src/tests/main/services/system/job-scheduler.service.test.ts',
    'src/tests/main/services/settings.service.test.ts',
    'src/tests/main/services/security/auth.migration.test.ts',
    'src/tests/main/services/llm/prompt-templates.service.test.ts',
    'src/tests/main/services/export.service.test.ts',
    'src/tests/main/services/data/export.service.test.ts',
    'src/tests/main/services/data/filesystem.service.test.ts',
    'src/tests/main/services/data/image-persistence.service.test.ts',
    'src/tests/main/services/data/file.service.test.ts',
    'src/tests/main/ipc/gallery.integration.test.ts',
    'src/tests/main/ipc/git.integration.test.ts',
];

for (const relPath of files) {
    const fullPath = path.join(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) continue;

    let content = fs.readFileSync(fullPath, 'utf8');
    
    if (content.includes("vi.mock('fs'") && !content.includes('existsSync')) {
        console.log(`Fixing ${relPath} (Generic Pattern)`);
        content = content.replace(
            /vi\.mock\('fs', \(\) => \(\{/,
            "vi.mock('fs', () => ({\n    existsSync: vi.fn().mockReturnValue(true),\n    mkdirSync: vi.fn(),"
        );
        fs.writeFileSync(fullPath, content);
    }
}
