import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

/** Safe filename: id to file name (no path separators, no special chars). */
function idToFilename(id: string): string {
  return id.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.json';
}

/**
 * Document store with file persistence.
 * Documents are saved as data/<id>.json so they survive backend restart.
 */
@Injectable()
export class DocumentStoreService implements OnModuleInit {
  private readonly store = new Map<string, Record<string, unknown>>();

  onModuleInit(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      return;
    }
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(DATA_DIR, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const doc = JSON.parse(raw) as Record<string, unknown>;
        const id = path.basename(file, '.json');
        this.store.set(id, doc);
      } catch {
        // skip invalid files
      }
    }
  }

  set(id: string, document: Record<string, unknown>): void {
    if (!document || typeof document !== 'object') {
      document = {};
    }
    const copy = { ...document };
    this.store.set(id, copy);
    const filePath = path.join(DATA_DIR, idToFilename(id));
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(copy), 'utf-8');
    } catch (err) {
      console.warn('[DocumentStore] write failed for', id, err);
    }
  }

  get(id: string): Record<string, unknown> | undefined {
    return this.store.get(id);
  }

  has(id: string): boolean {
    return this.store.has(id);
  }

  /** All entries [id, doc] for listing. */
  entries(): Array<[string, Record<string, unknown>]> {
    return Array.from(this.store.entries());
  }
}
