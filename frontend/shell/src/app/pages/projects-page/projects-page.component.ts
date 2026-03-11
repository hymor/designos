import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { EditorApiService } from '../../core/services/editor-api.service';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [RouterLink, AsyncPipe, DatePipe],
  template: `
    <div class="page">
      <header class="topbar">
        <div class="logo">DesignOS</div>
        <div class="topbar-right">
          <h1 class="title">Projects</h1>
          <button type="button" class="btn-create" (click)="onCreate()">Create Project</button>
        </div>
      </header>

      <main class="main">
        @if (loading$ | async) {
          <div class="empty">Loading…</div>
        } @else if (error$ | async; as err) {
          <div class="empty error">Failed to load projects: {{ err }}</div>
        } @else {
          <div class="grid">
            @for (p of (projects$ | async) ?? []; track p.id) {
              <a class="card" [routerLink]="['/project', p.id]">
                <div class="card-thumb">
                  <span class="card-thumb-icon" aria-hidden="true">◫</span>
                </div>
                <div class="card-body">
                  <span class="card-name">{{ p.name || 'Untitled' }}</span>
                  <span class="card-meta">
                    {{ p.updatedAt ? (p.updatedAt | date: 'short') : 'never saved' }}
                  </span>
                </div>
              </a>
            }
          </div>
          @if (((projects$ | async) ?? []).length === 0) {
            <div class="empty">
              Select a project to open the editor.<br />
              No projects yet. Create one.
            </div>
          }
        }
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        --proj-bg: var(--bg, #111112);
        --proj-surface: var(--surface, #1c1c1e);
        --proj-surface2: var(--surface2, #242428);
        --proj-surface3: var(--surface3, #2c2c30);
        --proj-border: var(--border, #333338);
        --proj-text: var(--text, #e8e8ea);
        --proj-text2: var(--text2, #888890);
        --proj-text3: var(--text3, #4a4a52);
        --proj-accent: var(--accent, #7b61ff);
        display: block;
        height: 100%;
        min-height: 100vh;
        background: var(--proj-bg);
        font-family: 'Segoe UI', Helvetica, sans-serif;
        color: var(--proj-text);
      }
      .page {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      .topbar {
        flex-shrink: 0;
        height: 48px;
        padding: 0 16px 0 12px;
        background: var(--proj-surface);
        border-bottom: 1px solid var(--proj-border);
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .logo {
        font-size: 13px;
        font-weight: 700;
        color: var(--proj-accent);
        padding-right: 12px;
        border-right: 1px solid var(--proj-border);
        margin-right: 4px;
        white-space: nowrap;
      }
      .topbar-right {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-width: 0;
      }
      .title {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        color: var(--proj-text);
        letter-spacing: 0.02em;
      }
      .btn-create {
        height: 32px;
        padding: 0 14px;
        background: var(--proj-accent);
        border: none;
        border-radius: 8px;
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: opacity 0.15s;
      }
      .btn-create:hover {
        opacity: 0.9;
      }
      .main {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 24px;
      }
      .main::-webkit-scrollbar {
        width: 8px;
      }
      .main::-webkit-scrollbar-thumb {
        background: var(--proj-border);
        border-radius: 4px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
        align-content: start;
      }
      .card {
        display: flex;
        flex-direction: column;
        background: var(--proj-surface2);
        border: 1px solid var(--proj-border);
        border-radius: 12px;
        overflow: hidden;
        text-decoration: none;
        color: inherit;
        transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
      }
      .card:hover {
        border-color: var(--proj-accent);
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      }
      .card-thumb {
        width: 100%;
        height: 120px;
        background: var(--proj-surface3);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card-thumb-icon {
        font-size: 36px;
        color: var(--proj-text3);
        opacity: 0.4;
      }
      .card-body {
        padding: 12px 14px 14px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .card-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--proj-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .card-meta {
        font-size: 11px;
        color: var(--proj-text3);
        font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .empty {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        padding: 48px 24px;
        text-align: center;
        color: var(--proj-text3);
        font-size: 13px;
        line-height: 1.8;
      }
      .empty.error {
        color: #e86c6c;
      }
    `,
  ],
})
export class ProjectsPageComponent {
  private readonly api = inject(EditorApiService);
  private readonly router = inject(Router);

  readonly projects$ = new BehaviorSubject<Array<{ id: string; name?: string; updatedAt?: string | Date }>>([]);
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

