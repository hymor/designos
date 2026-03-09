import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';

/** In-memory store (no DB). Key = projectId, value = document JSON. */
const documentStore = new Map<string, Record<string, unknown>>();

@Controller('documents')
export class DocumentsController {
  /** Save document by project id. Body = full document (legacy format). */
  @Post(':id')
  save(@Param('id') id: string, @Body() document: Record<string, unknown>) {
    if (!document || typeof document !== 'object') {
      document = {};
    }
    documentStore.set(id, { ...document });
    return { id, saved: true };
  }

  /** Load document by project id. */
  @Get(':id')
  get(@Param('id') id: string) {
    const doc = documentStore.get(id);
    if (doc === undefined) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return doc;
  }
}
