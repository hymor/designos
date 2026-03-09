/**
 * Document DTOs aligned with src/engine/model/types.ts.
 * Used for API contract and future serialization.
 */

export type ObjectTypeDto =
  | 'rect'
  | 'ellipse'
  | 'frame'
  | 'group'
  | 'image'
  | 'text';

export class BaseObjectDto {
  id!: string;
  type!: ObjectTypeDto;
  x!: number;
  y!: number;
  width!: number;
  height!: number;
  rotation?: number;
  parentId?: string | null;
}

export class EditorPageDto {
  id!: string;
  name!: string;
  width!: number;
  height!: number;
  objects!: BaseObjectDto[];
}

export class EditorDocumentDto {
  id!: string;
  name!: string;
  pages!: EditorPageDto[];
  activePageId?: string | null;
}
