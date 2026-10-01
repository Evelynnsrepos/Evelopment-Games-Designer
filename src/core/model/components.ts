/**
 * The 14 component types from spec section 6. This list is the contract
 * between the shell and the feature modules in `src/components/<type>/`.
 * Adding a new component type means adding it here AND creating its folder.
 */
export const COMPONENT_TYPES = [
  'timeline',
  'wiki',
  'damage-calculator',
  'item-list',
  'story-writer',
  'writer',
  'moodboard',
  'brainstorm',
  'level-calculator',
  'resource-calculator',
  'map',
  'character-list',
  'town-list',
  'enemy-list',
] as const

export type ComponentType = (typeof COMPONENT_TYPES)[number]

export function isComponentType(value: unknown): value is ComponentType {
  return typeof value === 'string' && (COMPONENT_TYPES as readonly string[]).includes(value)
}
