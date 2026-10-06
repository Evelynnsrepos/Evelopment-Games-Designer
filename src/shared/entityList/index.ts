/**
 * Shared frame for entity lists (Character, Town and Enemy Lists; spec 8.11-8.13).
 *
 * - createEntityActions(type)   undoable commands for one entity type
 * - <EntityList>                 toolbar, cards/table, search, filter, sort, bulk actions
 * - <DetailFrame> and parts      image, name, description, associations, notes, stats, links
 * - navigation.ts                "show this entity" and "create wiki article" requests between components
 * - growth.ts                    stat growth per level, shared with the calculators (EN-3, LV-3)
 */
export * from './actions'
export * from './query'
export * from './navigation'
export * from './links'
export * from './growth'
export * from './info'
export { isTyping } from './dom'
export { EntityList, type DetailContext, type EntityListProps, type ExtraColumn, type ListText } from './EntityList'
export { JumpBar, UsedIn } from './JumpBar'
export { DetailFrame, EntityPicker, EntityRefList, ImagePicker, LinksEditor, Section, StatsEditor, type EntityRef } from './EntityDetail'
