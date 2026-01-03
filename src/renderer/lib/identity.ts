export interface BrandConfig {
    name: string
    fullName: string
    tagline: string
    description: string
}

export const ZENITH_BRAND: BrandConfig = {
    name: 'ZENITH',
    fullName: 'ZENITH AI Hub & IDE',
    tagline: 'The Summit of Intelligence',
    description: 'A unified AI community hub and interactive development environment orchestrating local and cloud intelligence.'
}

export function getSystemPrompt(language: 'tr' | 'en' = 'tr', persona?: string) {
    const langNote = language === 'tr'
        ? 'CRITICAL: System language is set to TURKISH. You MUST respond in TURKISH regardless of the user\'s input language. Even if asked in English, reply in Turkish to maintain interface consistency.'
        : 'CRITICAL: System language is set to ENGLISH. You MUST respond in ENGLISH regardless of the user\'s input language.'

    const identity = `You are Zenith AI, the intelligent core of ${ZENITH_BRAND.fullName}. 
${ZENITH_BRAND.description}

MISSION:
1. Orchestrate complex model workflows (Local & Cloud).
2. Assist in advanced software engineering within the IDE.
3. Act as a strategic partner for the user.

${langNote}`

    return persona ? `${persona}\n\n${identity}` : identity
}
