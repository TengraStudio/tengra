import { Remote } from '../components/git/types';
import { GitRemoteLinkSet } from '../components/git/types';

interface ParsedRemoteTarget {
    provider: string;
    host: string;
    owner: string;
    repository: string;
}

const PROVIDER_ALIASES: Record<string, string> = {
    'github.com': 'GitHub',
    'gitlab.com': 'GitLab',
    'bitbucket.org': 'Bitbucket',
    'dev.azure.com': 'Azure DevOps',
};

const PROVIDER_PRIORITY = ['origin', 'upstream'];

function normalizeRepositoryName(repository: string): string {
    return repository.replace(/\.git$/i, '');
}

function buildProviderLabel(host: string): string {
    return PROVIDER_ALIASES[host] ?? host;
}

function parseHttpRemote(url: string): ParsedRemoteTarget | null {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        const segments = parsed.pathname.split('/').filter(Boolean);
        if (host === 'dev.azure.com') {
            const organization = segments[0] ?? '';
            const projectMarkerIndex = segments.findIndex(segment => segment === '_git');
            const project = projectMarkerIndex > 0 ? segments[projectMarkerIndex - 1] ?? '' : '';
            const repository = projectMarkerIndex >= 0 ? segments[projectMarkerIndex + 1] ?? '' : '';
            if (!organization || !project || !repository) {
                return null;
            }
            return {
                provider: buildProviderLabel(host),
                host,
                owner: `${organization}/${project}`,
                repository: normalizeRepositoryName(repository),
            };
        }
        const owner = segments[0] ?? '';
        const repository = segments[1] ?? '';
        if (!owner || !repository) {
            return null;
        }
        return {
            provider: buildProviderLabel(host),
            host,
            owner,
            repository: normalizeRepositoryName(repository),
        };
    } catch {
        return null;
    }
}

function parseScpRemote(url: string): ParsedRemoteTarget | null {
    const match = url.match(/^(?:ssh:\/\/)?git@([^/:]+)[:/]([^/]+)\/(.+)$/i);
    if (!match) {
        return null;
    }
    const host = match[1]?.toLowerCase() ?? '';
    const owner = match[2] ?? '';
    const repository = normalizeRepositoryName(match[3] ?? '');
    if (!host || !owner || !repository) {
        return null;
    }
    return {
        provider: buildProviderLabel(host),
        host,
        owner,
        repository,
    };
}

function parseAzureSshRemote(url: string): ParsedRemoteTarget | null {
    const match = url.match(/^git@ssh\.dev\.azure\.com:v3\/([^/]+)\/([^/]+)\/(.+)$/i);
    if (!match) {
        return null;
    }
    const organization = match[1] ?? '';
    const project = match[2] ?? '';
    const repository = normalizeRepositoryName(match[3] ?? '');
    if (!organization || !project || !repository) {
        return null;
    }
    return {
        provider: 'Azure DevOps',
        host: 'dev.azure.com',
        owner: `${organization}/${project}`,
        repository,
    };
}

function parseRemoteUrl(url: string): ParsedRemoteTarget | null {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return parseHttpRemote(url);
    }
    return parseAzureSshRemote(url) ?? parseScpRemote(url);
}

function buildRepositoryUrl(target: ParsedRemoteTarget): string {
    if (target.host === 'dev.azure.com') {
        const [organization, project] = target.owner.split('/');
        return `https://dev.azure.com/${organization}/${project}/_git/${target.repository}`;
    }
    return `https://${target.host}/${target.owner}/${target.repository}`;
}

function buildIssuesUrl(target: ParsedRemoteTarget): string | null {
    const repositoryUrl = buildRepositoryUrl(target);
    if (target.host === 'bitbucket.org') {
        return `${repositoryUrl}/issues`;
    }
    if (target.host === 'dev.azure.com') {
        return `${repositoryUrl}/pullrequests`;
    }
    return `${repositoryUrl}/issues`;
}

function buildPullRequestsUrl(target: ParsedRemoteTarget): string | null {
    const repositoryUrl = buildRepositoryUrl(target);
    if (target.host === 'gitlab.com') {
        return `${repositoryUrl}/-/merge_requests`;
    }
    if (target.host === 'bitbucket.org') {
        return `${repositoryUrl}/pull-requests`;
    }
    if (target.host === 'dev.azure.com') {
        return `${repositoryUrl}/pullrequests`;
    }
    return `${repositoryUrl}/pulls`;
}

function buildBranchUrl(target: ParsedRemoteTarget, currentBranch: string | null): string | null {
    if (!currentBranch) {
        return null;
    }
    const repositoryUrl = buildRepositoryUrl(target);
    if (target.host === 'gitlab.com') {
        return `${repositoryUrl}/-/tree/${encodeURIComponent(currentBranch)}`;
    }
    if (target.host === 'bitbucket.org') {
        return `${repositoryUrl}/src/${encodeURIComponent(currentBranch)}`;
    }
    if (target.host === 'dev.azure.com') {
        return `${repositoryUrl}?version=GB${encodeURIComponent(currentBranch)}`;
    }
    return `${repositoryUrl}/tree/${encodeURIComponent(currentBranch)}`;
}

export function buildGitRemoteLinks(remotes: Remote[], currentBranch: string | null): GitRemoteLinkSet[] {
    const sortedRemotes = [...remotes].sort((left, right) => {
        const leftPriority = PROVIDER_PRIORITY.indexOf(left.name);
        const rightPriority = PROVIDER_PRIORITY.indexOf(right.name);
        return (leftPriority === -1 ? Number.MAX_SAFE_INTEGER : leftPriority)
            - (rightPriority === -1 ? Number.MAX_SAFE_INTEGER : rightPriority);
    });

    return sortedRemotes.flatMap(remote => {
        const target = parseRemoteUrl(remote.url);
        if (!target) {
            return [];
        }
        const repositoryUrl = buildRepositoryUrl(target);
        return [{
            provider: target.provider,
            remoteName: remote.name,
            repositoryLabel: `${target.owner}/${target.repository}`,
            repositoryUrl,
            issuesUrl: buildIssuesUrl(target),
            pullRequestsUrl: buildPullRequestsUrl(target),
            branchUrl: buildBranchUrl(target, currentBranch),
        }];
    });
}
