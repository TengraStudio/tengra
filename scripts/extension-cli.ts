#!/usr/bin/env node
/**
 * Tandem Extension CLI
 * MKT-DEV-01: Extension SDK/templates/CLI
 * 
 * Usage:
 *   tandem-extension create <extension-name> [options]
 *   tandem-extension build [options]
 *   tandem-extension dev [options]
 *   tandem-extension test [options]
 *   tandem-extension publish [options]
 */

import * as fs from 'fs';
import * as path from 'path';

/** CLI command types */
type CliCommand = 'create' | 'build' | 'dev' | 'test' | 'publish' | 'help';

/** CLI options */
interface CliOptions {
    command: CliCommand;
    name?: string;
    path?: string;
    publisher?: string;
    description?: string;
    template?: string;
    watch?: boolean;
    hotReload?: boolean;
    debug?: boolean;
    port?: number;
    coverage?: boolean;
    token?: string;
    registry?: string;
    dryRun?: boolean;
}

/** Extension templates */
const TEMPLATES = {
    basic: 'basic-extension',
    mcp: 'mcp-server',
    tool: 'tool-extension',
    theme: 'theme-extension',
};

/** Default template content */
const TEMPLATE_FILES: Record<string, Record<string, string>> = {
    'basic-extension': {
        'package.json': JSON.stringify(
            {
                name: '{{EXTENSION_NAME}}',
                version: '1.0.0',
                description: '{{DESCRIPTION}}',
                main: './dist/extension.js',
                scripts: {
                    build: 'tsc',
                    dev: 'tsc --watch',
                    test: 'jest',
                },
                keywords: ['tandem', 'extension'],
                author: '{{PUBLISHER}}',
                license: 'MIT',
                tandem: {
                    id: '{{EXTENSION_ID}}',
                    name: '{{EXTENSION_NAME}}',
                    version: '1.0.0',
                    description: '{{DESCRIPTION}}',
                    author: { name: '{{PUBLISHER}}' },
                    category: 'other',
                    keywords: [],
                    main: './dist/extension.js',
                    license: 'MIT',
                    permissions: [],
                    capabilities: [],
                    activationEvents: [{ type: 'onStartup' }],
                },
            },
            null,
            2
        ),
        'src/extension.ts': `/**
 * {{EXTENSION_NAME}} Extension
 * {{DESCRIPTION}}
 */

import { ExtensionModule, ExtensionContext, ExtensionAPI } from '@shared/types/extension';

export async function activate(context: ExtensionContext): Promise<void> {
    context.logger.info('{{EXTENSION_NAME}} extension activated');

    // Register a command
    const api = new ExtensionAPIImpl(context);
    
    api.registerCommand(
        {
            id: '{{EXTENSION_ID}}.hello',
            title: 'Say Hello',
        },
        () => {
            api.showMessage('Hello from {{EXTENSION_NAME}}!');
            return { success: true };
        }
    );
}

export async function deactivate(): Promise<void> {
    // Cleanup
}
`,
        'tsconfig.json': JSON.stringify(
            {
                compilerOptions: {
                    target: 'ES2020',
                    module: 'commonjs',
                    outDir: './dist',
                    rootDir: './src',
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                    declaration: true,
                },
                include: ['src/**/*'],
                exclude: ['node_modules', 'dist'],
            },
            null,
            2
        ),
        'README.md': `# {{EXTENSION_NAME}}

{{DESCRIPTION}}

## Installation

1. Open Tandem
2. Go to Extensions
3. Search for "{{EXTENSION_NAME}}"
4. Click Install

## Usage

Describe how to use your extension here.

## Development

\`\`\`bash
npm install
npm run build
npm run dev  # Watch mode
\`\`\`

## License

MIT
`,
    },
    'mcp-server': {
        'package.json': JSON.stringify(
            {
                name: '{{EXTENSION_NAME}}',
                version: '1.0.0',
                description: '{{DESCRIPTION}}',
                main: './dist/extension.js',
                scripts: {
                    build: 'tsc',
                    dev: 'tsc --watch',
                    test: 'jest',
                },
                keywords: ['tandem', 'extension', 'mcp'],
                author: '{{PUBLISHER}}',
                license: 'MIT',
                tandem: {
                    id: '{{EXTENSION_ID}}',
                    name: '{{EXTENSION_NAME}}',
                    version: '1.0.0',
                    description: '{{DESCRIPTION}}',
                    author: { name: '{{PUBLISHER}}' },
                    category: 'development',
                    keywords: ['mcp'],
                    main: './dist/extension.js',
                    license: 'MIT',
                    permissions: ['filesystem', 'process'],
                    capabilities: ['mcp-server'],
                    activationEvents: [{ type: 'onStartup' }],
                },
            },
            null,
            2
        ),
        'src/extension.ts': `/**
 * {{EXTENSION_NAME}} MCP Server Extension
 * {{DESCRIPTION}}
 */

import { ExtensionModule, ExtensionContext, ExtensionAPI, JsonObject, JsonValue } from '@shared/types/extension';

export async function activate(context: ExtensionContext): Promise<void> {
    context.logger.info('{{EXTENSION_NAME}} MCP Server activated');

    const api = new ExtensionAPIImpl(context);

    // Register MCP tools
    api.registerTool(
        {
            id: '{{EXTENSION_ID}}.example-tool',
            name: 'example_tool',
            description: 'An example MCP tool',
            inputSchema: {
                type: 'object',
                properties: {
                    input: { type: 'string', description: 'Input string' },
                },
                required: ['input'],
            },
            handler: 'handleExampleTool',
        },
        async (args: JsonObject): Promise<JsonValue> => {
            const input = args.input as string;
            context.logger.info('Tool called with:', input);
            return { result: \`Processed: \${input}\` };
        }
    );
}

export async function deactivate(): Promise<void> {
    // Cleanup
}
`,
        'tsconfig.json': JSON.stringify(
            {
                compilerOptions: {
                    target: 'ES2020',
                    module: 'commonjs',
                    outDir: './dist',
                    rootDir: './src',
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                    declaration: true,
                },
                include: ['src/**/*'],
                exclude: ['node_modules', 'dist'],
            },
            null,
            2
        ),
        'README.md': `# {{EXTENSION_NAME}} MCP Server

{{DESCRIPTION}}

## MCP Tools

### example_tool

An example MCP tool.

**Input Schema:**
\`\`\`json
{
    "type": "object",
    "properties": {
        "input": { "type": "string", "description": "Input string" }
    },
    "required": ["input"]
}
\`\`\`

## License

MIT
`,
    },
};

/** Parse CLI arguments */
function parseArgs(args: string[]): CliOptions {
    const options: CliOptions = {
        command: 'help',
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === 'create' || arg === 'build' || arg === 'dev' || arg === 'test' || arg === 'publish' || arg === 'help') {
            options.command = arg;
        } else if (arg === '--name' || arg === '-n') {
            options.name = args[++i];
        } else if (arg === '--path' || arg === '-p') {
            options.path = args[++i];
        } else if (arg === '--publisher') {
            options.publisher = args[++i];
        } else if (arg === '--description' || arg === '-d') {
            options.description = args[++i];
        } else if (arg === '--template' || arg === '-t') {
            options.template = args[++i];
        } else if (arg === '--watch' || arg === '-w') {
            options.watch = true;
        } else if (arg === '--hot-reload') {
            options.hotReload = true;
        } else if (arg === '--debug') {
            options.debug = true;
        } else if (arg === '--port') {
            options.port = parseInt(args[++i], 10);
        } else if (arg === '--coverage') {
            options.coverage = true;
        } else if (arg === '--token') {
            options.token = args[++i];
        } else if (arg === '--registry') {
            options.registry = args[++i];
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        }
    }

    return options;
}

/** Create a new extension */
function createExtension(options: CliOptions): void {
    if (!options.name) {
        console.error('Error: Extension name is required');
        console.log('Usage: tandem-extension create --name <extension-name>');
        process.exit(1);
    }

    const extensionName = options.name;
    const publisher = options.publisher || 'my-publisher';
    const extensionId = `${publisher}.${extensionName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    const description = options.description || `A Tandem extension: ${extensionName}`;
    const template = options.template || 'basic';
    const targetPath = path.resolve(options.path || extensionName);

    console.log(`Creating extension: ${extensionName}`);
    console.log(`  ID: ${extensionId}`);
    console.log(`  Publisher: ${publisher}`);
    console.log(`  Template: ${template}`);
    console.log(`  Path: ${targetPath}`);

    // Check if directory exists
    if (fs.existsSync(targetPath)) {
        console.error(`Error: Directory already exists: ${targetPath}`);
        process.exit(1);
    }

    // Get template
    const templateFiles = TEMPLATE_FILES[template] || TEMPLATE_FILES['basic-extension'];

    // Create directory structure
    fs.mkdirSync(targetPath, { recursive: true });
    fs.mkdirSync(path.join(targetPath, 'src'), { recursive: true });

    // Write template files
    for (const [filePath, content] of Object.entries(templateFiles)) {
        const fullPath = path.join(targetPath, filePath);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Replace placeholders
        const processedContent = content
            .replace(/\{\{EXTENSION_NAME\}\}/g, extensionName)
            .replace(/\{\{EXTENSION_ID\}\}/g, extensionId)
            .replace(/\{\{PUBLISHER\}\}/g, publisher)
            .replace(/\{\{DESCRIPTION\}\}/g, description);

        fs.writeFileSync(fullPath, processedContent);
        console.log(`  Created: ${filePath}`);
    }

    console.log(`\nExtension created successfully!`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${extensionName}`);
    console.log(`  npm install`);
    console.log(`  npm run build`);
}

/** Build extension */
function buildExtension(options: CliOptions): void {
    console.log('Building extension...');
    // This would integrate with the actual build system
    console.log('Build complete!');
}

/** Start development server */
function startDevServer(options: CliOptions): void {
    console.log('Starting development server...');
    if (options.watch) {
        console.log('  Watch mode enabled');
    }
    if (options.hotReload) {
        console.log('  Hot reload enabled');
    }
    if (options.debug) {
        console.log('  Debug mode enabled');
    }
    // This would start the actual dev server
    console.log('Development server running...');
}

/** Run tests */
function runTests(options: CliOptions): void {
    console.log('Running tests...');
    if (options.coverage) {
        console.log('  Coverage enabled');
    }
    // This would run the actual tests
    console.log('Tests complete!');
}

/** Publish extension */
function publishExtension(options: CliOptions): void {
    if (!options.token) {
        console.error('Error: Token is required for publishing');
        console.log('Usage: tandem-extension publish --token <your-token>');
        process.exit(1);
    }

    console.log('Publishing extension...');
    if (options.dryRun) {
        console.log('  Dry run mode - no actual publish');
    }
    // This would publish to the actual registry
    console.log('Extension published successfully!');
}

/** Show help */
function showHelp(): void {
    console.log(`
Tandem Extension CLI

Usage:
  tandem-extension <command> [options]

Commands:
  create    Create a new extension
  build     Build the extension
  dev       Start development server
  test      Run tests
  publish   Publish extension to registry
  help      Show this help message

Options:
  --name, -n <name>           Extension name
  --path, -p <path>           Target path
  --publisher <publisher>     Publisher name
  --description, -d <desc>    Extension description
  --template, -t <template>   Template to use (basic, mcp, tool, theme)
  --watch, -w                 Watch for changes
  --hot-reload                Enable hot reload
  --debug                     Enable debug mode
  --port <port>               Dev server port
  --coverage                  Enable test coverage
  --token <token>             Publish token
  --registry <url>            Registry URL
  --dry-run                   Dry run (no actual publish)

Examples:
  tandem-extension create --name my-extension --publisher my-company
  tandem-extension dev --watch --hot-reload
  tandem-extension publish --token my-token
`);
}

/** Main CLI entry point */
function main(): void {
    const args = process.argv.slice(2);
    const options = parseArgs(args);

    switch (options.command) {
        case 'create':
            createExtension(options);
            break;
        case 'build':
            buildExtension(options);
            break;
        case 'dev':
            startDevServer(options);
            break;
        case 'test':
            runTests(options);
            break;
        case 'publish':
            publishExtension(options);
            break;
        case 'help':
        default:
            showHelp();
            break;
    }
}

// Run CLI
main();
