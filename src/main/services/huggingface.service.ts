import axios from 'axios'

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

            return response.data.map((m: any) => ({
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
            console.error('Failed to fetch models from HuggingFace:', error)
            return []
        }
    }
}
