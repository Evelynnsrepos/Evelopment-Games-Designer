/**
 * Shared custom categories / associations (spec 3.4), used by every entity list.
 *
 * - <CategoryFields>   the category fields on one entity's page, with "Add category…"
 * - <CategoryManager>  modal to create, edit, scope and delete categories
 * - <CategoryValueInput>, <NumberInput>  single inputs
 * - logic.ts           pure helpers (scopes, filtering, sorting, value conversion)
 * - renameOptionValues keeps stored values in step when dropdown options are renamed
 */
export * from './logic'
export { CategoryFields, type CategoryFieldsProps } from './CategoryFields'
export { CategoryManager, type CategoryChange } from './CategoryManager'
export { CategoryValueInput, NumberInput } from './CategoryValueInput'
export { NewCategoryForm } from './CategoryForm'
export { renameOptionValues } from './store'
