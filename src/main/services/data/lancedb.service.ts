import { DataService } from './data.service'

export interface AgentRecord {
    id: string
    name: string
    system_prompt: string
    tools: string[]
    parent_model: string
    [key: string]: any
}

export class LanceDbService {
    constructor(_dataService: DataService) { }

    async getTable(_name: string) {
        return {
            query: () => ({
                where: (_clause: string) => ({
                    limit: (_n: number) => ({
                        toArray: async (): Promise<any[]> => []
                    }),
                    toArray: async (): Promise<any[]> => []
                }),
                toArray: async (): Promise<any[]> => []
            }),
            add: async (_records: any[]) => { },
            delete: async (_clause: string) => { }
        }
    }
}
