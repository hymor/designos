import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ProjectItem {
  id: string;
  name?: string;
  updatedAt?: Date;
}

export interface ListProjectsResult {
  items: ProjectItem[];
  total: number;
}

export interface CreateProjectResult {
  id: string;
  name: string;
}

function encodeProjectId(dbId: number): string {
  return `p-${dbId}`;
}

function decodeProjectId(externalId: string): number | null {
  const m = /^p-(\d+)$/.exec(String(externalId || '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Minimal document shape accepted by legacy getDocument/loadDocument. */
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

/**
 * Projects service backed by Prisma/Postgres.
 * Keeps external id format "p-<number>" to avoid breaking current frontend routing/API.
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: number): Promise<ListProjectsResult> {
    const projects = await this.prisma.project.findMany({
      where: { ownerUserId: userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, updatedAt: true },
    });
    const items: ProjectItem[] = projects.map((p) => ({
      id: encodeProjectId(p.id),
      name: p.name,
      updatedAt: p.updatedAt,
    }));
    return { items, total: items.length };
  }

  async createForUser(userId: number, name?: string): Promise<CreateProjectResult> {
    const displayName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : 'Untitled';

    const created = await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: { ownerUserId: userId, name: displayName },
        select: { id: true, name: true },
      });
      const externalId = encodeProjectId(project.id);
      await tx.document.create({
        data: {
          projectId: project.id,
          version: 8,
          jsonData: minimalEmptyDocument(externalId, project.name) as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      return { project, externalId };
    });

    return { id: created.externalId, name: created.project.name };
  }
}
