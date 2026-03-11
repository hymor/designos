import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function encodeProjectId(dbId: number): string {
  return `p-${dbId}`;
}

function decodeProjectId(externalId: string): number {
  const m = /^p-(\d+)$/.exec(String(externalId || '').trim());
  if (!m) throw new BadRequestException('Invalid projectId');
  const n = Number(m[1]);
  if (!Number.isFinite(n)) throw new BadRequestException('Invalid projectId');
  return n;
}

function minimalEmptyDocument(projId: string, projName: string): Record<string, unknown> {
  return {
    version: 8,
    projId,
    projName,
    nid: 1,
    frames: [],
    els: [],
    groups: [],
    components: [],
    rootOrder: [],
    view: { zoom: 1, px: 0, py: 0 },
  };
}

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getByExternalProjectId(externalProjectId: string): Promise<Record<string, unknown>> {
    const projectId = decodeProjectId(externalProjectId);
    const doc = await this.prisma.document.findUnique({
      where: { projectId },
      select: { jsonData: true },
    });
    if (!doc) {
      throw new NotFoundException(`Document ${externalProjectId} not found`);
    }
    return doc.jsonData as unknown as Record<string, unknown>;
  }

  async upsertByExternalProjectId(
    externalProjectId: string,
    jsonData: Record<string, unknown>,
  ): Promise<{ id: string; saved: true }> {
    const projectId = decodeProjectId(externalProjectId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${externalProjectId} not found`);
    }

    const version =
      jsonData && typeof (jsonData as any).version === 'number' ? (jsonData as any).version : 8;
    const nextNameRaw =
      jsonData && typeof (jsonData as any).projName === 'string'
        ? ((jsonData as any).projName as string)
        : project.name || 'Untitled';
    const nextName = nextNameRaw.trim() || 'Untitled';

    await this.prisma.$transaction(async (tx) => {
      await tx.document.upsert({
        where: { projectId: project.id },
        create: {
          projectId: project.id,
          version,
          jsonData:
            jsonData && typeof jsonData === 'object'
              ? (jsonData as unknown as Prisma.InputJsonValue)
              : (minimalEmptyDocument(encodeProjectId(project.id), nextName) as unknown as Prisma.InputJsonValue),
        },
        update: {
          version,
          jsonData: (jsonData as unknown as Prisma.InputJsonValue),
        },
        select: { id: true },
      });

      // Ensure project.updatedAt and name reflect latest document (projName).
      await tx.project.update({
        where: { id: project.id },
        data: { updatedAt: new Date(), name: nextName },
        select: { id: true, name: true },
      });
    });

    return { id: externalProjectId, saved: true };
  }
}

