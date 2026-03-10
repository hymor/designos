import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { EditorDocument } from './editor-facade.service';

/** Backend API base (Nest runs on port 3000 with global prefix 'api'). */
const API_BASE = 'http://localhost:3000/api';

/**
 * API service for document save/load with the backend.
 * POST /api/documents/:id — save document
 * GET /api/documents/:id — load document
 */
@Injectable({
  providedIn: 'root',
})
export class EditorApiService {
  constructor(private readonly http: HttpClient) {}

  listProjects(): Observable<{ items: Array<{ id: string; name?: string }>; total: number }> {
    return this.http.get<{ items: Array<{ id: string; name?: string }>; total: number }>(`${API_BASE}/projects`);
  }

  createProject(name?: string): Observable<{ id: string; name: string }> {
    const body = { name: (name ?? 'Untitled') as string };
    return this.http.post<{ id: string; name: string }>(`${API_BASE}/projects`, body);
  }

  /**
   * Save document to the server by project id.
   * Body is the full document (legacy format).
   */
  saveDocument(projectId: string, document: EditorDocument): Observable<{ id: string; saved: boolean }> {
    return this.http.post<{ id: string; saved: boolean }>(`${API_BASE}/documents/${encodeURIComponent(projectId)}`, document);
  }

  /**
   * Load document from the server by project id.
   * Returns the document (legacy format) or throws if not found.
   */
  loadDocument(projectId: string): Observable<EditorDocument> {
    return this.http.get<EditorDocument>(`${API_BASE}/documents/${encodeURIComponent(projectId)}`);
  }
}
