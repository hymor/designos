import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { EditorFacadeService } from '../../core/services/editor-facade.service';

@Component({
  selector: 'app-project-tabs',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    <div class="project-tabs">
      @if (activeProjectId$ | async; as id) {
        <button
          type="button"
          class="project-tab active"
          (click)="onTabClick(id)"
          [title]="labelFor(id)"
        >
          <span>{{ labelFor(id) }}</span>
          <span class="project-tab-close">×</span>
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        --surface2: #242428;
        --surface3: #2c2c30;
        --border: #333338;
        --text: #e8e8ea;
        --text2: #888890;
        --accent: #7b61ff;
        --tabs-h: 32px;
      }

      .project-tabs {
        height: var(--tabs-h);
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 0 14px;
        background: var(--surface2);
        border-bottom: 1px solid var(--border);
        overflow-x: auto;
      }

      .project-tabs::-webkit-scrollbar {
        height: 3px;
      }

      .project-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--text2);
        font-size: 11px;
        cursor: pointer;
        max-width: 140px;
        min-width: 0;
        flex-shrink: 0;
      }

      .project-tab span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .project-tab:hover {
        background: var(--surface3);
        color: var(--text);
      }

      .project-tab.active {
        background: var(--accent);
        color: #fff;
      }

      .project-tab-close {
        width: 16px;
        height: 16px;
        border: none;
        background: none;
        color: inherit;
        border-radius: 3px;
        opacity: 0.7;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        line-height: 1;
        flex-shrink: 0;
        pointer-events: none;
      }

      .project-tab-close:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.15);
      }
    `,
  ],
})
export class ProjectTabsComponent {
  private readonly editorFacade = inject(EditorFacadeService);
  private readonly router = inject(Router);

  readonly activeProjectId$ = this.editorFacade.activeProjectId$.pipe(
    map((id) => (id || 'default')),
  );

  labelFor(id: string | null | undefined): string {
    const trimmed = (id || '').trim();
    return trimmed || 'Untitled';
  }

  onTabClick(id: string | null | undefined): void {
    const trimmed = (id || '').trim() || 'default';
    this.router.navigate(['/project', trimmed]);
  }
}

