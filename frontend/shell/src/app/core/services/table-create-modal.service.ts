import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TableCreateModalService {
  private readonly visible = new BehaviorSubject<boolean>(false);
  readonly visible$ = this.visible.asObservable();

  show(): void {
    this.visible.next(true);
  }

  hide(): void {
    this.visible.next(false);
  }
}
