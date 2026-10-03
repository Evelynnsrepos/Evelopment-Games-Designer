import { Crown, Diamond, Flame, Gem, Heart, Shield, Skull, Sparkles, Star, Zap, type LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { categoryAppliesTo, type Category, type CategoryValue, type EntityBase, type EntityType, type OptionStyle } from '@/core/model'

/**
 * Option styles (v0.6 rarities): a dropdown category can give each option a
 * color, a border and an icon. The built-in Rarity category comes with styles
 * for Common to Legendary; any other dropdown (Element, Faction…) can have them too.
 * Styles are shown wherever the entity appears: cards, tables, pages, wiki and links.
 */

export const BORDERS: { id: OptionStyle['border']; label: string }[] = [
  { id: 'none', label: 'No border' },
  { id: 'solid', label: 'Solid' },
  { id: 'double', label: 'Double' },
  { id: 'glow', label: 'Glow' },
]

export const STYLE_ICONS: Record<string, LucideIcon> = {
  star: Star,
  gem: Gem,
  diamond: Diamond,
  crown: Crown,
  flame: Flame,
  sparkles: Sparkles,
  zap: Zap,
  shield: Shield,
  skull: Skull,
  heart: Heart,
}

/** Pre-saved rarity looks, used for the built-in Rarity category (also in projects made before v0.6). */
export const DEFAULT_RARITY_STYLES: Record<string, OptionStyle> = {
  Common: { color: '#9aa0a6', border: 'none', icon: null },
  Uncommon: { color: '#30a46c', border: 'solid', icon: null },
  Rare: { color: '#3e8ef7', border: 'solid', icon: 'gem' },
  Epic: { color: '#a855f7', border: 'double', icon: 'sparkles' },
  Legendary: { color: '#f5a623', border: 'glow', icon: 'crown' },
  Mythic: { color: '#e5484d', border: 'glow', icon: 'flame' },
}

export const isRarity = (c: Category) => c.builtIn && c.name === 'Rarity'

/** Does this category give its options looks? */
export const isStyled = (c: Category) => c.kind === 'dropdown' && (c.styles ? Object.keys(c.styles).length > 0 : isRarity(c))

export function styleOf(category: Category, value: CategoryValue | undefined): OptionStyle | null {
  if (category.kind !== 'dropdown' || typeof value !== 'string' || !value) return null
  return category.styles?.[value] ?? (isRarity(category) && !category.styles ? (DEFAULT_RARITY_STYLES[value] ?? null) : null)
}

export interface EntityLook {
  style: OptionStyle
  value: string
  category: Category
}

/**
 * The look of an entity: from its rarity first, else the first styled category
 * it has a value for. Null when it has none.
 */
export function entityLook(categories: Category[], type: EntityType, entity: Pick<EntityBase, 'id' | 'categories'>): EntityLook | null {
  const styled = categories.filter((c) => isStyled(c) && categoryAppliesTo(c, type, entity.id))
  styled.sort((a, b) => Number(isRarity(b)) - Number(isRarity(a)))
  for (const c of styled) {
    const v = entity.categories[c.id]
    const style = styleOf(c, v)
    if (style) return { style, value: v as string, category: c }
  }
  return null
}

/** CSS for a framed element (card, image) in this look. */
export function frameStyle(style: OptionStyle | null | undefined): CSSProperties {
  if (!style || style.border === 'none') return {}
  if (style.border === 'glow') return { outline: `2px solid ${style.color}`, boxShadow: `0 0 12px 2px ${style.color}88` }
  if (style.border === 'double') return { outline: `4px double ${style.color}` }
  return { outline: `2px solid ${style.color}` }
}

/** A small colored pill with the option's icon and name. */
export function StyleBadge({ style, label, small }: { style: OptionStyle; label?: string; small?: boolean }) {
  const Icon = style.icon ? STYLE_ICONS[style.icon] : null
  return (
    <span className={`cat-style-badge${small ? ' small' : ''}`} style={{ color: style.color, borderColor: `${style.color}88`, background: `${style.color}1f` }}>
      {Icon && <Icon size={small ? 11 : 13} />}
      {label}
    </span>
  )
}

/** Just the colored icon (or a dot), for tight spots like links and table names. */
export function StyleMark({ style }: { style: OptionStyle }) {
  const Icon = style.icon ? STYLE_ICONS[style.icon] : null
  return Icon ? <Icon size={12} color={style.color} className="cat-style-mark" /> : <span className="cat-style-dot" style={{ background: style.color }} />
}
