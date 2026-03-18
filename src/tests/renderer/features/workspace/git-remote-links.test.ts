import { buildGitRemoteLinks } from '@renderer/features/workspace/utils/git-remote-links';
import { describe, expect, it } from 'vitest';

describe('buildGitRemoteLinks', () => {
    it('builds GitHub issue and pull request links from ssh remotes', () => {
        const links = buildGitRemoteLinks([
            { name: 'origin', url: 'git@github.com:acme/tengra.git', fetch: true, push: true },
        ], 'main');

        expect(links).toEqual([{
            provider: 'GitHub',
            remoteName: 'origin',
            repositoryLabel: 'acme/tengra',
            repositoryUrl: 'https://github.com/acme/tengra',
            issuesUrl: 'https://github.com/acme/tengra/issues',
            pullRequestsUrl: 'https://github.com/acme/tengra/pulls',
            branchUrl: 'https://github.com/acme/tengra/tree/main',
        }]);
    });

    it('parses GitLab https remotes and encodes branch links', () => {
        const links = buildGitRemoteLinks([
            { name: 'upstream', url: 'https://gitlab.com/acme/platform.git', fetch: true, push: false },
        ], 'feature/runtime gate');

        expect(links[0]).toMatchObject({
            provider: 'GitLab',
            repositoryLabel: 'acme/platform',
            issuesUrl: 'https://gitlab.com/acme/platform/issues',
            pullRequestsUrl: 'https://gitlab.com/acme/platform/-/merge_requests',
            branchUrl: 'https://gitlab.com/acme/platform/-/tree/feature%2Fruntime%20gate',
        });
    });

    it('skips unsupported remotes instead of returning broken links', () => {
        const links = buildGitRemoteLinks([
            { name: 'origin', url: 'file:///tmp/local-repo', fetch: true, push: true },
        ], 'main');

        expect(links).toEqual([]);
    });
});
