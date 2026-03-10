import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentStoreService } from './document-store.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentStoreService],
  exports: [DocumentStoreService],
})
export class DocumentsModule {}
