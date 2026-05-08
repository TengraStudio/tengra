 
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './src/tests/e2e',
    timeout: 60000,
    retries: 0,
    workers: 1, // Electron tests must run sequentially
    use: {
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'electron',
            use: {
                // Custom electron launch config handled in test
            },
        },
    ],
});
