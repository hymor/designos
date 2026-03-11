import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ToastMessage {
  text: string;
  kind?: 'info' | 'error';
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly messageSubject = new BehaviorSubject<ToastMessage | null>(null);
  readonly message$: Observable<ToastMessage | null> = this.messageSubject.asObservable();

  show(text: string, kind: 'info' | 'error' = 'info'): void {
    this.messageSubject.next({ text, kind });
  }

  clear(): void {
    this.messageSubject.next(null);
  }
}

