import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { EditorFacadeService } from '../../core/services/editor-facade.service';
import { ContextMenuService } from '../../core/services/context-menu.service';

@Component({
  selector: 'app-canvas-host',
  standalone: true,
  template: `
    <div #hostRef class="designos-editor-host">
      <!-- Legacy editor host: bootstrap will create SVG (defs, frames-g, els-loose, sel-ov, etc.) inside this div -->
    </div>
  `,
  styles: [`
    .designos-editor-host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
      background: #0d0d0f;
      background-image: radial-gradient(circle, #252528 1px, transparent 1px);
      background-size: 24px 24px;
    }
  `],
})
export class CanvasHostComponent implements AfterViewInit {
  @ViewChild('hostRef', { static: false })
  hostRef!: ElementRef<HTMLElement>;

  constructor(
    private readonly editorFacade: EditorFacadeService,
    private readonly contextMenu: ContextMenuService,
  ) {}

  ngAfterViewInit(): void {
    const container = this.hostRef?.nativeElement ?? null;
    if (container) {
      this.editorFacade.init(container);
      container.addEventListener('contextmenu', (e: MouseEvent) => this.onContextMenu(e));
    }
  }

  private onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    const sel = this.editorFacade.getSelection();
    const kind = sel.ids && sel.ids.length ? 'object' : 'artboard';
    this.contextMenu.open(kind, e.clientX, e.clientY);
  }
}
