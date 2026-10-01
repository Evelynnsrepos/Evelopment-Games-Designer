import type { ComponentType } from './components'
import type { Id } from './ids'

/** Bump when a stored file shape changes, and add a migration in core/project/migrate.ts. */
export const SCHEMA_VERSION = 1

/** Every JSON file the app writes is wrapped like this (spec 2.1). */
export interface Versioned<T> {
  schemaVersion: number
  data: T
}

/** A document that a component owns, stored at `components/<type>/<id>.json`. */
export interface DocumentRef {
  id: Id
  type: ComponentType
  title: string
  createdAt: string
  updatedAt: string
}

/** An open panel in the tiling workspace. documentId is null for single-document components. */
export interface Panel {
  id: Id
  type: ComponentType
  documentId: Id | null
}

export type SplitDirection = 'row' | 'column'

/** The tiling workspace is a binary tree of splits with panels at the leaves (ED-3). */
export type LayoutNode =
  | { kind: 'panel'; panel: Panel }
  | { kind: 'split'; direction: SplitDirection; ratio: number; first: LayoutNode; second: LayoutNode }

export interface ProjectMeta {
  id: Id
  name: string
  description: string
  enabledComponents: ComponentType[]
  /** Documents of multi-document components, listed in the sidebar (SB-4). */
  documents: DocumentRef[]
  layout: LayoutNode | null
  sidebarCollapsed: boolean
  createdAt: string
  updatedAt: string
}

/** Summary shown on a launcher card (PM-2, PM-3). */
export interface ProjectStats {
  words: number
  images: number
}

/** An entry in the app-level recent projects list (PM-6). */
export interface RecentProject {
  path: string
  name: string
  description: string
  lastOpened: string
  stats: ProjectStats
}
