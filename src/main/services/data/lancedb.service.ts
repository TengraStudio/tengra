import { DataService } from './data.service'
import { JsonObject, JsonValue } from '../../../shared/types/common'

export interface AgentRecord {
    id: string
    name: string
    system_prompt: string
    tools: string[]
    parent_model: string
    [key: string]: JsonValue | undefined
}

type LanceTable = {
    query: () => {
        where: (_clause: string) => {
            limit: (_n: number) => {
                toArray: () => Promise<JsonObject[]>
            }
            toArray: () => Promise<JsonObject[]>
        }
        toArray: () => Promise<JsonObject[]>
    }
    add: (_records: JsonObject[]) => Promise<void>
    delete: (_clause: string) => Promise<void>
}

export class LanceDbService {
    constructor(_dataService: DataService) { }

    async getTable(_name: string): Promise<LanceTable> {
        return {
            query: () => ({
                where: (_clause: string) => ({
                    limit: (_n: number) => ({
                        toArray: async (): Promise<JsonObject[]> => []
                    }),
                    toArray: async (): Promise<JsonObject[]> => []
                }),
                toArray: async (): Promise<JsonObject[]> => []
            }),
            add: async (_records: JsonObject[]) => { },
            delete: async (_clause: string) => { }
        }
    }
}
