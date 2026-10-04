import { useEffect, useState } from 'react'
import { loadDocumentNow, useProjectStore } from '@/core/state'
import { createDamagePresetDoc, damagePresetFormula, type DamagePresetDoc } from './docs'

export interface DamagePreset {
  id: string
  title: string
  expression: string
  values: Record<string, number>
}

/** Every Damage Calculator preset of the project, with its formula and values (v0.10). */
export function useDamagePresets(): DamagePreset[] {
  const root = useProjectStore((s) => s.root)
  const docs = useProjectStore((s) => s.meta?.documents)
  const [list, setList] = useState<DamagePreset[]>([])
  useEffect(() => {
    if (!root || !docs) return
    let stale = false
    const presets = docs.filter((d) => d.type === 'damage-calculator')
    void Promise.all(
      presets.map(async (d) => ({ id: d.id, title: d.title, ...damagePresetFormula(await loadDocumentNow<DamagePresetDoc>(root, 'damage-calculator', d.id, createDamagePresetDoc)) })),
    ).then((l) => !stale && setList(l))
    return () => {
      stale = true
    }
  }, [root, docs])
  return list
}
