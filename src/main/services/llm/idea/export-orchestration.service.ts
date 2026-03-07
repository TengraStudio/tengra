import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { ProjectScaffoldService } from '@main/services/project/project-scaffold.service';
import { ProjectIdea } from '@shared/types/ideas';
import { Workspace } from '@shared/types/workspace';

interface ExportIdeaToWorkspaceOptions {
    ideaId: string;
    idea: ProjectIdea;
    workspacePath: string;
}

export class IdeaExportOrchestrationService extends BaseService {
    constructor(
        private readonly projectScaffoldService: ProjectScaffoldService,
        private readonly databaseService: DatabaseService
    ) {
        super('IdeaExportOrchestrationService');
    }

    async exportIdeaToWorkspace(options: ExportIdeaToWorkspaceOptions): Promise<Workspace> {
        await this.projectScaffoldService.scaffoldProject(options.idea, options.workspacePath);

        const workspace = await this.databaseService.createWorkspace(
            options.idea.title,
            options.workspacePath,
            options.idea.description
        );

        const db = this.databaseService.getDatabase();
        await db
            .prepare('UPDATE project_ideas SET status = ?, project_id = ?, updated_at = ? WHERE id = ?')
            .run('approved', workspace.id, Date.now(), options.ideaId);

        return workspace;
    }
}
