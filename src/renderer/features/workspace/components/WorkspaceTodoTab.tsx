
import {
    addEdge,
    Background,
    Connection,
    Edge,
    Handle,
    MiniMap,
    Node,
    NodeProps,
    Panel,
    Position,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
    useReactFlow,
} from '@xyflow/react';
import {
    CheckCircle2,
    Circle,
    Clock3,
    FileJson,
    FileText,
    Filter,
    Plus,
    Redo2,
    RefreshCw,
    Shuffle,
    Undo2,
    Upload,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { JsonObject, JsonValue, Project } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import '@xyflow/react/dist/style.css';

interface ProjectTodoTabProps {
    project: Project
    onUpdate?: (updates: Partial<Project>) => Promise<void>
    t: (key: string) => string
}

type TodoStatus = 'pending' | 'in_progress' | 'completed';

interface TodoCanvasNodeData extends JsonObject {
    title: string;
    status: TodoStatus;
    category: string;
    assignee: string;
    parentId: string;
    links: string;
}

interface TodoCanvasPayload extends JsonObject {
    version: number;
    nodes: JsonValue;
    edges: JsonValue;
}

interface TodoCanvasSnapshot {
    nodes: Node<TodoCanvasNodeData>[];
    edges: Edge[];
}

const TODO_CANVAS_METADATA_KEY = 'todoCanvasV1';
const NODE_TYPE = 'todoNode';

const STATUS_CLASSES: Record<TodoStatus, string> = {
    pending: 'bg-muted/50 text-muted-foreground',
    in_progress: 'bg-warning/20 text-warning',
    completed: 'bg-success/20 text-success'
};

const DEFAULT_NODE_DATA: TodoCanvasNodeData = {
    title: '',
    status: 'pending',
    category: 'General',
    assignee: '',
    parentId: '',
    links: ''
};

const TEMPLATE_PRESETS: Array<{ id: string; title: string; items: Array<{ title: string; category: string }> }> = [
    {
        id: 'sprint',
        title: 'Sprint Planning',
        items: [
            { title: 'Backlog Refinement', category: 'Planning' },
            { title: 'Implementation', category: 'Development' },
            { title: 'QA Verification', category: 'QA' },
            { title: 'Release', category: 'Release' }
        ]
    },
    {
        id: 'bugfix',
        title: 'Bug Triage',
        items: [
            { title: 'Reproduce Issue', category: 'Bug' },
            { title: 'Root Cause Analysis', category: 'Bug' },
            { title: 'Fix + Tests', category: 'Development' },
            { title: 'Regression Check', category: 'QA' }
        ]
    }
];

const statusIcon = (status: TodoStatus) => {
    if (status === 'completed') { return <CheckCircle2 className="w-3 h-3" />; }
    if (status === 'in_progress') { return <Clock3 className="w-3 h-3" />; }
    return <Circle className="w-3 h-3" />;
};

const TodoNode = ({ data, selected }: NodeProps<Node<TodoCanvasNodeData>>) => {
    const title = typeof data.title === 'string' ? data.title : '';
    const status = data.status === 'in_progress' || data.status === 'completed' ? data.status : 'pending';
    const category = typeof data.category === 'string' ? data.category : '';
    const assignee = typeof data.assignee === 'string' ? data.assignee : '';

    return (
        <div className={`min-w-60 max-w-80 rounded-xl border bg-card text-card-foreground shadow-sm ${selected ? 'border-primary' : 'border-border'}`}>
            <Handle type="target" position={Position.Left} className="!bg-primary/80 !border-0 !w-2 !h-2" />
            <div className="p-3 space-y-2">
                <div className="text-xs font-medium line-clamp-2">{title || 'Untitled Task'}</div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${STATUS_CLASSES[status]}`}>
                        {statusIcon(status)}
                        {status}
                    </span>
                    {category ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] bg-primary/15 text-primary">
                            {category}
                        </span>
                    ) : null}
                    {assignee ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] bg-accent/20 text-accent-foreground">
                            {assignee}
                        </span>
                    ) : null}
                </div>
            </div>
            <Handle type="source" position={Position.Right} className="!bg-primary/80 !border-0 !w-2 !h-2" />
        </div>
    );
};

const nodeTypes = { [NODE_TYPE]: TodoNode };

function isTodoStatus(value: JsonValue | undefined): value is TodoStatus {
    return value === 'pending' || value === 'in_progress' || value === 'completed';
}

function createSnapshot(nodes: Node<TodoCanvasNodeData>[], edges: Edge[]): TodoCanvasSnapshot {
    return {
        nodes: nodes.map(node => ({ ...node, data: { ...node.data } })),
        edges: edges.map(edge => ({ ...edge }))
    };
}

function normalizeNodeData(value: JsonObject | undefined): TodoCanvasNodeData {
    const source = value ?? {};
    return {
        title: typeof source.title === 'string' ? source.title : '',
        status: isTodoStatus(source.status) ? source.status : 'pending',
        category: typeof source.category === 'string' && source.category.trim().length > 0 ? source.category : 'General',
        assignee: typeof source.assignee === 'string' ? source.assignee : '',
        parentId: typeof source.parentId === 'string' ? source.parentId : '',
        links: typeof source.links === 'string' ? source.links : ''
    };
}

function parseTodoCanvas(metadata: JsonObject | undefined): TodoCanvasSnapshot {
    const raw = metadata?.[TODO_CANVAS_METADATA_KEY];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { nodes: [], edges: [] };
    }
    const payload = raw as TodoCanvasPayload;
    const parsedNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    const parsedEdges = Array.isArray(payload.edges) ? payload.edges : [];

    const nodes: Node<TodoCanvasNodeData>[] = [];
    for (const rawNode of parsedNodes) {
        if (!rawNode || typeof rawNode !== 'object' || Array.isArray(rawNode)) { continue; }
        const candidate = rawNode as JsonObject;
        const id = typeof candidate.id === 'string' ? candidate.id : '';
        const position = candidate.position;
        const data = candidate.data;
        if (!id || !position || typeof position !== 'object' || Array.isArray(position) || !data || typeof data !== 'object' || Array.isArray(data)) {
            continue;
        }
        const nodePosition = position as JsonObject;
        const x = typeof nodePosition.x === 'number' ? nodePosition.x : 0;
        const y = typeof nodePosition.y === 'number' ? nodePosition.y : 0;
        nodes.push({
            id,
            type: NODE_TYPE,
            position: { x, y },
            data: normalizeNodeData(data as JsonObject)
        });
    }

    const edges: Edge[] = [];
    for (const rawEdge of parsedEdges) {
        if (!rawEdge || typeof rawEdge !== 'object' || Array.isArray(rawEdge)) { continue; }
        const candidate = rawEdge as JsonObject;
        const id = typeof candidate.id === 'string' ? candidate.id : '';
        const source = typeof candidate.source === 'string' ? candidate.source : '';
        const target = typeof candidate.target === 'string' ? candidate.target : '';
        if (!id || !source || !target) { continue; }
        edges.push({ id, source, target, animated: false });
    }

    return { nodes, edges };
}

function wouldCreateCycle(existingEdges: Edge[], source: string, target: string): boolean {
    if (source === target) { return true; }
    const graph = new Map<string, string[]>();
    for (const edge of existingEdges) {
        const list = graph.get(edge.source) ?? [];
        list.push(edge.target);
        graph.set(edge.source, list);
    }
    const newList = graph.get(source) ?? [];
    newList.push(target);
    graph.set(source, newList);

    const queue: string[] = [target];
    const seen = new Set<string>();
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || seen.has(current)) { continue; }
        if (current === source) { return true; }
        seen.add(current);
        const children = graph.get(current) ?? [];
        for (const child of children) {
            queue.push(child);
        }
    }
    return false;
}

function layoutNodesByCategory(nodes: Node<TodoCanvasNodeData>[]): Node<TodoCanvasNodeData>[] {
    const categories = [...new Set(nodes.map(node => node.data.category || 'General'))];
    const laneWidth = 380;
    const lanePadding = 32;
    const rowHeight = 160;

    return nodes.map((node, index) => {
        const category = node.data.category || 'General';
        const laneIndex = Math.max(0, categories.indexOf(category));
        const nodeOrderInLane = nodes
            .filter(candidate => (candidate.data.category || 'General') === category)
            .findIndex(candidate => candidate.id === node.id);
        const safeRow = nodeOrderInLane >= 0 ? nodeOrderInLane : index;
        return {
            ...node,
            position: {
                x: lanePadding + laneIndex * laneWidth,
                y: lanePadding + safeRow * rowHeight
            }
        };
    });
}

function buildMarkdown(nodes: Node<TodoCanvasNodeData>[], edges: Edge[]): string {
    const lines: string[] = ['# Canvas TODO Export', ''];
    for (const node of nodes) {
        const mark = node.data.status === 'completed' ? 'x' : ' ';
        const assigneeText = node.data.assignee ? ` @${node.data.assignee}` : '';
        const categoryText = node.data.category ? ` [${node.data.category}]` : '';
        lines.push(`- [${mark}] ${node.data.title || 'Untitled'}${categoryText}${assigneeText}`);
    }
    if (edges.length > 0) {
        lines.push('', '## Dependencies');
        for (const edge of edges) {
            lines.push(`- ${edge.source} -> ${edge.target}`);
        }
    }
    return lines.join('\n');
}

const FlowToolbar: React.FC<{
    onFit: () => void;
    onAutoLayout: () => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}> = ({ onFit, onAutoLayout, onUndo, onRedo, canUndo, canRedo }) => {
    return (
        <Panel position="top-right" className="m-2 flex items-center gap-2 rounded-lg border border-border bg-background/90 p-1">
            <button onClick={onFit} className="h-7 px-2 text-xs rounded bg-muted hover:bg-muted/80">Fit</button>
            <button onClick={onAutoLayout} className="h-7 px-2 text-xs rounded bg-muted hover:bg-muted/80 inline-flex items-center gap-1"><Shuffle className="w-3 h-3" />Layout</button>
            <button onClick={onUndo} disabled={!canUndo} className="h-7 w-7 rounded bg-muted hover:bg-muted/80 disabled:opacity-40"><Undo2 className="w-3.5 h-3.5 mx-auto" /></button>
            <button onClick={onRedo} disabled={!canRedo} className="h-7 w-7 rounded bg-muted hover:bg-muted/80 disabled:opacity-40"><Redo2 className="w-3.5 h-3.5 mx-auto" /></button>
        </Panel>
    );
};

const ProjectTodoTabCanvas: React.FC<ProjectTodoTabProps> = ({ project, onUpdate, t }) => {
    const initialState = useMemo(() => parseTodoCanvas(project.metadata), [project.metadata]);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<TodoCanvasNodeData>>(initialState.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialState.edges);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | TodoStatus>('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [canvasError, setCanvasError] = useState<string | null>(null);
    const { fitView } = useReactFlow();

    const skipNextSaveRef = useRef(true);
    const latestSnapshotRef = useRef<string>('');
    const previousSnapshotRef = useRef<string>('');
    const suppressHistoryRef = useRef(false);
    const undoStackRef = useRef<TodoCanvasSnapshot[]>([]);
    const redoStackRef = useRef<TodoCanvasSnapshot[]>([]);
    const [historyTick, setHistoryTick] = useState(0);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const syncHistoryFlags = useCallback(() => {
        setCanUndo(undoStackRef.current.length > 0);
        setCanRedo(redoStackRef.current.length > 0);
    }, []);
    const applySnapshot = useCallback((snapshot: TodoCanvasSnapshot) => {
        suppressHistoryRef.current = true;
        setNodes(snapshot.nodes);
        setEdges(snapshot.edges);
        window.setTimeout(() => {
            suppressHistoryRef.current = false;
        }, 0);
    }, [setEdges, setNodes]);

    const pushHistory = useCallback((snapshot: TodoCanvasSnapshot) => {
        undoStackRef.current.push(snapshot);
        if (undoStackRef.current.length > 100) {
            undoStackRef.current.shift();
        }
        redoStackRef.current = [];
        setHistoryTick(value => value + 1);
        syncHistoryFlags();
    }, [syncHistoryFlags]);

    useEffect(() => {
        const nextState = parseTodoCanvas(project.metadata);
        suppressHistoryRef.current = true;
        skipNextSaveRef.current = true;
        undoStackRef.current = [];
        redoStackRef.current = [];
        syncHistoryFlags();
        setNodes(nextState.nodes);
        setEdges(nextState.edges);
        const snapshot = JSON.stringify({ nodes: nextState.nodes, edges: nextState.edges });
        previousSnapshotRef.current = snapshot;
        latestSnapshotRef.current = snapshot;
        window.setTimeout(() => {
            suppressHistoryRef.current = false;
        }, 0);
    }, [project.id, project.metadata, setEdges, setNodes, syncHistoryFlags]);

    useEffect(() => {
        const snapshot = JSON.stringify({ nodes, edges });
        if (!suppressHistoryRef.current && previousSnapshotRef.current && snapshot !== previousSnapshotRef.current) {
            const previous = JSON.parse(previousSnapshotRef.current) as TodoCanvasSnapshot;
            pushHistory(createSnapshot(previous.nodes, previous.edges));
        }
        previousSnapshotRef.current = snapshot;
    }, [edges, nodes, pushHistory]);

    const categories = useMemo(
        () => [...new Set(nodes.map(node => node.data.category).filter(value => value.trim().length > 0))],
        [nodes]
    );

    const filteredNodeIds = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const accepted = new Set<string>();
        for (const node of nodes) {
            const matchesQuery = needle.length === 0 || node.data.title.toLowerCase().includes(needle) || node.data.category.toLowerCase().includes(needle) || node.data.assignee.toLowerCase().includes(needle);
            const matchesStatus = statusFilter === 'all' || node.data.status === statusFilter;
            const matchesCategory = categoryFilter === 'all' || node.data.category === categoryFilter;
            if (matchesQuery && matchesStatus && matchesCategory) {
                accepted.add(node.id);
            }
        }
        return accepted;
    }, [categoryFilter, nodes, query, statusFilter]);

    const viewNodes = useMemo(() => nodes.filter(node => filteredNodeIds.has(node.id)), [filteredNodeIds, nodes]);
    const viewEdges = useMemo(
        () => edges.filter(edge => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)),
        [edges, filteredNodeIds]
    );

    const onConnect = useCallback((params: Connection) => {
        if (!params.source || !params.target) { return; }
        if (wouldCreateCycle(edges, params.source, params.target)) {
            setCanvasError('Dependency cycle is not allowed.');
            return;
        }
        setCanvasError(null);
        setEdges(current => addEdge({ ...params, id: `todo-edge-${Date.now()}`, animated: false }, current));
    }, [edges, setEdges]);

    const addTodoNode = useCallback(() => {
        const nextNode: Node<TodoCanvasNodeData> = {
            id: `todo-node-${Date.now()}`,
            type: NODE_TYPE,
            position: { x: 120 + (nodes.length % 4) * 80, y: 120 + (nodes.length % 6) * 70 },
            data: {
                ...DEFAULT_NODE_DATA,
                title: t('workspaceDashboard.createTodo') || 'New Task'
            }
        };
        setNodes(current => [...current, nextNode]);
        setSelectedNodeId(nextNode.id);
    }, [nodes.length, setNodes, t]);

    const selectedNode = useMemo(
        () => nodes.find(node => node.id === selectedNodeId) ?? null,
        [nodes, selectedNodeId]
    );

    const updateSelectedNodeData = useCallback((updates: Partial<TodoCanvasNodeData>) => {
        if (!selectedNodeId) { return; }
        setNodes(current => current.map(node => {
            if (node.id !== selectedNodeId) { return node; }
            return {
                ...node,
                data: {
                    ...node.data,
                    ...updates
                }
            };
        }));
    }, [selectedNodeId, setNodes]);

    const deleteSelectedNode = useCallback(() => {
        if (!selectedNodeId) { return; }
        setNodes(current => current.filter(node => node.id !== selectedNodeId));
        setEdges(current => current.filter(edge => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
        setSelectedNodeId(null);
    }, [selectedNodeId, setEdges, setNodes]);

    const applyAutoLayout = useCallback(() => {
        setNodes(current => layoutNodesByCategory(current));
        window.setTimeout(() => {
            void fitView({ duration: 400 });
        }, 16);
    }, [fitView, setNodes]);

    const addSubTask = useCallback(() => {
        if (!selectedNode) { return; }
        const subNode: Node<TodoCanvasNodeData> = {
            id: `todo-node-${Date.now()}`,
            type: NODE_TYPE,
            position: { x: selectedNode.position.x + 320, y: selectedNode.position.y + 120 },
            data: {
                ...DEFAULT_NODE_DATA,
                title: `${selectedNode.data.title} / Sub Task`,
                category: selectedNode.data.category,
                parentId: selectedNode.id
            }
        };
        setNodes(current => [...current, subNode]);
        setEdges(current => [...current, { id: `todo-edge-${selectedNode.id}-${subNode.id}`, source: selectedNode.id, target: subNode.id }]);
        setSelectedNodeId(subNode.id);
    }, [selectedNode, setEdges, setNodes]);

    const applyTemplate = useCallback((templateId: string) => {
        const template = TEMPLATE_PRESETS.find(item => item.id === templateId);
        if (!template) { return; }
        const seed = Date.now();
        const templateNodes: Node<TodoCanvasNodeData>[] = template.items.map((item, index) => ({
            id: `todo-node-${seed}-${index}`,
            type: NODE_TYPE,
            position: { x: 120 + index * 260, y: 120 + (index % 2) * 100 },
            data: {
                ...DEFAULT_NODE_DATA,
                title: item.title,
                category: item.category
            }
        }));
        const templateEdges: Edge[] = [];
        for (let index = 0; index < templateNodes.length - 1; index++) {
            templateEdges.push({
                id: `todo-edge-${templateNodes[index].id}-${templateNodes[index + 1].id}`,
                source: templateNodes[index].id,
                target: templateNodes[index + 1].id
            });
        }
        setNodes(current => [...current, ...templateNodes]);
        setEdges(current => [...current, ...templateEdges]);
    }, [setEdges, setNodes]);
    const stats = useMemo(() => {
        let completed = 0;
        let inProgress = 0;
        let blocked = 0;
        for (const node of nodes) {
            if (node.data.status === 'completed') {
                completed++;
            } else if (node.data.status === 'in_progress') {
                inProgress++;
            }
            const dependencySources = edges.filter(edge => edge.target === node.id).map(edge => edge.source);
            const isBlocked = dependencySources.some(sourceId => {
                const sourceNode = nodes.find(candidate => candidate.id === sourceId);
                return sourceNode ? sourceNode.data.status !== 'completed' : false;
            });
            if (isBlocked && node.data.status !== 'completed') {
                blocked++;
            }
        }
        const total = nodes.length;
        return { total, completed, inProgress, pending: total - completed - inProgress, blocked };
    }, [edges, nodes]);

    useEffect(() => {
        if (!onUpdate) { return; }
        const payload: TodoCanvasPayload = {
            version: 2,
            nodes: nodes.map(node => ({ id: node.id, position: node.position, data: node.data })),
            edges: edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target }))
        };
        const snapshot = JSON.stringify(payload);
        if (skipNextSaveRef.current) {
            skipNextSaveRef.current = false;
            latestSnapshotRef.current = snapshot;
            return;
        }
        if (snapshot === latestSnapshotRef.current) { return; }
        latestSnapshotRef.current = snapshot;

        const handle = window.setTimeout(() => {
            setSaving(true);
            const nextMetadata: JsonObject = { ...(project.metadata ?? {}), [TODO_CANVAS_METADATA_KEY]: payload };
            void onUpdate({ metadata: nextMetadata })
                .catch(error => {
                    appLogger.error('ProjectTodoTab', 'Failed to persist todo canvas', { error });
                })
                .finally(() => setSaving(false));
        }, 220);

        return () => window.clearTimeout(handle);
    }, [edges, nodes, onUpdate, project.metadata]);

    const exportJson = useCallback(() => {
        const payload = { version: 2, nodes, edges, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `todo-canvas-${project.id}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
    }, [edges, nodes, project.id]);

    const exportMarkdown = useCallback(() => {
        const markdown = buildMarkdown(nodes, edges);
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `todo-canvas-${project.id}.md`;
        link.click();
        URL.revokeObjectURL(link.href);
    }, [edges, nodes, project.id]);

    const importJson = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) { return; }
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const raw = JSON.parse(typeof reader.result === 'string' ? reader.result : '{}') as JsonObject;
                const importedNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
                const importedEdges = Array.isArray(raw.edges) ? raw.edges : [];
                const metadata: JsonObject = {
                    [TODO_CANVAS_METADATA_KEY]: { version: 2, nodes: importedNodes, edges: importedEdges }
                };
                const parsed = parseTodoCanvas(metadata);
                applySnapshot(parsed);
                setCanvasError(null);
            } catch (error) {
                setCanvasError('Invalid JSON import file.');
                appLogger.error('ProjectTodoTab', 'Failed to import todo canvas JSON', { error });
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }, [applySnapshot]);

    const undo = useCallback(() => {
        const previous = undoStackRef.current.pop();
        if (!previous) { return; }
        redoStackRef.current.push(createSnapshot(nodes, edges));
        applySnapshot(previous);
        setHistoryTick(value => value + 1);
        syncHistoryFlags();
    }, [applySnapshot, edges, nodes, syncHistoryFlags]);

    const redo = useCallback(() => {
        const next = redoStackRef.current.pop();
        if (!next) { return; }
        undoStackRef.current.push(createSnapshot(nodes, edges));
        applySnapshot(next);
        setHistoryTick(value => value + 1);
        syncHistoryFlags();
    }, [applySnapshot, edges, nodes, syncHistoryFlags]);

    return (
        <div className="h-full overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span>{t('workspaceDashboard.todoList')}:</span><span>{stats.total}</span><span className="text-success">{stats.completed}</span><span className="text-warning">{stats.inProgress}</span><span>{stats.pending}</span><span className="text-destructive">blocked:{stats.blocked}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative"><Filter className="w-3.5 h-3.5 absolute left-2 top-2.5 text-muted-foreground" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('placeholder.search')} className="h-8 w-32 rounded-md border border-border bg-background pl-7 pr-2 text-xs" /></div>
                    <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | TodoStatus)} className="h-8 rounded-md border border-border bg-background px-2 text-xs"><option value="all">all</option><option value="pending">pending</option><option value="in_progress">in progress</option><option value="completed">completed</option></select>
                    <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs"><option value="all">all categories</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select>
                    <button onClick={addTodoNode} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />{t('workspaceDashboard.createTodo')}</button>
                    <button onClick={exportJson} className="h-8 px-2 rounded-md border border-border text-xs"><FileJson className="w-3.5 h-3.5" /></button>
                    <button onClick={exportMarkdown} className="h-8 px-2 rounded-md border border-border text-xs"><FileText className="w-3.5 h-3.5" /></button>
                    <label className="h-8 px-2 rounded-md border border-border text-xs inline-flex items-center cursor-pointer"><Upload className="w-3.5 h-3.5" /><input type="file" accept="application/json" className="hidden" onChange={importJson} /></label>
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" /> : null}
                </div>
            </div>
            {canvasError ? <div className="px-3 py-1.5 text-xs text-destructive border-b border-destructive/30 bg-destructive/5">{canvasError}</div> : null}
            <div className="flex-1 min-h-0 flex">
                <div className="flex-1 min-w-0">
                    <ReactFlow nodes={viewNodes} edges={viewEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_event, node) => setSelectedNodeId(node.id)} nodeTypes={nodeTypes} fitView className="bg-background">
                        <FlowToolbar onFit={() => { void fitView({ duration: 300 }); }} onAutoLayout={applyAutoLayout} onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} />
                        <Background gap={24} size={1} color="hsl(var(--border) / 0.35)" />
                        <MiniMap pannable zoomable />
                    </ReactFlow>
                </div>
                <div className="w-80 border-l border-border p-3 space-y-3 bg-card/40 overflow-y-auto">
                    <div className="text-[11px] text-muted-foreground">history: {historyTick}</div>
                    <div className="space-y-2"><div className="text-xs font-medium">Templates</div><div className="flex flex-wrap gap-2">{TEMPLATE_PRESETS.map(template => (<button key={template.id} onClick={() => applyTemplate(template.id)} className="h-7 px-2 rounded-md border border-border text-xs">{template.title}</button>))}</div></div>
                    {!selectedNode ? <div className="text-xs text-muted-foreground">Select a node to edit details.</div> : <><div className="space-y-1"><label className="text-xs text-muted-foreground">Task</label><input value={selectedNode.data.title} onChange={event => updateSelectedNodeData({ title: event.target.value })} className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm" /></div><div className="grid grid-cols-2 gap-2"><div className="space-y-1"><label className="text-xs text-muted-foreground">Status</label><select value={selectedNode.data.status} onChange={event => updateSelectedNodeData({ status: event.target.value as TodoStatus })} className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"><option value="pending">pending</option><option value="in_progress">in progress</option><option value="completed">completed</option></select></div><div className="space-y-1"><label className="text-xs text-muted-foreground">Category</label><input value={selectedNode.data.category} onChange={event => updateSelectedNodeData({ category: event.target.value })} className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm" /></div></div><div className="grid grid-cols-2 gap-2"><div className="space-y-1"><label className="text-xs text-muted-foreground">Assignee</label><input value={selectedNode.data.assignee} onChange={event => updateSelectedNodeData({ assignee: event.target.value })} className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm" /></div><div className="space-y-1"><label className="text-xs text-muted-foreground">Parent</label><select value={selectedNode.data.parentId} onChange={event => updateSelectedNodeData({ parentId: event.target.value })} className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"><option value="">none</option>{nodes.filter(node => node.id !== selectedNode.id).map(node => <option key={node.id} value={node.id}>{node.data.title || node.id}</option>)}</select></div></div><div className="space-y-1"><label className="text-xs text-muted-foreground">Links (chat / file / commit)</label><textarea value={selectedNode.data.links} onChange={event => updateSelectedNodeData({ links: event.target.value })} className="w-full min-h-24 rounded-md border border-border bg-background px-2 py-1 text-xs" /></div><div className="flex flex-wrap gap-2"><button onClick={addSubTask} className="h-8 px-3 rounded-md border border-border text-xs">Sub-task</button><button onClick={deleteSelectedNode} className="h-8 px-3 rounded-md border border-destructive/40 text-destructive text-xs">Delete</button><button onClick={applyAutoLayout} className="h-8 px-3 rounded-md border border-border text-xs">Swimlane Layout</button></div></>}
                </div>
            </div>
        </div>
    );
};

export const ProjectTodoTab: React.FC<ProjectTodoTabProps> = ({ project, onUpdate, t }) => {
    return (
        <ReactFlowProvider>
            <ProjectTodoTabCanvas project={project} onUpdate={onUpdate} t={t} />
        </ReactFlowProvider>
    );
};
