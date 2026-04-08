import { Message, MessageVariant } from '@/types';

import { MessageProps } from './MessageBubble.types';

const MESSAGE_PROP_PRIMITIVE_KEYS: (keyof MessageProps)[] = [
    'isLast',
    'isStreaming',
    'isFocused',
    'backend',
    'language',
    'streamingSpeed',
    'streamingReasoning',
    'id',
];

const MESSAGE_FIELD_KEYS: (keyof Message)[] = [
    'id',
    'role',
    'timestamp',
    'model',
    'provider',
    'isBookmarked',
    'rating',
];

const areJsonEqual = (left: unknown, right: unknown): boolean => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

const areStringArraysEqual = (left: string[] | undefined, right: string[] | undefined): boolean => {
    if (left === right) {
        return true;
    }
    if ((left?.length ?? -1) !== (right?.length ?? -1) || !left || !right) {
        return false;
    }
    for (let index = 0; index < left.length; index++) {
        if (left[index] !== right[index]) {
            return false;
        }
    }
    return true;
};

const areMessageContentsEqual = (
    leftContent: Message['content'],
    rightContent: Message['content']
): boolean => {
    if (typeof leftContent === 'string' && typeof rightContent === 'string') {
        return leftContent === rightContent;
    }
    if (!Array.isArray(leftContent) || !Array.isArray(rightContent)) {
        return false;
    }
    if (leftContent.length !== rightContent.length) {
        return false;
    }

    for (let index = 0; index < leftContent.length; index++) {
        const left = leftContent[index];
        const right = rightContent[index];

        if (left.type !== right.type) {
            return false;
        }
        if (left.type === 'text') {
            if (right.type !== 'text' || left.text !== right.text) {
                return false;
            }
            continue;
        }
        if (
            right.type !== 'image_url' ||
            left.image_url.url !== right.image_url.url ||
            left.image_url.detail !== right.image_url.detail
        ) {
            return false;
        }
    }

    return true;
};

const areMessageVariantsEqual = (
    leftVariants: MessageVariant[] | undefined,
    rightVariants: MessageVariant[] | undefined
): boolean => {
    if (leftVariants === rightVariants) {
        return true;
    }
    if (
        (leftVariants?.length ?? -1) !== (rightVariants?.length ?? -1) ||
        !leftVariants ||
        !rightVariants
    ) {
        return false;
    }

    for (let index = 0; index < leftVariants.length; index++) {
        const left = leftVariants[index];
        const right = rightVariants[index];
        const timestampsMatch =
            left.timestamp instanceof Date && right.timestamp instanceof Date
                ? left.timestamp.getTime() === right.timestamp.getTime()
                : String(left.timestamp) === String(right.timestamp);

        if (
            left.id !== right.id ||
            left.content !== right.content ||
            left.model !== right.model ||
            left.provider !== right.provider ||
            left.label !== right.label ||
            left.status !== right.status ||
            left.error !== right.error ||
            left.isSelected !== right.isSelected ||
            !timestampsMatch
        ) {
            return false;
        }
    }

    return true;
};

export const areMessagePropsEqual = (prev: MessageProps, next: MessageProps): boolean => {
    if (MESSAGE_PROP_PRIMITIVE_KEYS.some(key => prev[key] !== next[key])) {
        return false;
    }

    const previousMessage = prev.message;
    const nextMessage = next.message;
    if (previousMessage === nextMessage) {
        return true;
    }

    if (MESSAGE_FIELD_KEYS.some(key => previousMessage[key] !== nextMessage[key])) {
        return false;
    }

    if (!areMessageContentsEqual(previousMessage.content, nextMessage.content)) {
        return false;
    }

    if (
        !areStringArraysEqual(previousMessage.images, nextMessage.images) ||
        !areStringArraysEqual(previousMessage.sources, nextMessage.sources) ||
        !areStringArraysEqual(previousMessage.reactions, nextMessage.reactions) ||
        !areStringArraysEqual(previousMessage.reasonings, nextMessage.reasonings)
    ) {
        return false;
    }

    if (
        previousMessage.reasoning !== nextMessage.reasoning
        || !areJsonEqual(previousMessage.toolCalls, nextMessage.toolCalls)
        || !areJsonEqual(previousMessage.toolResults, nextMessage.toolResults)
        || !areJsonEqual(previousMessage.usage, nextMessage.usage)
    ) {
        return false;
    }

    if (JSON.stringify(previousMessage.metadata ?? {}) !== JSON.stringify(nextMessage.metadata ?? {})) {
        return false;
    }

    if (JSON.stringify(prev.footerConfig ?? {}) !== JSON.stringify(next.footerConfig ?? {})) {
        return false;
    }

    return areMessageVariantsEqual(previousMessage.variants, nextMessage.variants);
};
