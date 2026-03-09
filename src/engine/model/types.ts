export type ObjectType = 'rect' | 'ellipse' | 'frame' | 'group' | 'image' | 'text'

export interface BaseObject {
  id: string
  type: ObjectType
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  parentId?: string | null
}

export interface EditorPage {
  id: string
  name: string
  width: number
  height: number
  objects: BaseObject[]
}

export interface EditorDocument {
  id: string
  name: string
  pages: EditorPage[]
  activePageId?: string | null
}