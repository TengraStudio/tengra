import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

import { BaseService } from '@main/services/base.service';
import { IdeaCategory, ProjectIdea } from '@shared/types/ideas';
import { getErrorMessage } from '@shared/utils/error.util';

/**
 * Project Scaffold Service
 * Creates directory structures and starter files for approved project ideas
 */
export class ProjectScaffoldService extends BaseService {
    constructor() {
        super('ProjectScaffoldService');
    }

    /**
     * Scaffold a project based on the idea category
     */
    async scaffoldProject(idea: ProjectIdea, targetPath: string): Promise<void> {
        this.logInfo(`Scaffolding project: ${idea.title} at ${targetPath}`);

        try {
            // Create the project directory
            await mkdir(targetPath, { recursive: true });

            // Create category-specific scaffold
            switch (idea.category) {
                case 'website':
                    await this.createWebsiteScaffold(targetPath, idea);
                    break;
                case 'mobile-app':
                    await this.createMobileAppScaffold(targetPath, idea);
                    break;
                case 'game':
                    await this.createGameScaffold(targetPath, idea);
                    break;
                case 'cli-tool':
                    await this.createCliToolScaffold(targetPath, idea);
                    break;
                case 'desktop':
                    await this.createDesktopScaffold(targetPath, idea);
                    break;
                default:
                    await this.createGenericScaffold(targetPath, idea);
            }

            // Always create README
            const readme = this.generateReadme(idea);
            await writeFile(path.join(targetPath, 'README.md'), readme);

            this.logInfo(`Project scaffold created successfully at ${targetPath}`);
        } catch (error) {
            this.logError(`Failed to scaffold project: ${getErrorMessage(error as Error)}`);
            throw error;
        }
    }

    /**
     * Create website scaffold
     */
    private async createWebsiteScaffold(targetPath: string, idea: ProjectIdea): Promise<void> {
        // Create directories
        await mkdir(path.join(targetPath, 'css'), { recursive: true });
        await mkdir(path.join(targetPath, 'js'), { recursive: true });
        await mkdir(path.join(targetPath, 'assets'), { recursive: true });

        // index.html
        const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(idea.title)}</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <header>
        <h1>${this.escapeHtml(idea.title)}</h1>
    </header>
    <main>
        <section id="hero">
            <p>${this.escapeHtml(idea.description)}</p>
        </section>
    </main>
    <footer>
        <p>&copy; ${new Date().getFullYear()} ${this.escapeHtml(idea.title)}</p>
    </footer>
    <script src="js/main.js"></script>
</body>
</html>`;

        // styles.css
        const stylesCss = `/* ${idea.title} Styles */
:root {
    --primary-color: #3498db;
    --secondary-color: #2ecc71;
    --text-color: #333;
    --bg-color: #fff;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    line-height: 1.6;
    color: var(--text-color);
    background-color: var(--bg-color);
}

header {
    background: var(--primary-color);
    color: white;
    padding: 2rem;
    text-align: center;
}

main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}

#hero {
    text-align: center;
    padding: 4rem 0;
}

footer {
    background: #333;
    color: white;
    text-align: center;
    padding: 1rem;
    margin-top: 2rem;
}
`;

        // main.js
        const mainJs = `// ${idea.title} - Main JavaScript
document.addEventListener('DOMContentLoaded', () => {
    console.log('${idea.title} loaded successfully');

    // Add your initialization code here
});
`;

        await writeFile(path.join(targetPath, 'index.html'), indexHtml);
        await writeFile(path.join(targetPath, 'css', 'styles.css'), stylesCss);
        await writeFile(path.join(targetPath, 'js', 'main.js'), mainJs);
    }

    /**
     * Create mobile app scaffold (React Native)
     */
    private async createMobileAppScaffold(targetPath: string, idea: ProjectIdea): Promise<void> {
        await mkdir(path.join(targetPath, 'src'), { recursive: true });
        await mkdir(path.join(targetPath, 'src', 'components'), { recursive: true });
        await mkdir(path.join(targetPath, 'src', 'screens'), { recursive: true });
        await mkdir(path.join(targetPath, 'assets'), { recursive: true });

        // package.json
        const packageJson = {
            name: this.slugify(idea.title),
            version: '0.1.0',
            description: idea.description,
            main: 'src/App.tsx',
            scripts: {
                start: 'expo start',
                android: 'expo start --android',
                ios: 'expo start --ios',
                web: 'expo start --web'
            },
            dependencies: {
                'expo': '^50.0.0',
                'react': '18.2.0',
                'react-native': '0.73.0'
            },
            devDependencies: {
                '@types/react': '^18.2.0',
                'typescript': '^5.3.0'
            }
        };

        // App.tsx
        const appTsx = `import React from 'react';
import { StyleSheet, Text, View, SafeAreaView } from 'react-native';

export default function App() {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>${this.escapeHtml(idea.title)}</Text>
                <Text style={styles.description}>
                    ${this.escapeHtml(idea.description)}
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        color: '#666',
    },
});
`;

        // tsconfig.json
        const tsConfig = {
            compilerOptions: {
                target: 'esnext',
                module: 'commonjs',
                jsx: 'react-native',
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true
            },
            exclude: ['node_modules']
        };

        await writeFile(path.join(targetPath, 'package.json'), JSON.stringify(packageJson, null, 2));
        await writeFile(path.join(targetPath, 'src', 'App.tsx'), appTsx);
        await writeFile(path.join(targetPath, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));
    }

    /**
     * Create game scaffold
     */
    private async createGameScaffold(targetPath: string, idea: ProjectIdea): Promise<void> {
        await mkdir(path.join(targetPath, 'src'), { recursive: true });
        await mkdir(path.join(targetPath, 'assets', 'images'), { recursive: true });
        await mkdir(path.join(targetPath, 'assets', 'sounds'), { recursive: true });

        // package.json
        const packageJson = {
            name: this.slugify(idea.title),
            version: '0.1.0',
            description: idea.description,
            main: 'src/main.js',
            scripts: {
                start: 'vite',
                build: 'vite build',
                preview: 'vite preview'
            },
            dependencies: {
                'phaser': '^3.70.0'
            },
            devDependencies: {
                'vite': '^5.0.0'
            }
        };

        // main.js
        const mainJs = `import Phaser from 'phaser';

// Game configuration
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// Create the game
const game = new Phaser.Game(config);

function preload() {
    // Load assets here
    // this.load.image('player', 'assets/images/player.png');
}

function create() {
    // Set up game objects
    this.add.text(400, 300, '${idea.title}', {
        fontSize: '32px',
        fill: '#fff'
    }).setOrigin(0.5);

    this.add.text(400, 350, 'Press SPACE to start', {
        fontSize: '16px',
        fill: '#ccc'
    }).setOrigin(0.5);
}

function update() {
    // Game loop logic
}
`;

        // index.html
        const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(idea.title)}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #1a1a2e;
        }
        #game-container {
            border: 2px solid #333;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div id="game-container"></div>
    <script type="module" src="src/main.js"></script>
</body>
</html>`;

        // config.json
        const configJson = {
            game: {
                title: idea.title,
                version: '0.1.0',
                width: 800,
                height: 600
            },
            settings: {
                musicVolume: 0.7,
                sfxVolume: 1.0
            }
        };

        await writeFile(path.join(targetPath, 'package.json'), JSON.stringify(packageJson, null, 2));
        await writeFile(path.join(targetPath, 'src', 'main.js'), mainJs);
        await writeFile(path.join(targetPath, 'index.html'), indexHtml);
        await writeFile(path.join(targetPath, 'config.json'), JSON.stringify(configJson, null, 2));
    }

    /**
     * Create CLI tool scaffold
     */
    private async createCliToolScaffold(targetPath: string, idea: ProjectIdea): Promise<void> {
        await mkdir(path.join(targetPath, 'src'), { recursive: true });
        await mkdir(path.join(targetPath, 'bin'), { recursive: true });

        const cliName = this.slugify(idea.title);

        // package.json
        const packageJson = {
            name: cliName,
            version: '0.1.0',
            description: idea.description,
            main: 'src/index.js',
            bin: {
                [cliName]: './bin/cli.js'
            },
            scripts: {
                start: 'node bin/cli.js',
                test: 'node --test'
            },
            dependencies: {
                'commander': '^12.0.0',
                'chalk': '^5.3.0'
            },
            devDependencies: {},
            engines: {
                node: '>=18.0.0'
            }
        };

        // bin/cli.js
        const cliJs = `#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import { run } from '../src/index.js';

program
    .name('${cliName}')
    .description('${idea.description}')
    .version('0.1.0');

program
    .command('run')
    .description('Run the main command')
    .option('-v, --verbose', 'Enable verbose output')
    .action((options) => {
        run(options);
    });

program
    .command('info')
    .description('Show information about the tool')
    .action(() => {
        console.log(chalk.blue('${idea.title}'));
        console.log(chalk.gray('${idea.description}'));
    });

program.parse();
`;

        // src/index.js
        const indexJs = `import chalk from 'chalk';

/**
 * Main entry point for ${idea.title}
 */
export function run(options = {}) {
    console.log(chalk.green('Running ${idea.title}...'));

    if (options.verbose) {
        console.log(chalk.gray('Verbose mode enabled'));
    }

    // Add your main logic here
    console.log(chalk.blue('Done!'));
}

export default { run };
`;

        await writeFile(path.join(targetPath, 'package.json'), JSON.stringify(packageJson, null, 2));
        await writeFile(path.join(targetPath, 'bin', 'cli.js'), cliJs);
        await writeFile(path.join(targetPath, 'src', 'index.js'), indexJs);
    }



    /**
     * Create desktop app scaffold (Electron)
     */
    private async createDesktopScaffold(targetPath: string, idea: ProjectIdea): Promise<void> {
        await mkdir(path.join(targetPath, 'src'), { recursive: true });

        // package.json
        const packageJson = {
            name: this.slugify(idea.title),
            version: '0.1.0',
            description: idea.description,
            main: 'src/main.js',
            scripts: {
                start: 'electron .',
                build: 'electron-builder'
            },
            dependencies: {},
            devDependencies: {
                'electron': '^28.0.0',
                'electron-builder': '^24.9.0'
            }
        };

        // src/main.js
        const mainJs = `const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile('src/index.html');

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        win.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
`;

        // src/preload.js
        const preloadJs = `const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    send: (channel, data) => ipcRenderer.send(channel, data),
    receive: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args))
});
`;

        // src/index.html
        const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">
    <title>${this.escapeHtml(idea.title)}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #333; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${this.escapeHtml(idea.title)}</h1>
        <p>${this.escapeHtml(idea.description)}</p>
    </div>
    <script src="renderer.js"></script>
</body>
</html>`;

        // src/renderer.js
        const rendererJs = `// Renderer process code
document.addEventListener('DOMContentLoaded', () => {
    console.log('${idea.title} loaded');
});
`;

        await writeFile(path.join(targetPath, 'package.json'), JSON.stringify(packageJson, null, 2));
        await writeFile(path.join(targetPath, 'src', 'main.js'), mainJs);
        await writeFile(path.join(targetPath, 'src', 'preload.js'), preloadJs);
        await writeFile(path.join(targetPath, 'src', 'index.html'), indexHtml);
        await writeFile(path.join(targetPath, 'src', 'renderer.js'), rendererJs);
    }

    /**
     * Create generic scaffold for 'other' category
     */
    private async createGenericScaffold(targetPath: string, idea: ProjectIdea): Promise<void> {
        await mkdir(path.join(targetPath, 'src'), { recursive: true });
        await mkdir(path.join(targetPath, 'docs'), { recursive: true });

        // package.json
        const packageJson = {
            name: this.slugify(idea.title),
            version: '0.1.0',
            description: idea.description,
            main: 'src/index.js',
            scripts: {
                start: 'node src/index.js',
                test: 'node --test'
            },
            dependencies: {},
            devDependencies: {}
        };

        // src/index.js
        const indexJs = `/**
 * ${idea.title}
 * ${idea.description}
 */

function main() {
    console.log('${idea.title} started');
    // Add your main logic here
}

main();
`;

        await writeFile(path.join(targetPath, 'package.json'), JSON.stringify(packageJson, null, 2));
        await writeFile(path.join(targetPath, 'src', 'index.js'), indexJs);
    }

    /**
     * Generate README content for the project
     */
    generateReadme(idea: ProjectIdea): string {
        const nameSuggestions = idea.nameSuggestions?.slice(0, 5).join(', ') ?? '';
        const advantages = idea.competitiveAdvantages?.map(a => `- ${a}`).join('\n') ?? '';

        return `# ${idea.title}

${idea.description}

## About

${idea.explanation ?? 'A new project generated by Orbit AI.'}

## Value Proposition

${idea.valueProposition ?? 'This project aims to solve real-world problems in its target domain.'}

${advantages ? `## Competitive Advantages\n\n${advantages}\n` : ''}
${nameSuggestions ? `## Alternative Names\n\nOther name ideas: ${nameSuggestions}\n` : ''}
## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start the project
npm start
\`\`\`

## Project Structure

\`\`\`
${this.getProjectStructure(idea.category)}
\`\`\`

## License

MIT

---

*Generated by [Orbit AI](https://github.com/orbit-ai)*
`;
    }

    /**
     * Get project structure description based on category
     */
    private getProjectStructure(category: IdeaCategory): string {
        const structures: Record<IdeaCategory, string> = {
            'website': `├── index.html
├── css/
│   └── styles.css
├── js/
│   └── main.js
├── assets/
└── README.md`,
            'mobile-app': `├── src/
│   ├── App.tsx
│   ├── components/
│   └── screens/
├── assets/
├── package.json
└── README.md`,
            'game': `├── src/
│   └── main.js
├── assets/
│   ├── images/
│   └── sounds/
├── config.json
├── index.html
└── README.md`,
            'cli-tool': `├── bin/
│   └── cli.js
├── src/
│   └── index.js
├── package.json
└── README.md`,
            'desktop': `├── src/
│   ├── main.js
│   ├── preload.js
│   ├── index.html
│   └── renderer.js
├── package.json
└── README.md`,
            'other': `├── src/
│   └── index.js
├── docs/
├── package.json
└── README.md`
        };
        return structures[category] ?? structures['other'];
    }

    /**
     * Convert string to URL-safe slug
     */
    private slugify(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 50);
    }

    /**
     * Escape HTML special characters
     */
    private escapeHtml(text: string): string {
        const escapeMap: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, char => escapeMap[char] ?? char);
    }
}
