import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default tseslint.config(
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'vendor/**',
            'scripts/audit-i18n.ts',
            'scripts/debug-i18n.ts',
            'scripts/extension-cli.ts',
            'playwright.config.ts',
            '**/playwright.config.ts',
            '**/test_errors*.txt',
            '**/lint_output.txt'
        ]
    },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: ['./tsconfig.json', './tsconfig.node.json'],
                tsconfigRootDir: import.meta.dirname,
            },
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            react,
            'react-hooks': reactHooks,
            'simple-import-sort': simpleImportSort,
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off', // TypeScript handles this
            // Disabled due eslint-plugin-react compatibility issue with current flat-config runtime.
            'react/display-name': 'off',
            'react/jsx-key': 'error',
            'react/jsx-no-duplicate-props': 'error',
            'react/jsx-no-undef': 'error',
            'react/jsx-uses-react': 'off',
            'react/jsx-uses-vars': 'error',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'error', // NASA Rule: Eliminate all `any` types
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/prefer-nullish-coalescing': 'off',
            '@typescript-eslint/prefer-optional-chain': 'warn',
            '@typescript-eslint/no-unnecessary-condition': 'off',
            '@typescript-eslint/no-floating-promises': 'warn',
            '@typescript-eslint/await-thenable': 'warn',
            'no-empty': 'warn',
            '@typescript-eslint/no-misused-promises': 'warn',
            // NASA Power of Ten Rules
            'max-lines-per-function': ['warn', { max: 500, skipBlankLines: true, skipComments: true }], // Legacy codebase threshold; reduce gradually
            'max-depth': ['warn', 4], // Limit nesting depth (NASA Rule 1: Simple control flow)
            'no-constant-condition': ['error', { checkLoops: true }], // NASA Rule 2: No unbounded loops (while(true))
            'no-restricted-syntax': [
                'warn',
                {
                    selector: 'WhileStatement[test.type="Literal"][test.value=true]',
                    message: 'NASA Rule 2: Unbounded while(true) loops are not allowed. Use bounded iteration counters instead.'
                },
                {
                    selector: 'CallExpression[callee.name="setTimeout"][arguments.length=1]',
                    message: 'NASA Rule 2: setTimeout without delay may indicate unbounded loops. Use explicit delays.'
                }
            ],
            'complexity': ['warn', 50], // Legacy codebase threshold; reduce gradually
            'max-params': ['warn', 5], // NASA Rule: Limit function parameters
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-debugger': 'warn',
            'no-alert': 'warn',
            'no-var': 'error',
            'prefer-const': 'warn',
            'prefer-arrow-callback': 'warn',
            'semi': ['warn', 'always'],
            'eqeqeq': ['warn', 'always', { null: 'ignore' }],
            'curly': ['warn', 'all'],
            'no-throw-literal': 'error',
            'no-unused-expressions': 'warn',
            // Import sorting rules
            'simple-import-sort/imports': ['warn', {
                groups: [
                    // Node.js builtins
                    ['^(assert|buffer|child_process|cluster|console|constants|crypto|dgram|dns|domain|events|fs|http|https|module|net|os|path|punycode|querystring|readline|repl|stream|string_decoder|sys|timers|tls|tty|url|util|vm|zlib|freelist|v8|process)(/.*|$)'],
                    // Packages (things that start with a letter (or digit or underscore), or @ followed by a letter)
                    ['^@?\\w'],
                    // Internal packages (aliases starting with @/)
                    ['^@/(.*|$)'],
                    // Parent imports (../)
                    ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
                    // Other relative imports (./)
                    ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
                    // Style imports
                    ['^.+\\.s?css$']
                ]
            }],
            'simple-import-sort/exports': 'warn',
            'sort-imports': 'off', // Turn off default sort-imports to use simple-import-sort
        },
    },

    {
        files: ['src/tests/**/*.ts', 'src/tests/**/*.tsx'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            'no-empty': 'off'
        }
    },

    {
        files: ['**/utils/dialog.ts'],
        rules: {
            'no-alert': 'off'
        }
    },

    {
        files: ['src/renderer/features/terminal/components/TerminalPanelImplContent.tsx'],
        rules: {
            'max-lines-per-function': 'off'
        }
    },

    {
        files: [
            'src/main/ipc/mcp-marketplace.ts'
        ],
        rules: {
            'max-lines-per-function': 'off'
        }
    }
);
