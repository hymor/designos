import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, distinctUntilChanged, filter, map, switchMap, take, takeUntil, tap } from 'rxjs';
import { EditorFacadeService } from '../../core/services/editor-facade.service';
import { EditorShellComponent } from '../../editor/editor-shell/editor-shell.component';

@Component({
  selector: 'app-project-page',
  standalone: true,
  imports: [RouterLink, EditorShellComponent],
  template: `
    <div class="page">
      <div class="topbar">
        <a class="back" routerLink="/projects">Projects</a>
        <div class="spacer"></div>
        <div class="pid">project: {{ projectId }}</div>
      </div>

      @if (loadError) {
        <div class="banner error">
          <div class="title">Project document not found</div>
          <div class="msg">{{ loadError }}</div>
        </div>
      }

      <div class="content">
        <app-editor-shell></app-editor-shell>
      </div>
    </div>
  `,
  styles: [
    `
      .page {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      .topbar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid #e2e2e2;
        background: #fff;
      }
      .back {
        text-decoration: none;
        color: #7b61ff;
        font-weight: 600;
      }
      .spacer {
        flex: 1;
      }
      .pid {
        font-size: 0.8rem;
        color: #666;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
          monospace;
      }
      .content {
        flex: 1;
        min-height: 0;
      }
      app-editor-shell {
        display: block;
        height: 100%;
      }
      .banner {
        padding: 0.6rem 0.75rem;
        border-bottom: 1px solid #e2e2e2;
        background: #fff;
      }
      .banner.error {
        background: rgba(204, 0, 0, 0.04);
        border-bottom-color: rgba(204, 0, 0, 0.2);
      }
      .banner .title {
        font-weight: 650;
        font-size: 0.9rem;
        color: #c00;
      }
      .banner .msg {
        margin-top: 0.25rem;
        color: #555;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class ProjectPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly editorFacade = inject(EditorFacadeService);
  private readonly destroy$ = new Subject<void>();

  projectId = 'default';
  loadError: string | null = null;

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((p) => p.get('id') || 'default'),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((id) => {
        this.projectId = id;
        this.editorFacade.setActiveProjectId(id);
      });

    // Load project document only after editor bridge is ready, so we don't break current runtime flow.
    this.route.paramMap
      .pipe(
        map((p) => p.get('id') || 'default'),
        distinctUntilChanged(),
        tap(() => (this.loadError = null)),
        switchMap((id) =>
          this.editorFacade.bridgeReady$.pipe(
            filter(Boolean),
            take(1),
            switchMap(() => this.editorFacade.loadFromServer(id)),
          ),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe({
        error: (err) => {
          const msg =
            (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string'
              ? (err as any).message
              : String(err)) || 'Load failed';
          this.loadError = msg;
          console.warn('[ProjectPage] loadFromServer failed:', err);
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

