import { appLogger } from '@main/logging/logger';
import { Container } from '@main/core/container';

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
        while (stack.length > 0) {
            const node = stack[stack.length - 1];
            if (color.get(node) === WHITE) {
                color.set(node, GRAY);
                for (const dep of graph.get(node) ?? []) {
                    if (color.get(dep) === GRAY) {
                        const cycle = [dep, node];
                        let cur = node;
                        while (parent.get(cur) !== dep && parent.get(cur) != null) {
                            cur = parent.get(cur) as string;
                            cycle.push(cur);
                        }
                        cycles.push(cycle.reverse());
                    } else if (color.get(dep) === WHITE) {
                        parent.set(dep, node);
                        stack.push(dep);
                    }
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
