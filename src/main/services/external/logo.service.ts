import { promises as fs } from 'fs';
import { join } from 'path';

import { appLogger } from '@main/logging/logger'
import { LLMService } from '@main/services/llm/llm.service';
import { ProjectService } from '@main/services/project/project.service';
import { JsonObject } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';

export class LogoService {
    constructor(private llmService: LLMService, private projectService: ProjectService) { }

    private getStylePrompt(style: string): string {
        const styles: Record<string, string> = {
            'Minimalist': 'minimalist, vector art, flat design, simple shapes, monochrome or duotone, clean lines, professional app icon',
            'Cyberpunk': 'cyberpunk, neon lights, futuristic, high contrast, glowing effects, grid background, dark mode aesthetic',
            'Abstract': 'abstract geometry, mathematical shapes, fluid forms, creative composition, artistic, modern art',
            'Retro': 'retro pixel art, 8-bit style, nostalgic, vibrant colors, blocky, arcade game aesthetic',
            'Modern gradient': 'modern gradient, fluid colors, glassmorphism, 3d render, glossy finish, high end tech startup'
        };
        return styles[style] || style;
    }

    async analyzeProjectIdentity(projectPath: string): Promise<{ suggestedPrompts: string[], colors: string[] }> {
        let pkgData: JsonObject = {};
        try {
            const pkgPath = join(projectPath, 'package.json');
            const content = await fs.readFile(pkgPath, 'utf-8');
            pkgData = safeJsonParse<JsonObject>(content, {});
        } catch {
            console.warn(`[LogoService] No package.json found at ${projectPath}`);
        }

        // Deep Analysis
        const analysis = await this.projectService.analyzeProject(projectPath);

        const context = `
Project Name: ${pkgData.name || projectPath.split(/[\\/]/).pop() || 'Untitled'}
Description: ${pkgData.description || analysis.type + ' project'}
Type: ${analysis.type}
Frameworks: ${analysis.frameworks.join(', ')}
Main Languages: ${Object.keys(analysis.languages).join(', ')}
Stats: ${analysis.stats.fileCount} files, ~${analysis.stats.loc} lines of code
Dependencies: ${Object.keys(analysis.dependencies).slice(0, 8).join(', ')}
`;

        const analysisPrompt = `Analyze this project metadata and suggest 3 creative, short concepts for an app icon/logo mascot. 
The concepts should be optimized for an AI image generator like DALL-E or Flux.
Each concept should be a single sentence description.
Also suggest a professional color palette (3-5 hex colors) that fits the project vibe. 
Consider standard tech branding (e.g., Python: Blue/Yellow, Node: Green/Lime, React: Cyan, Typescript: Blue).

Return JSON only: { "concepts": ["concept 1", "concept 2", "concept 3"], "colors": ["#hex1", "#hex2", "#hex3"] }

Project Info:
${context}`;

        try {
            const response = await this.llmService.chat([
                { role: 'user', content: analysisPrompt }
            ], 'antigravity-3.5-sonnet', [], 'antigravity');

            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = safeJsonParse<JsonObject>(jsonMatch[0], {});
                return {
                    suggestedPrompts: (data.concepts as string[]) ?? [],
                    colors: (data.colors as string[]) ?? []
                };
            }
        } catch (error) {
            console.error('[LogoService] Identity analysis failed:', error);
        }

        return {
            suggestedPrompts: [`Professional modern logo for a ${analysis.type} project`],
            colors: ['#4F46E5', '#06B6D4', '#10B981']
        };
    }

    async improveLogoPrompt(prompt: string): Promise<string> {
        const improvementPrompt = `You are a creative brand designer. Expand and improve the following logo description into a detailed, high-quality prompt for an AI image generator (like Flux or DALL-E). 
        Focus on artistic style, lighting, composition, and professional aesthetics. Keep it to 2-3 sentences.
        Original Idea: ${prompt}
        Improved Prompt:`;

        try {
            const response = await this.llmService.chat([
                { role: 'user', content: improvementPrompt }
            ], 'llama3', [], 'ollama'); // Using llama3 on Ollama as a safe default

            return response.content.trim();
        } catch (error) {
            console.error('[LogoService] Prompt improvement failed:', error);
            return prompt; // Fallback to original
        }
    }

    async generateLogo(projectPath: string, prompt: string, style: string): Promise<string> {
        appLogger.info('logo.service', `[LogoService] Generating logo for ${projectPath} with prompt: "${prompt}" and style: "${style}"`);

        const styleKeywords = this.getStylePrompt(style);

        // Construct a better prompt optimized for DALL-E 3 / Flux
        const enhancedPrompt = `Design a professional app icon for a project. 
        Core Concept: ${prompt}
        Visual Style: ${styleKeywords}
        Constraints: Square aspect ratio, centered composition, high quality vector style, solid background, avoid text, avoid complex details, minimalist aesthetic, sharp edges.`;

        try {
            const response = await this.llmService.chat([
                { role: 'user', content: enhancedPrompt }
            ], 'antigravity-gemini-3-pro-image', [], 'antigravity'); // Updated as per user request

            if (response.images && response.images.length > 0) {
                const tempPath = response.images[0];
                const targetDir = join(projectPath, '.orbit', 'temp');
                const timestamp = Date.now();
                const targetPath = join(targetDir, `logo-${timestamp}.png`);

                await fs.mkdir(targetDir, { recursive: true });
                await fs.copyFile(tempPath, targetPath);

                return targetPath;
            }

            throw new Error('No image generated by the model.');

        } catch (error) {
            console.error('[LogoService] Generation failed:', error);
            throw error;
        }
    }

    async applyLogo(projectPath: string, tempLogoPath: string): Promise<string> {
        try {
            const orbitDir = join(projectPath, '.orbit');
            await fs.mkdir(orbitDir, { recursive: true });

            const targetPath = join(orbitDir, 'logo.png');
            await fs.copyFile(tempLogoPath, targetPath);

            // Also try to save as icon.png in public if it exists (common for web apps)
            const publicDir = join(projectPath, 'public');
            try {
                const publicStats = await fs.stat(publicDir);
                if (publicStats.isDirectory()) {
                    await fs.copyFile(tempLogoPath, join(publicDir, 'icon.png'));
                    await fs.copyFile(tempLogoPath, join(publicDir, 'favicon.png'));
                }
            } catch {
                // Ignore if public dir doesn't exist
            }

            return targetPath;
        } catch (error) {
            console.error('[LogoService] Apply logo failed:', error);
            throw error;
        }
    }

    async getCompletion(text: string) {
        const prompt = `You are an expert programmer. Complete the following code snippet. 
Provide ONLY the completion text, no explanation, no markdown blocks.
Context:
${text}`;

        const response = await this.llmService.chat([
            { role: 'user', content: prompt }
        ], 'antigravity-flux-schnell', [], 'antigravity');
        return response.content;
    }
}
