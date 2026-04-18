/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/** Conversation template definition for starting new chats with predefined context */
export interface ConversationTemplate {
    id: string
    name: string
    description: string
    icon: string
    category: 'development' | 'documentation' | 'testing' | 'architecture' | 'review'
    systemPrompt: string
    starterMessage: string
}

/** Built-in conversation templates for common AI-assisted workflows */
export const CONVERSATION_TEMPLATES: ConversationTemplate[] = [
    {
        id: 'code-review',
        name: 'conversationTemplates.codeReview.name',
        description: 'conversationTemplates.codeReview.description',
        icon: '🔍',
        category: 'review',
        systemPrompt:
            'You are an expert code reviewer. Analyze code for bugs, performance issues, security vulnerabilities, and style improvements. Provide specific, actionable feedback with code examples.',
        starterMessage: 'conversationTemplates.codeReview.starter',
    },
    {
        id: 'debug-session',
        name: 'conversationTemplates.debugSession.name',
        description: 'conversationTemplates.debugSession.description',
        icon: '🐛',
        category: 'development',
        systemPrompt:
            'You are an expert debugger. Help the user identify and fix bugs step by step. Ask clarifying questions about the error, suggest debugging strategies, and provide fixes with explanations.',
        starterMessage: 'conversationTemplates.debugSession.starter',
    },
    {
        id: 'architecture-discussion',
        name: 'conversationTemplates.architecture.name',
        description: 'conversationTemplates.architecture.description',
        icon: '🏗️',
        category: 'architecture',
        systemPrompt:
            'You are a software architect. Discuss system design, patterns, trade-offs, and best practices. Help plan scalable, maintainable architectures with clear diagrams and explanations.',
        starterMessage: 'conversationTemplates.architecture.starter',
    },
    {
        id: 'documentation-writer',
        name: 'conversationTemplates.documentation.name',
        description: 'conversationTemplates.documentation.description',
        icon: '📝',
        category: 'documentation',
        systemPrompt:
            'You are a technical documentation expert. Write clear, comprehensive documentation including API references, guides, and README files. Follow best practices for developer documentation.',
        starterMessage: 'conversationTemplates.documentation.starter',
    },
    {
        id: 'test-generator',
        name: 'conversationTemplates.testGenerator.name',
        description: 'conversationTemplates.testGenerator.description',
        icon: '🧪',
        category: 'testing',
        systemPrompt:
            'You are a testing expert. Generate comprehensive test suites including unit tests, integration tests, and edge cases. Use appropriate testing frameworks and follow testing best practices.',
        starterMessage: 'conversationTemplates.testGenerator.starter',
    },
    {
        id: 'refactoring-guide',
        name: 'conversationTemplates.refactoring.name',
        description: 'conversationTemplates.refactoring.description',
        icon: '♻️',
        category: 'development',
        systemPrompt:
            'You are a refactoring expert. Help improve code quality through systematic refactoring. Identify code smells, suggest patterns, and guide step-by-step transformations while preserving behavior.',
        starterMessage: 'conversationTemplates.refactoring.starter',
    },
];
