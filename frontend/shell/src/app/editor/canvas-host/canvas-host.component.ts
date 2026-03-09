import {
  AfterViewInit,
  Component,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { EditorFacadeService } from '../../core/services/editor-facade.service';

@Component({
  selector: 'app-canvas-host',
  standalone: true,
  template: `<canvas #canvasRef></canvas>`,
  styles: ['canvas { display: block; width: 100%; height: 100%; }'],
})
export class CanvasHostComponent implements AfterViewInit {
  @ViewChild('canvasRef', { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  constructor(private readonly editorFacade: EditorFacadeService) {}

  ngAfterViewInit(): void {
    const canvas = this.canvasRef?.nativeElement ?? null;
    if (canvas) {
      this.editorFacade.init(canvas);
    }
  }
}
