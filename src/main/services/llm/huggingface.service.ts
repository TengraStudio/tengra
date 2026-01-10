import axios from 'axios'
import { getErrorMessage } from '../../../shared/utils/error.util'

interface HFApiModel {
    modelId: string;
    author: string;
    cardData?: { short_description?: string };
    downloads?: number;
    likes?: number;
    tags?: string[];
    lastModified: string;
}

interface HFFileInfo {
    path: string;
    size: number;
    oid?: string;
    lfs?: { oid?: string };
}

export interface HFModel {
    id: string
    name: string
    description: string
    author: string
    downloads: number
    likes: number
    tags: string[]
    lastModified: string
}

export interface HFModelFile {
    path: string;
    size: number;
    oid: string | undefined;
    quantization: string;
}

export class HuggingFaceService {
    async searchModels(query: string = '', limit: number = 20, page: number = 0): Promise<HFModel[]> {
        try {
            const searchQuery = query ? `${query} GGUF` : 'GGUF'
            const response = await axios.get('https://huggingface.co/api/models', {
                params: {
                    search: searchQuery,
                    limit,
                    full: true,
                    config: true,
                    sort: 'downloads',
                    direction: -1,
                    offset: page * limit
                }
            })

            return (response.data as HFApiModel[]).map((m) => ({
                id: m.modelId,
                name: m.modelId.split('/')[1] || m.modelId,
                author: m.author,
                description: m.cardData?.short_description || `A high-quality model by ${m.author}`,
                downloads: m.downloads || 0,
                likes: m.likes || 0,
                tags: m.tags || [],
                lastModified: m.lastModified
            }))
        } catch (error) {
            console.error('Failed to fetch models from HuggingFace:', getErrorMessage(error as Error))
            return []
        }
    }
    async getModelFiles(modelId: string): Promise<HFModelFile[]> {
        try {
            const response = await axios.get(`https://huggingface.co/api/models/${modelId}/tree/main`, {
                params: { recursive: true }
            })

            return (response.data as HFFileInfo[])
                .filter((f) => f.path.endsWith('.gguf'))
                .map((f) => ({
                    path: f.path,
                    size: f.size,
                    oid: f.lfs?.oid || f.oid, // SHA256 usually in lfs.oid
                    quantization: this.extractQuantization(f.path)
                }))
        } catch (error) {
            console.error(`Failed to fetch files for ${modelId}:`, getErrorMessage(error as Error))
            return []
        }
    }

    private extractQuantization(filename: string): string {
        const match = filename.match(/(Q[0-9]+_[A-Z0-9_]+|f16|f32)/i)
        return match ? match[0].toUpperCase() : 'UNKNOWN'
    }

    async downloadFile(
        url: string,
        outputPath: string,
        expectedSize: number,
        expectedSha256: string,
        onProgress?: (received: number, total: number) => void
    ): Promise<{ success: boolean; error?: string }> {
        const fs = await import('fs')
        const { pipeline } = await import('stream/promises')

        try {
            // Check for existing partial file
            let start = 0
            if (fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath)
                start = stats.size
                if (start === expectedSize) {
                    // Already filtered, maybe verify hash?
                    console.log('File already exists with correct size, verifying hash...')
                    const valid = await this.verifyHash(outputPath, expectedSha256)
                    if (valid) return { success: true }
                    // If invalid, restart or resume? For safety, if full size but invalid, restart.
                    console.warn('File exists but hash mismatch, restarting download.')
                    start = 0
                }
            }

            const response = await axios.get(url, {
                responseType: 'stream',
                headers: start > 0 ? { Range: `bytes=${start}-` } : {}
            })

            const fileStream = fs.createWriteStream(outputPath, { flags: start > 0 ? 'a' : 'w' })
            const total = parseInt(response.headers['content-length'] || '0', 10) + start

            let received = start
            response.data.on('data', (chunk: Buffer) => {
                received += chunk.length
                onProgress?.(received, total)
            })

            await pipeline(response.data, fileStream)

            // Verify Hash
            const isValid = await this.verifyHash(outputPath, expectedSha256)
            if (!isValid) {
                return { success: false, error: 'Hash verification failed' }
            }

            return { success: true }

        } catch (error) {
            console.error('Download failed:', getErrorMessage(error as Error))
            return { success: false, error: getErrorMessage(error as Error) }
        }
    }

    private async verifyHash(filePath: string, expectedSha256: string): Promise<boolean> {
        if (!expectedSha256) return true // No hash provided to verify
        const fs = await import('fs')
        const { createHash } = await import('crypto')

        return new Promise((resolve, reject) => {
            const hash = createHash('sha256')
            const stream = fs.createReadStream(filePath)
            stream.on('error', reject)
            stream.on('data', chunk => hash.update(chunk))
            stream.on('end', () => resolve(hash.digest('hex') === expectedSha256))
        })
    }
}
