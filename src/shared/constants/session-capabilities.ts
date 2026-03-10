import { SessionCapabilityDescriptor } from '@shared/types/session-engine';

export const SESSION_CAPABILITY_DESCRIPTORS: SessionCapabilityDescriptor[] = [
    {
        id: 'council',
        label: 'Council',
        enabledByDefault: false,
        compatibleModes: ['chat', 'workspace', 'automation'],
        description: 'Enables multi-agent or multi-model council behavior on top of a session.',
    },
    {
        id: 'tools',
        label: 'Tools',
        enabledByDefault: true,
        compatibleModes: ['chat', 'workspace', 'automation'],
        description: 'Allows the session runtime to dispatch tool execution and tool results.',
    },
    {
        id: 'workspace_context',
        label: 'Workspace Context',
        enabledByDefault: false,
        compatibleModes: ['workspace', 'automation'],
        description: 'Injects workspace-aware context and file/project scope into a session.',
    },
    {
        id: 'task_planning',
        label: 'Task Planning',
        enabledByDefault: false,
        compatibleModes: ['automation'],
        description: 'Adds planning lifecycle and plan proposal semantics to an automation session.',
    },
    {
        id: 'task_execution',
        label: 'Task Execution',
        enabledByDefault: false,
        compatibleModes: ['automation'],
        description: 'Adds execution-state tracking, step lifecycle, and automation execution hooks.',
    },
    {
        id: 'rag',
        label: 'RAG',
        enabledByDefault: false,
        compatibleModes: ['chat', 'workspace', 'automation'],
        description: 'Enables retrieval-augmented context injection for session prompts.',
    },
    {
        id: 'image_generation',
        label: 'Image Generation',
        enabledByDefault: false,
        compatibleModes: ['chat', 'workspace'],
        description: 'Allows the session runtime to route image generation requests.',
    },
    {
        id: 'checkpoints',
        label: 'Checkpoints',
        enabledByDefault: false,
        compatibleModes: ['automation'],
        description: 'Adds checkpoint, rollback, and snapshot semantics to the session runtime.',
    },
    {
        id: 'recovery',
        label: 'Recovery',
        enabledByDefault: true,
        compatibleModes: ['chat', 'workspace', 'automation'],
        description: 'Tracks interrupted or resumable session state for restart-safe recovery.',
    },
];

export const SESSION_CAPABILITY_DESCRIPTOR_MAP = Object.fromEntries(
    SESSION_CAPABILITY_DESCRIPTORS.map(descriptor => [descriptor.id, descriptor])
) as Record<SessionCapabilityDescriptor['id'], SessionCapabilityDescriptor>;
