import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { DocumentsService } from './documents.service';

@Controller('projects/:projectId/document')
export class ProjectDocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  get(@Param('projectId') projectId: string) {
    return this.documents.getByExternalProjectId(projectId);
  }

  @Put()
  put(@Param('projectId') projectId: string, @Body() document: Record<string, unknown>) {
    return this.documents.upsertByExternalProjectId(projectId, (document ?? {}) as Record<string, unknown>);
  }
}

