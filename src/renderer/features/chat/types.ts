export interface ChatTemplate {
    id: string;
    icon: string;
    iconColor: string;
    title: string;
    description: string;
    prompt?: string;
    systemPrompt?: string;
}
