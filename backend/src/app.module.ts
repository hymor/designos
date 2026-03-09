import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { ProjectsModule } from './projects/projects.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [HealthModule, ProjectsModule, DocumentsModule],
})
export class AppModule {}
