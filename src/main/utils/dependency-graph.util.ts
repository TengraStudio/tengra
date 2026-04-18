/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Container } from '@main/core/container';
import { appLogger } from '@main/logging/logger';

/** Adjacency list representing service dependencies */
export type DependencyGraph = Map<string, string[]>;

/**
 * Builds an adjacency list from the container's registered services.
 * @param container - The DI container to read from
 * @returns A map of service name to its dependency names
 */
export function buildDependencyGraph(container: Container): DependencyGraph {
    const graph: DependencyGraph = new Map();
    for (const entry of container.getServiceEntries()) {
        graph.set(entry.name, [...entry.dependencies]);
    }
    return graph;
}

/** DFS traversal state used for cycle detection. */
interface DfsState {
    color: Map<string, number>;
    parent: Map<string, string | null>;
    stack: string[];
    cycles: string[][];
    gray: number;
    white: number;
}

/**
 * Processes a single dependency during DFS traversal.
 */
function processDependency(
    dep: string,
    node: string,
    state: DfsState
): void {
    if (state.color.get(dep) === state.gray) {
        const cycle = [dep, node];
        let cur = node;
        while (state.parent.get(cur) !== dep && state.parent.get(cur) != null) {
            cur = state.parent.get(cur) as string;
            cycle.push(cur);
        }
        state.cycles.push(cycle.reverse());
    } else if (state.color.get(dep) === state.white) {
        state.parent.set(dep, node);
        state.stack.push(dep);
    }
}

/**
 * Detects circular dependencies using iterative DFS with coloring.
 * @param graph - The dependency adjacency list
 * @returns Array of cycle paths found (empty if none)
 */
export function findCircularDependencies(graph: DependencyGraph): string[][] {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    const parent = new Map<string, string | null>();
    const cycles: string[][] = [];

    for (const node of graph.keys()) { color.set(node, WHITE); }

    for (const start of graph.keys()) {
        if (color.get(start) !== WHITE) { continue; }
        const stack: string[] = [start];
        const dfsState: DfsState = { color, parent, stack, cycles, gray: GRAY, white: WHITE };
        while (stack.length > 0) {
            const node = stack[stack.length - 1];
            if (color.get(node) === WHITE) {
                color.set(node, GRAY);
                for (const dep of graph.get(node) ?? []) {
                    processDependency(dep, node, dfsState);
                }
            } else {
                color.set(node, BLACK);
                stack.pop();
            }
        }
    }
    return cycles;
}

/**
 * Formats the dependency graph as a printable tree string.
 * @param graph - The dependency adjacency list
 * @returns A multi-line string showing each service and its dependencies
 */
export function formatDependencyTree(graph: DependencyGraph): string {
    const lines: string[] = [`Dependency Graph (${graph.size} services):`];
    for (const [name, deps] of graph) {
        if (deps.length === 0) {
            lines.push(`  ${name} (no dependencies)`);
        } else {
            lines.push(`  ${name} → ${deps.join(', ')}`);
        }
    }
    return lines.join('\n');
}

/**
 * Logs the full dependency graph and any circular dependency warnings.
 * @param container - The DI container to analyze
 */
export function logDependencyGraph(container: Container): string {
    const graph = buildDependencyGraph(container);
    const tree = formatDependencyTree(graph);
    appLogger.info('DependencyGraph', tree);

    const cycles = findCircularDependencies(graph);
    if (cycles.length > 0) {
        const msg = cycles.map(c => c.join(' → ')).join('\n  ');
        appLogger.warn('DependencyGraph', `Circular dependencies found:\n  ${msg}`);
    } else {
        appLogger.info('DependencyGraph', 'No circular dependencies detected');
    }
    return tree;
}
