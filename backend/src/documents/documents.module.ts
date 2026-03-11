import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { ProjectDocumentsController } from './project-documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  controllers: [DocumentsController, ProjectDocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
