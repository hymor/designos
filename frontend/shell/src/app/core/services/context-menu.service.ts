import { Injectable } from '@angular/core';

export type ContextMenuKind = 'object' | 'artboard';

export interface ContextMenuState {
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
  readonly kind: ContextMenuKind;
}

@Injectable({
  providedIn: 'root',
})
export class ContextMenuService {
  private state: ContextMenuState = {
    visible: false,
    x: 0,
    y: 0,
    kind: 'object',
  };

  get current(): ContextMenuState {
    return this.state;
  }

  open(kind: ContextMenuKind, x: number, y: number): void {
    this.state = { visible: true, kind, x, y };
  }

  close(): void {
    if (!this.state.visible) return;
    this.state = { ...this.state, visible: false };
  }
}

