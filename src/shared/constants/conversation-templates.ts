/**
 * Conversation starter template definitions.
 * Translation keys reference `templates.<id>.title`, `templates.<id>.description`, `templates.<id>.prompt`.
 */

/** Static metadata for a conversation starter template */
export interface ConversationTemplateDefinition {
  readonly id: string
  readonly icon: string
  readonly iconColor: string
  readonly translationKey: string
  readonly systemPrompt?: string
}

/** Built-in conversation starter templates */
export const CONVERSATION_TEMPLATES: readonly ConversationTemplateDefinition[] = [
  {
    id: 'code',
    icon: 'Code',
    iconColor: 'text-primary',
    translationKey: 'code',
  },
  {
    id: 'analyze',
    icon: 'FileSearch',
    iconColor: 'text-success',
    translationKey: 'analyze',
  },
  {
    id: 'creative',
    icon: 'Sparkles',
    iconColor: 'text-purple',
    translationKey: 'creative',
  },
  {
    id: 'debug',
    icon: 'Bug',
    iconColor: 'text-destructive',
    translationKey: 'debug',
  },
  {
    id: 'codeReview',
    icon: 'GitPullRequestDraft',
    iconColor: 'text-warning',
    translationKey: 'codeReview',
    systemPrompt: 'You are an expert code reviewer. Focus on bugs, performance issues, security vulnerabilities, and best practices.',
  },
  {
    id: 'architecture',
    icon: 'LayoutDashboard',
    iconColor: 'text-info',
    translationKey: 'architecture',
    systemPrompt: 'You are a software architect. Help design scalable, maintainable system architectures with clear component boundaries.',
  },
  {
    id: 'refactoring',
    icon: 'RefreshCw',
    iconColor: 'text-orange',
    translationKey: 'refactoring',
    systemPrompt: 'You are a refactoring expert. Improve code readability, reduce complexity, and apply design patterns.',
  },
  {
    id: 'documentation',
    icon: 'FileText',
    iconColor: 'text-teal',
    translationKey: 'documentation',
    systemPrompt: 'You are a technical writer. Create clear, comprehensive documentation with examples.',
  },
  {
    id: 'learning',
    icon: 'GraduationCap',
    iconColor: 'text-indigo',
    translationKey: 'learning',
    systemPrompt: 'You are a patient teacher. Explain concepts clearly with examples, analogies, and step-by-step breakdowns.',
  },
] as const;
