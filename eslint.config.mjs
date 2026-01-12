import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default tseslint.config(
    { ignores: ['dist', 'node_modules', 'vendor'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            react,
            'react-hooks': reactHooks,
            'simple-import-sort': simpleImportSort,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off', // TypeScript handles this
            'react/display-name': 'warn',
            'react/jsx-key': 'error',
            'react/jsx-no-duplicate-props': 'error',
            'react/jsx-no-undef': 'error',
            'react/jsx-uses-react': 'off',
            'react/jsx-uses-vars': 'error',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'error', // NASA Rule: Eliminate all `any` types
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/prefer-nullish-coalescing': 'warn',
            '@typescript-eslint/prefer-optional-chain': 'warn',
            '@typescript-eslint/no-unnecessary-condition': 'warn',
            '@typescript-eslint/no-floating-promises': 'warn',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            // NASA Power of Ten Rules
            'max-lines-per-function': ['warn', { max: 150, skipBlankLines: true, skipComments: true }], // NASA Rule 4: No function > 150 lines
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
            'complexity': ['warn', 10], // NASA Rule 1: Limit cyclomatic complexity
            'max-params': ['warn', 5], // NASA Rule: Limit function parameters
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-debugger': 'warn',
            'no-alert': 'warn',
            'no-var': 'error',
            'prefer-const': 'warn',
            'prefer-arrow-callback': 'warn',
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
);
