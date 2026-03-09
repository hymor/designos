import { Injectable } from '@angular/core';
import { BehaviorSubject, type Observable } from 'rxjs';

export interface EditorSelection {
  ids: string[];
  primary: string | null;
}

export interface EditorElementProperties {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorBridgeApi {
  init(canvas: HTMLElement | HTMLCanvasElement | null): void;
  addRectangle(): void;
  deleteSelected(): void;
  zoomIn(): void;
  zoomOut(): void;
  getSelection(): EditorSelection;
  getElementProperties?(id: string): EditorElementProperties | null;
  on?(eventName: string, callback: (payload: EditorSelection) => void): void;
}

declare global {
  interface Window {
    editorBridge?: EditorBridgeApi;
  }
}

const emptySelection: EditorSelection = { ids: [], primary: null };

@Injectable({
  providedIn: 'root',
})
export class EditorFacadeService {
  private readonly selectionSubject = new BehaviorSubject<EditorSelection>(emptySelection);
  readonly selection$: Observable<EditorSelection> = this.selectionSubject.asObservable();

  private get bridge(): EditorBridgeApi | undefined {
    return typeof window !== 'undefined' ? window.editorBridge : undefined;
  }

  init(canvas: HTMLCanvasElement | HTMLElement | null): void {
    this.bridge?.init(canvas ?? null);
    this.selectionSubject.next(this.getSelection());
    const onSelectionChanged = (payload: EditorSelection) => this.selectionSubject.next(payload);
    this.bridge?.on?.('selectionChanged', onSelectionChanged);
  }

  addRectangle(): void {
    this.bridge?.addRectangle();
  }

  deleteSelected(): void {
    this.bridge?.deleteSelected();
  }

  zoomIn(): void {
    this.bridge?.zoomIn();
  }

  zoomOut(): void {
    this.bridge?.zoomOut();
  }

  getSelection(): EditorSelection {
    return this.bridge?.getSelection() ?? emptySelection;
  }

  getElementProperties(id: string): EditorElementProperties | null {
    return this.bridge?.getElementProperties?.(id) ?? null;
  }
}
