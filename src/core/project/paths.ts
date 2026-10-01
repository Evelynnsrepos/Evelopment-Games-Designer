import type { ComponentType, EntityType } from '../model'
import { ENTITY_COLLECTION } from '../model'
import { getFs } from '../fs'

/** Folder layout from spec 2.1. Every path helper lives here so the layout changes in one place. */
export const projectPaths = {
  meta: (root: string) => getFs().join(root, 'project.json'),
  entitiesDir: (root: string) => getFs().join(root, 'entities'),
  collection: (root: string, type: EntityType) => getFs().join(root, 'entities', `${ENTITY_COLLECTION[type]}.json`),
  categories: (root: string) => getFs().join(root, 'entities', 'categories.json'),
  componentDir: (root: string, type: ComponentType) => getFs().join(root, 'components', type),
  document: (root: string, type: ComponentType, id: string) => getFs().join(root, 'components', type, `${id}.json`),
  imagesDir: (root: string) => getFs().join(root, 'assets', 'images'),
  audioDir: (root: string) => getFs().join(root, 'assets', 'audio'),
  backupsDir: (root: string) => getFs().join(root, '.backups'),
}

export const APP_FOLDER_NAME = 'Evelopment Games Designer'
