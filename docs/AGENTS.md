# Agents Architecture & Best Practices

This document outlines the agent architecture, prompting strategies, and best practices for implementing AI agents in Orbit.

## Internal Audit Mechanism for Agents

> **Key Insight**: Implementing an internal audit mechanism in agent prompts can reduce errors to near zero.

### What is an Internal Audit Mechanism?

An internal audit mechanism is a self-checking pattern where the agent is instructed to:

1. **Create a TODO list** of planned actions before execution
2. **Create a checklist** for each TODO item with critical/evaluative questions asking "Is there a better way?"
3. **Review both lists after each action** - don't mark items as "done" unless they pass the audit
4. **Self-critique** by questioning decisions: "Why did I do it this way? Could it have been done differently?"

### Implementation in Prompts

```
Before executing any task:
1. Prepare your planned actions as a TODO list
2. For each TODO item, create a checklist that evaluates it critically:
   - Is this the best approach?
   - Are there alternatives?
   - What could go wrong?
3. After completing each item, review both the TODO and its checklist
4. Do NOT mark an item as "done" unless it passes the audit
5. If the audit fails, revise the approach before proceeding
```

### Benefits

- **Error prevention**: The model catches its own mistakes before they propagate
- **Better decision making**: Forces consideration of alternatives
- **Self-improvement**: Creates a feedback loop for continuous refinement
- **Transparency**: The reasoning process becomes visible and auditable

### Example Prompt Structure

```markdown
You are an AI agent. Before taking any action:

## Planning Phase
1. Create a TODO list of steps needed to complete the task
2. For each TODO item, add a verification checklist:
   - [ ] Is this necessary?
   - [ ] Is there a simpler approach?
   - [ ] What are the potential issues?

## Execution Phase
1. Execute step 1
2. Review against checklist
3. If checklist passes → mark done, proceed
4. If checklist fails → revise approach, do not proceed

## Self-Critique
After each step, ask yourself:
- "Why did I do it this way?"
- "Could this have been done better?"

Never mark a step complete unless it passes internal audit.
```

---

## Agent Types in Orbit

### 1. Planner Agent
- Decomposes high-level requests into actionable steps
- Creates structured task lists
- Identifies dependencies between steps

### 2. Executor Agent
- Executes individual steps from the plan
- Has access to tools (file operations, commands, etc.)
- Reports results back to the planner

### 3. Critic Agent
- Reviews executed steps
- Validates outputs against expectations
- Suggests improvements

### 4. Memory Agent
- Manages long-term context
- Extracts and stores relevant facts
- Provides historical context for decisions

---

## Best Practices

1. **Always use structured outputs** - JSON for tool calls, markdown for plans
2. **Implement retry logic** - Agents can make mistakes, allow corrections
3. **Log all decisions** - Transparency helps debugging
4. **Use temperature wisely** - Lower for deterministic tasks, higher for creative ones
5. **Validate tool results** - Don't assume success, check outputs
