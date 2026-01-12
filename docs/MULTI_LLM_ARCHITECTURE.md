# Multi-LLM Architecture & Responsive UI

## Overview

This document describes the enhanced architecture that enables multiple LLMs to work simultaneously and provides a responsive, user-friendly UI across all devices.

## Multi-LLM Concurrency System

### Components

#### 1. MultiLLMOrchestrator (`src/main/services/multi-llm-orchestrator.service.ts`)

The orchestrator manages concurrent execution of multiple LLM providers with:
- **Provider-specific concurrency limits**: Each provider has configurable max concurrent requests
- **Priority-based queuing**: Tasks are sorted by priority for optimal resource allocation
- **Resource isolation**: Each provider operates independently without blocking others
- **Statistics tracking**: Real-time metrics for each provider (active tasks, latency, errors)

**Default Configuration:**
- Cloud providers (OpenAI, Anthropic, Groq, Gemini): 5-10 concurrent requests
- Local providers (Ollama, Llama): 1-2 concurrent requests (resource-constrained)

#### 2. Enhanced ChatQueueManager (`src/main/services/chat-queue.manager.ts`)

Updated to delegate to MultiLLMOrchestrator while maintaining backward compatibility:
- Automatically uses orchestrator when provider information is available
- Falls back to legacy queue system for compatibility
- Supports priority-based task scheduling

#### 3. Model Collaboration Service (`src/main/services/model-collaboration.service.ts`)

Enables multiple models to work together on the same task with strategies:
- **Consensus**: Finds common themes across responses
- **Vote**: Majority-based selection
- **Best-of-N**: Quality-scored selection based on latency, tokens, length
- **Chain-of-Thought**: Sequential refinement using one model's output as context

### Usage

#### Running Multiple Models Simultaneously

```typescript
// Each chat can use a different provider/model simultaneously
await window.electron.chat.chatStream(messages1, 'gpt-4', tools, 'openai', {}, chatId1)
await window.electron.chat.chatStream(messages2, 'claude-3-opus', tools, 'anthropic', {}, chatId2)
await window.electron.chat.chatStream(messages3, 'llama2', tools, 'ollama', {}, chatId3)
// All three run in parallel without blocking each other
```

#### Model Collaboration

```typescript
const result = await window.electron.collaboration.run({
    messages: conversationMessages,
    models: [
        { provider: 'openai', model: 'gpt-4' },
        { provider: 'anthropic', model: 'claude-3-opus' },
        { provider: 'groq', model: 'llama-3-70b' }
    ],
    strategy: 'consensus', // or 'vote', 'best-of-n', 'chain-of-thought'
    options: {
        temperature: 0.7,
        maxTokens: 2000
    }
})
```

#### Provider Statistics

```typescript
// Get stats for a specific provider
const stats = await window.electron.collaboration.getProviderStats('openai')
// Returns: { activeTasks, queuedTasks, totalCompleted, totalErrors, averageLatency }

// Get all provider stats
const allStats = await window.electron.collaboration.getProviderStats()
```

#### Configuring Provider Limits

```typescript
await window.electron.collaboration.setProviderConfig('openai', {
    maxConcurrent: 10,      // Max simultaneous requests
    priority: 10,          // Higher = more priority
    rateLimitPerMinute: 60 // Rate limit
})
```

## Responsive UI System

### Components

#### 1. Responsive Utilities (`src/renderer/utils/responsive.ts`)

Hooks and utilities for responsive design:
- `useBreakpoint()`: Get current breakpoint (xs, sm, md, lg, xl, 2xl)
- `useMediaQuery()`: Check media query matches
- `getResponsiveClasses()`: Generate responsive class names

#### 2. Responsive Components (`src/renderer/components/responsive/ResponsiveContainer.tsx`)

- **ResponsiveContainer**: Adapts layout based on screen size
- **ResponsiveGrid**: Grid that adjusts column count per breakpoint
- **TouchTarget**: Ensures 44x44px minimum touch targets (accessibility)

#### 3. Enhanced CSS (`src/renderer/index.css`)

Comprehensive responsive utilities:
- Mobile-first breakpoints (xs: 0-640px, sm: 641-768px, etc.)
- Touch-friendly interactions (hover: none, pointer: coarse)
- Landscape orientation adjustments
- Reduced motion support
- High DPI display optimizations

### Usage

```tsx
import { ResponsiveContainer, ResponsiveGrid } from '@/components/responsive/ResponsiveContainer'
import { useBreakpoint } from '@/utils/responsive'

function MyComponent() {
    const breakpoint = useBreakpoint()
    const isMobile = breakpoint === 'xs' || breakpoint === 'sm'
    
    return (
        <ResponsiveContainer
            mobileClassName="p-2"
            desktopClassName="p-6"
            hideOnMobile={false}
        >
            <ResponsiveGrid
                cols={{ mobile: 1, tablet: 2, desktop: 3 }}
                gap={{ mobile: 'gap-2', tablet: 'gap-4', desktop: 'gap-6' }}
            >
                {/* Grid items */}
            </ResponsiveGrid>
        </ResponsiveContainer>
    )
}
```

## Multi-Model Collaboration UI

### Component: MultiModelCollaboration

Located at `src/renderer/features/chat/components/MultiModelCollaboration.tsx`

Features:
- Select multiple models to run simultaneously
- Choose collaboration strategy
- View individual responses and combined results
- Real-time latency and token usage metrics

### Integration Example

```tsx
import { MultiModelCollaboration } from '@/features/chat/components/MultiModelCollaboration'

function ChatView() {
    const messages = useChatMessages()
    
    return (
        <MultiModelCollaboration
            messages={messages}
            availableModels={[
                { provider: 'openai', model: 'gpt-4', label: 'GPT-4' },
                { provider: 'anthropic', model: 'claude-3-opus', label: 'Claude 3 Opus' },
                { provider: 'groq', model: 'llama-3-70b', label: 'Llama 3 70B' }
            ]}
            onResult={(consensus) => {
                // Use the consensus result
                console.log('Consensus:', consensus)
            }}
        />
    )
}
```

## Architecture Benefits

### 1. True Parallelism
- Multiple LLMs can work simultaneously without blocking
- Provider-specific limits prevent resource exhaustion
- Intelligent queuing ensures optimal throughput

### 2. Resource Management
- Each provider has isolated resource pools
- Rate limiting prevents API quota exhaustion
- Priority-based scheduling ensures important tasks run first

### 3. User Experience
- Responsive design works on all devices (mobile, tablet, desktop)
- Touch-friendly interactions for mobile users
- Adaptive layouts that optimize for screen size
- Multi-model collaboration provides better results

### 4. Scalability
- Easy to add new providers
- Configurable limits per provider
- Statistics tracking for monitoring and optimization

## Next Steps

### Recommended Enhancements

1. **Model Performance Analytics Dashboard**
   - Visualize provider statistics
   - Compare model performance
   - Cost tracking per provider

2. **Advanced Collaboration Strategies**
   - Weighted voting
   - Confidence scoring
   - Specialized model selection (e.g., code vs. creative)

3. **Mobile-Specific Features**
   - Swipe gestures
   - Bottom sheet modals
   - Optimized keyboard interactions

4. **Provider Health Monitoring**
   - Automatic failover
   - Health-based routing
   - Load balancing

## Configuration

### Environment Variables

No additional environment variables required. Configuration is done via IPC:
- `collaboration:setProviderConfig` - Configure provider limits
- Settings UI can expose these controls

### Default Limits

See `MultiLLMOrchestrator.initializeDefaultConfigs()` for default provider configurations. These can be overridden via IPC or settings.

## Troubleshooting

### Multiple LLMs Not Running in Parallel

1. Check provider configuration: `collaboration:getProviderStats()`
2. Verify queue policy: Should be 'parallel' or 'auto'
3. Check rate limits: May be throttling requests

### UI Not Responsive

1. Ensure responsive components are used: `ResponsiveContainer`, `ResponsiveGrid`
2. Check breakpoint detection: `useBreakpoint()` hook
3. Verify CSS utilities are applied: Check `index.css` responsive classes

### Collaboration Not Working

1. Verify models are available: Check `availableModels` prop
2. Check IPC handlers are registered: See `main.ts` registration
3. Review error messages in console
