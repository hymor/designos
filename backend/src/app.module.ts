import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [PrismaModule, HealthModule, ProjectsModule, DocumentsModule],
})
export class AppModule {}
