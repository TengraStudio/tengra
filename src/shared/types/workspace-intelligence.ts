export interface WorkspaceDependencyGraphNode {
    path: string;
    relativePath: string;
    extension: string;
    symbolCount: number;
    outboundDependencyCount: number;
    inboundDependencyCount: number;
    externalDependencyCount: number;
}

export interface WorkspaceDependencyGraphEdge {
    from: string;
    to: string;
    kind: 'workspace' | 'package';
    specifier: string;
}

export interface WorkspaceDependencyGraph {
    rootPath: string;
    indexedFileCount: number;
    generatedAt: string;
    nodes: WorkspaceDependencyGraphNode[];
    edges: WorkspaceDependencyGraphEdge[];
    externalDependencies: string[];
}

export interface WorkspaceCodeMapSymbol {
    name: string;
    kind: string;
    line: number;
    signature: string;
}

export interface WorkspaceCodeMapFile {
    path: string;
    relativePath: string;
    extension: string;
    symbolCount: number;
    topLevelSymbols: WorkspaceCodeMapSymbol[];
}

export interface WorkspaceCodeMapFolder {
    path: string;
    fileCount: number;
    symbolCount: number;
}

export interface WorkspaceCodeMap {
    rootPath: string;
    totalFiles: number;
    totalSymbols: number;
    generatedAt: string;
    files: WorkspaceCodeMapFile[];
    folders: WorkspaceCodeMapFolder[];
}
