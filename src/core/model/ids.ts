/** All IDs in a project are UUIDs (spec 2.1). */
export type Id = string

export function newId(): Id {
  return crypto.randomUUID()
}
