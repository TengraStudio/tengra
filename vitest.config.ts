import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        name: 'main',
        globals: true,
        environment: 'node',
        include: ['src/tests/main/**/*.test.ts', 'src/tests/main/**/*.spec.ts'],
        exclude: ['src/tests/e2e/**', 'node_modules', 'dist', 'out'],
        setupFiles: ['./src/tests/main/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            include: ['src/main/**/*.ts'],
            exclude: [
                'src/main/**/*.test.ts',
                'src/main/**/types/**',
                'src/main/**/*.d.ts',
                'src/main/preload.ts'
            ],
            // Coverage thresholds - increased to 75% target
            thresholds: {
                statements: 75,
                branches: 65,
                functions: 75,
                lines: 75
            }
        },
        testTimeout: 10000,
        hookTimeout: 10000,
        // Better output
        reporters: ['verbose'],
        // Pool for faster tests
        pool: 'threads',

    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src/renderer'),
            '@renderer': path.resolve(__dirname, './src/renderer'),
            '@main': path.resolve(__dirname, './src/main'),
            '@shared': path.resolve(__dirname, './src/shared'),
        }
    }
});
