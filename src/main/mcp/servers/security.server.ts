import { promises as dns } from 'dns';

import { buildActions, ensureAllowedTarget, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';
import { JsonObject } from '@shared/types/common';

export function buildSecurityServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'security',
            description: 'Security helpers',
            actions: buildActions([
                { name: 'generatePassword', description: 'Generate a password', handler: ({ length, numbers, symbols }) => Promise.resolve(deps.security.generatePassword(length as number, numbers as boolean, symbols as boolean)) },
                { name: 'checkPasswordStrength', description: 'Check password strength', handler: ({ password }) => Promise.resolve(deps.security.checkPasswordStrength(password as string)) },
                { name: 'generateHash', description: 'Generate hash', handler: ({ text, algorithm }) => Promise.resolve(deps.security.generateHash(text as string, algorithm as 'md5' | 'sha256' | 'sha512')) },
                { name: 'stripMetadata', description: 'Strip file metadata', handler: ({ path, outputPath }) => deps.security.stripMetadata(path as string, outputPath as string) }
            ], 'security', deps.auditLog)
        },
        {
            name: 'security-audit',
            description: 'Defensive security and network checks (allowlist enforced)',
            actions: buildActions([
                {
                    name: 'dnsLookup',
                    description: 'Resolve DNS A/AAAA records',
                    handler: (async (args: JsonObject) => {
                        const target = args.target as string;
                        const hostname = ensureAllowedTarget(deps, target);
                        const records = await dns.lookup(hostname, { all: true });
                        return { hostname, records: records.map(r => ({ address: r.address, family: r.family })) };
                    })
                },
                {
                    name: 'mxLookup',
                    description: 'Resolve DNS MX records',
                    handler: (async (args: JsonObject) => {
                        const target = args.target as string;
                        const hostname = ensureAllowedTarget(deps, target);
                        const records = await dns.resolveMx(hostname);
                        return { hostname, records: records.map(r => ({ exchange: r.exchange, priority: r.priority })) };
                    })
                },
                {
                    name: 'httpHeaders',
                    description: 'Fetch HTTP headers (HEAD request)',
                    handler: (async (args: JsonObject) => {
                        const url = args.url as string;
                        const hostname = ensureAllowedTarget(deps, url);
                        const targetUrl = url.includes('://') ? url : `https://${hostname}`;
                        const response = await fetch(targetUrl, { method: 'HEAD' });
                        const headers: Record<string, string> = {};
                        response.headers.forEach((value, key) => { headers[key] = value; });
                        return { status: response.status, headers };
                    })
                },
                {
                    name: 'portScan',
                    description: 'Scan ports with nmap (allowlist only)',
                    handler: (async (args: JsonObject) => {
                        const target = args.target as string;
                        const ports = args.ports as string | undefined;
                        const hostname = ensureAllowedTarget(deps, target);

                        // Strict hostname validation to prevent command injection
                        if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) {
                            throw new Error('Invalid hostname format');
                        }

                        // Strict validation for ports to prevent command injection
                        let portArg = '';
                        if (ports) {
                            if (!/^[0-9,-]+$/.test(ports)) {
                                throw new Error('Invalid ports argument. Only numbers, commas, and dashes are allowed.');
                            }
                            portArg = `-p ${ports}`;
                        }

                        const command = `nmap -Pn ${portArg} ${hostname}`.trim();
                        return deps.command.executeCommand(command);
                    })
                }
            ], 'security-audit', deps.auditLog)
        }
    ];
}
