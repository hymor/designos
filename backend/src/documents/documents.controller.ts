import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { EditorDocumentDto } from '../common/dto/document.dto';
import { SaveDocumentDto } from './dto/save-document.dto';

@Controller('documents')
export class DocumentsController {
  @Get()
  list() {
    return { items: [], total: 0 };
  }

  @Post()
  save(@Body() dto: SaveDocumentDto) {
    const doc = dto.document ?? ({} as EditorDocumentDto);
    return {
      id: doc.id ?? `doc-${Date.now()}`,
      name: doc.name ?? 'Untitled',
      saved: true,
    };
  }

  @Get(':id')
  get(@Param('id') id: string) {
    const doc: EditorDocumentDto = {
      id,
      name: 'Untitled',
      pages: [],
      activePageId: null,
    };
    return doc;
  }
}
