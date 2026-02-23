import { Project } from '@/types';

export interface WorkspaceChecklistItem {
    id: string;
    title: string;
    description: string;
}

export interface TroubleshootEntry {
    id: string;
    signature: string;
    fixCommand: string;
    docsLink: string;
}

export interface StandardsTemplate {
    id: string;
    name: string;
    updates: Partial<Project>;
}

export const workspaceSshPlaybook = {
    scenarios: [
        'Bootstrap new SSH mount with key auth and profile save',
        'Attach bastion chain and validate remote workspace roots',
        'Recover transient disconnect with queued editor save flush',
    ],
    failureSignatures: [
        'All configured authentication methods failed',
        'ECONNREFUSED / ENOTFOUND on remote host',
        'Permission denied writing remote workspace files',
    ],
    recoveryActions: [
        'Validate host/user/auth first, then run auth diagnostic in recovery toolkit',
        'Run network diagnostic and verify route + firewall',
        'Run permission diagnostic and apply chmod/chown repair steps',
    ],
};

export const autocompleteMasteryGuide = {
    triggerModes: ['Inline ghost suggestion', 'Manual trigger via Ctrl+Space', 'Contextual completion on token boundaries'],
    rankingTips: ['Keep current file context focused', 'Use precise symbol prefixes', 'Avoid huge noisy contexts'],
    languageExamples: ['TypeScript import auto-completion', 'Python argument completions', 'JSON key/value schema-aware completion'],
};

export const editorPowerWorkflows = [
    'Diagnostics-first pass: resolve red markers before large refactors.',
    'Multi-cursor batch edits followed by semantic preview/apply.',
    'Search/replace with rename impact guards and exclude patterns.',
];

export const onboardingChecklist: WorkspaceChecklistItem[] = [
    { id: 'mounts', title: 'Configure mounts', description: 'Attach local/SSH roots and verify labels.' },
    { id: 'editor', title: 'Open editor', description: 'Open a code file and verify hints/lens toggles.' },
    { id: 'terminal', title: 'Run terminal check', description: 'Run a simple command and verify output stream.' },
    { id: 'git', title: 'Check git status', description: 'Confirm branch, status, and baseline cleanliness.' },
    { id: 'tasks', title: 'Start first task', description: 'Create/track one task and mark progress.' },
];

export const troubleshootKnowledgeBase: TroubleshootEntry[] = [
    {
        id: 'ssh-auth-failure',
        signature: 'All configured authentication methods failed',
        fixCommand: 'ssh -vvv user@host',
        docsLink: 'docs/REMOTE_WORKSPACE_SSH_ONBOARDING.md',
    },
    {
        id: 'ssh-network-timeout',
        signature: 'Connection timed out',
        fixCommand: 'ping <host> && traceroute <host>',
        docsLink: 'docs/TROUBLESHOOTING.md',
    },
    {
        id: 'workspace-permission-denied',
        signature: 'Permission denied',
        fixCommand: 'sudo chown -R $USER:$USER <path>',
        docsLink: 'docs/PROJECT_WORKSPACE_SHORTCUTS_EDITOR_FEATURES.md',
    },
];

export const remoteTeamStandardsTemplates: StandardsTemplate[] = [
    {
        id: 'strict-review',
        name: 'Strict Review Flow',
        updates: {
            buildConfig: {
                lintCommand: 'npm run lint',
                testCommand: 'npm run test',
                buildCommand: 'npm run build',
            },
        },
    },
    {
        id: 'fast-merge',
        name: 'Fast Merge Flow',
        updates: {
            buildConfig: {
                lintCommand: 'npm run lint',
                testCommand: 'npm run test:unit',
                buildCommand: 'npm run build',
            },
        },
    },
];

export const walkthroughScripts = [
    'SSH connect + mount remote root + open file + run command',
    'Edit file + save + run diagnostics + apply quick fix',
    'Create PR-ready commit using editor workflows and test panel',
];

export const workspaceChangelogHighlights = [
    'Latency-aware remote editing with offline save queue',
    'SSH trust center with fingerprint review alerts',
    'Workspace editor snippet manager with import/export/share',
];
