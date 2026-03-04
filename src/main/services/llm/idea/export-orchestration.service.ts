import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { ProjectScaffoldService } from '@main/services/project/project-scaffold.service';
import { ProjectIdea } from '@shared/types/ideas';
import { Project } from '@shared/types/project';

interface ExportIdeaToProjectOptions {
    ideaId: string;
    idea: ProjectIdea;
    projectPath: string;
}

export class IdeaExportOrchestrationService extends BaseService {
    constructor(
        private readonly projectScaffoldService: ProjectScaffoldService,
        private readonly databaseService: DatabaseService
    ) {
        super('IdeaExportOrchestrationService');
    }

    async exportIdeaToProject(options: ExportIdeaToProjectOptions): Promise<Project> {
        await this.projectScaffoldService.scaffoldProject(options.idea, options.projectPath);

        const project = await this.databaseService.createProject(
            options.idea.title,
            options.projectPath,
            options.idea.description
        );

        const db = this.databaseService.getDatabase();
        await db
            .prepare('UPDATE project_ideas SET status = ?, project_id = ?, updated_at = ? WHERE id = ?')
            .run('approved', project.id, Date.now(), options.ideaId);

        return project;
    }
}
