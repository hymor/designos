import { Injectable } from '@nestjs/common';
import { DocumentStoreService } from '../documents/document-store.service';

export interface ProjectItem {
  id: string;
  name?: string;
}

export interface ListProjectsResult {
  items: ProjectItem[];
  total: number;
}

export interface CreateProjectResult {
  id: string;
  name: string;
}

/** Minimal document shape accepted by legacy loadProject. */
function minimalDocument(projName: string): Record<string, unknown> {
  return {
    frames: [],
    els: [],
    nid: 1,
    components: [],
    projName,
  };
}

function projectName(doc: Record<string, unknown>): string {
  const name = doc?.projName ?? doc?.name;
  return typeof name === 'string' && name.length > 0 ? name : 'Untitled';
}

/**
 * Projects service (variant 3: list from document store, create writes minimal doc).
 * Later can be replaced by DB-backed implementation without changing controller or API.
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly documentStore: DocumentStoreService) {}

  list(): ListProjectsResult {
    const entries = this.documentStore.entries();
    const items: ProjectItem[] = entries.map(([id, doc]) => ({
      id,
      name: projectName(doc),
    }));
    return { items, total: items.length };
  }

  create(name?: string): CreateProjectResult {
    const displayName = typeof name === 'string' && name.length > 0 ? name : 'Untitled';
    const id = `p-${Date.now()}`;
    this.documentStore.set(id, minimalDocument(displayName));
    return { id, name: displayName };
  }
}
