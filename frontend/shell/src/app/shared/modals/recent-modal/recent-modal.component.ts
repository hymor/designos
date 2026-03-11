import { AsyncPipe } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { EditorApiService } from '../../../core/services/editor-api.service';
import { RecentModalService } from '../../../core/services/recent-modal.service';

@Component({
  selector: 'app-recent-modal',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    @if (visible$ | async) {
      <div class="recent-modal" role="dialog" aria-label="Projects">
        <div class="recent-ov" (click)="close()"></div>
        <div class="recent-panel" (click)="$event.stopPropagation()">
          <div class="recent-hdr">
            <span class="recent-hdr-title">Projects</span>
            <span class="recent-proj-name">{{ currentProjectName }}</span>
            <button type="button" class="recent-new-btn" (click)="onNewProject()">+ New project</button>
            <button type="button" class="recent-x" (click)="close()" aria-label="Close">✕</button>
          </div>
          <div class="recent-grid">
            @if (loading) {
              <div class="recent-empty">Loading…</div>
            } @else if (!projects.length) {
              <div class="recent-empty">No projects yet.<br>Create one with "+ New project".</div>
            } @else {
              @for (p of projects; track p.id) {
                <div
                  class="recent-card"
                  [class.recent-card-current]="p.id === currentProjectId"
                  (click)="onSelectProject(p.id)"
                >
                  <div class="recent-thumb">
                    <span class="recent-thumb-empty">&#9654;</span>
                  </div>
                  <div class="recent-card-body">
                    <div class="recent-card-name">{{ p.name || 'Untitled' }}</div>
                    <div class="recent-card-date">{{ p.id === currentProjectId ? '· open' : '' }}</div>
                  </div>
                </div>
              }
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .recent-modal {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .recent-ov {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(4px);
        z-index: 0;
      }
      .recent-panel {
        position: relative;
        z-index: 1;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        width: 680px;
        max-width: 95vw;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
      }
      .recent-hdr {
        display: flex;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
        gap: 10px;
      }
      .recent-hdr-title {
        font-size: 14px;
        font-weight: 700;
        color: var(--text);
        flex: 1;
      }
      .recent-proj-name {
        font-size: 12px;
        color: var(--text3);
        font-weight: 400;
      }
      .recent-new-btn {
        height: 28px;
        padding: 0 12px;
        background: var(--accent);
        border: none;
        border-radius: 6px;
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }
      .recent-new-btn:hover {
        opacity: 0.85;
      }
      .recent-x {
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        color: var(--text3);
        font-size: 16px;
        cursor: pointer;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .recent-x:hover {
        background: var(--surface3);
        color: var(--text);
      }
      .recent-grid {
        flex: 1;
        overflow-y: auto;
        padding: 16px 20px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(152px, 1fr));
        gap: 14px;
        align-content: start;
      }
      .recent-grid::-webkit-scrollbar {
        width: 4px;
      }
      .recent-grid::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 2px;
      }
      .recent-card {
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 10px;
        overflow: hidden;
        cursor: pointer;
        transition: border-color 0.15s, transform 0.1s;
      }
      .recent-card:hover {
        border-color: var(--accent);
        transform: translateY(-2px);
      }
      .recent-card-current {
        border-color: var(--accent);
      }
      .recent-thumb {
        width: 100%;
        height: 96px;
        background: var(--surface3);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .recent-thumb-empty {
        font-size: 30px;
        opacity: 0.2;
      }
      .recent-card-body {
        padding: 8px 10px 10px;
      }
      .recent-card-name {
        font-size: 11px;
        font-weight: 600;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 3px;
      }
      .recent-card-date {
        font-size: 10px;
        color: var(--text3);
      }
      .recent-empty {
        grid-column: 1 / -1;
        text-align: center;
        padding: 48px 0;
        color: var(--text3);
        font-size: 12px;
        line-height: 2;
      }
    `,
  ],
})
export class RecentModalComponent implements OnInit, OnDestroy {
  private readonly recentModal = inject(RecentModalService);
  private readonly api = inject(EditorApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  readonly visible$ = this.recentModal.visible$;
  isVisible = false;
  loading = false;
  projects: Array<{ id: string; name?: string }> = [];
  currentProjectId = '';
  currentProjectName = '';

  ngOnInit(): void {
    this.recentModal.visible$.pipe(takeUntil(this.destroy$)).subscribe((v) => (this.isVisible = v));
    this.recentModal.visible$
      .pipe(
        switchMap((visible) => {
          if (!visible) return [];
          this.loading = true;
          this.projects = [];
          return this.api.listProjects();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((res) => {
        this.loading = false;
        const items = res?.items ?? [];
        this.projects = items;
        const id = this.route.snapshot.paramMap.get('id') || '';
        this.currentProjectId = id;
        const cur = items.find((x) => x.id === id);
        this.currentProjectName = cur?.name ? 'Current: ' + cur.name : '';
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close(): void {
    this.recentModal.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isVisible) this.close();
  }

  onSelectProject(id: string): void {
    this.router.navigate(['/project', id]);
    this.close();
  }

  onNewProject(): void {
    this.api.createProject('Untitled').subscribe({
      next: (p) => {
        this.router.navigate(['/project', p.id]);
        this.close();
      },
      error: () => {},
    });
  }
}
