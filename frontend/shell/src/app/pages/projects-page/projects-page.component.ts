import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { EditorApiService } from '../../core/services/editor-api.service';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [RouterLink, AsyncPipe],
  template: `
    <div class="page">
      <div class="header">
        <div>
          <h1 class="title">Projects</h1>
          <p class="subtitle">Select a project to open the editor.</p>
        </div>
        <button type="button" class="create" (click)="onCreate()">Create Project</button>
      </div>

      @if (loading$ | async) {
        <p class="hint">Loading...</p>
      } @else if (error$ | async; as err) {
        <p class="hint error">Failed to load projects: {{ err }}</p>
      } @else {
        <div class="list">
          @for (p of (projects$ | async) ?? []; track p.id) {
            <a class="project" [routerLink]="['/project', p.id]">
              <div class="name">{{ p.name || 'Untitled' }}</div>
              <div class="meta">id: {{ p.id }}</div>
            </a>
          }
          @if (((projects$ | async) ?? []).length === 0) {
            <p class="hint">No projects yet. Create one.</p>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .page {
        height: 100%;
        min-height: 0;
        padding: 1rem;
      }
      .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 650;
      }
      .subtitle {
        margin: 0.25rem 0 0 0;
        color: #666;
        font-size: 0.9rem;
      }
      .create {
        padding: 0.45rem 0.65rem;
        border-radius: 8px;
        border: 1px solid #e2e2e2;
        background: #fff;
        cursor: pointer;
        font-weight: 600;
      }
      .create:hover {
        background: #f6f6f8;
      }
      .list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 0.75rem;
      }
      .project {
        display: block;
        padding: 0.75rem;
        border: 1px solid #e2e2e2;
        border-radius: 10px;
        text-decoration: none;
        color: inherit;
        background: #fff;
      }
      .project:hover {
        background: #f6f6f8;
        border-color: #d6d6d6;
      }
      .name {
        font-weight: 600;
      }
      .meta {
        margin-top: 0.25rem;
        font-size: 0.8rem;
        color: #666;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
          monospace;
      }
      .hint {
        margin: 0;
        color: #666;
        font-size: 0.9rem;
      }
      .hint.error {
        color: #c00;
      }
    `,
  ],
})
export class ProjectsPageComponent {
  private readonly api = inject(EditorApiService);
  private readonly router = inject(Router);

  readonly projects$ = new BehaviorSubject<Array<{ id: string; name?: string }>>([]);
  readonly loading$ = new BehaviorSubject<boolean>(true);
  readonly error$ = new BehaviorSubject<string | null>(null);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading$.next(true);
    this.error$.next(null);
    this.api.listProjects().subscribe({
      next: (res) => {
        this.projects$.next(res?.items ?? []);
      },
      error: (err) => {
        const msg =
          (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string'
            ? (err as any).message
            : String(err)) || 'Unknown error';
        this.error$.next(msg);
      },
      complete: () => this.loading$.next(false),
    });
  }

  onCreate(): void {
    this.api.createProject().subscribe({
      next: (p) => {
        this.router.navigate(['/project', p.id]);
      },
      error: (err) => {
        const msg =
          (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string'
            ? (err as any).message
            : String(err)) || 'Create failed';
        this.error$.next(msg);
      },
    });
  }
}

