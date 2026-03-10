import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { DocumentStoreService } from './document-store.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly store: DocumentStoreService) {}

  /** Save document by project id. Body = full document (legacy format). */
  @Post(':id')
  save(@Param('id') id: string, @Body() document: Record<string, unknown>) {
    this.store.set(id, document ?? {});
    return { id, saved: true };
  }

  /** Load document by project id. */
  @Get(':id')
  get(@Param('id') id: string) {
    const doc = this.store.get(id);
    if (doc === undefined) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return doc;
  }
}
