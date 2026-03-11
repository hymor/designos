import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /** Save document by project id. Body = full document (legacy format). */
  @Post(':id')
  save(@Param('id') id: string, @Body() document: Record<string, unknown>) {
    // Backward-compatible endpoint for current frontend: POST /documents/:id
    return this.documents.upsertByExternalProjectId(id, (document ?? {}) as Record<string, unknown>);
  }

  /** Load document by project id. */
  @Get(':id')
  get(@Param('id') id: string) {
    // Backward-compatible endpoint for current frontend: GET /documents/:id
    return this.documents.getByExternalProjectId(id);
  }
}
