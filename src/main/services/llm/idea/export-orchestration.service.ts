import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { WorkspaceScaffoldService } from '@main/services/workspace/workspace-scaffold.service';
import { WORKSPACE_COMPAT_SCHEMA_VALUES } from '@shared/constants';
import { WorkspaceIdea } from '@shared/types/ideas';
import { Workspace } from '@shared/types/workspace';

const WORKSPACE_COMPAT_ID_COLUMN = WORKSPACE_COMPAT_SCHEMA_VALUES.ID_COLUMN;
const WORKSPACE_COMPAT_IDEAS_TABLE = WORKSPACE_COMPAT_SCHEMA_VALUES.IDEAS_TABLE;

interface ExportIdeaToWorkspaceOptions {
    ideaId: string;
    idea: WorkspaceIdea;
    workspacePath: string;
}

export class IdeaExportOrchestrationService extends BaseService {
    constructor(
        private readonly workspaceScaffoldService: WorkspaceScaffoldService,
        private readonly databaseService: DatabaseService
    ) {
        super('IdeaExportOrchestrationService');
    }

    async exportIdeaToWorkspace(options: ExportIdeaToWorkspaceOptions): Promise<Workspace> {
        await this.workspaceScaffoldService.scaffoldWorkspace(options.idea, options.workspacePath);

        const workspace = await this.databaseService.createWorkspace(
            options.idea.title,
            options.workspacePath,
            options.idea.description
        );

        const db = this.databaseService.getDatabase();
        await db
            .prepare(`UPDATE ${WORKSPACE_COMPAT_IDEAS_TABLE} SET status = ?, ${WORKSPACE_COMPAT_ID_COLUMN} = ?, updated_at = ? WHERE id = ?`)
            .run('approved', workspace.id, Date.now(), options.ideaId);

        return workspace;
    }
}
