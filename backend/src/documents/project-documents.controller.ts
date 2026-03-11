import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('projects/:projectId/document')
export class ProjectDocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  get(@Req() _req: Request, @Param('projectId') projectId: string) {
    return this.documents.getByExternalProjectId(projectId);
  }

  @UseGuards(JwtAuthGuard)
  @Put()
  put(
    @Req() _req: Request,
    @Param('projectId') projectId: string,
    @Body() document: Record<string, unknown>,
  ) {
    return this.documents.upsertByExternalProjectId(projectId, (document ?? {}) as Record<string, unknown>);
  }
}

