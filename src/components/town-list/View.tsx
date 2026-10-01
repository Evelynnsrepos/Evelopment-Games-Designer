import { Castle, Link2, Skull, Users } from 'lucide-react'
import { useCallback } from 'react'
import type { Town } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useProjectStore } from '@/core/state'
import {
  backlinksTo,
  DetailFrame,
  EntityList,
  EntityRefList,
  LINK_SUGGESTIONS,
  linkSearchText,
  LinksEditor,
  Section,
  type DetailContext,
  type ListText,
} from '@/shared/entityList'
import { goTo, openWiki, townActions as actions } from './actions'

const TEXT: ListText = {
  one: 'town',
  many: 'towns',
  emptyBody: 'Add your first town: capitals, villages, outposts, anywhere people live.',
  newName: 'New town',
}

const levelText = (min: number, max: number) => (min === max ? `Lv ${min}` : `Lv ${min}–${max}`)

/** Town List (spec 8.12): mirrors the Character List, plus who lives here and which enemies appear. */
export default function View({ active }: PanelProps) {
  const collections = useProjectStore((s) => s.entities)
  const searchText = useCallback((t: Town) => linkSearchText(t.links, collections), [collections])
  const cardMeta = (t: Town) => {
    const people = backlinksTo(t.id, collections).filter((b) => b.source.type === 'character').length
    return people ? `${people} ${people === 1 ? 'character' : 'characters'}` : ''
  }
  return (
    <EntityList
      type="town"
      active={active}
      actions={actions}
      text={TEXT}
      icon={Castle}
      searchText={searchText}
      cardMeta={cardMeta}
      renderDetail={(t, ctx) => <TownDetail town={t} ctx={ctx} />}
    />
  )
}

function TownDetail({ town, ctx }: { town: Town; ctx: DetailContext }) {
  const collections = useProjectStore((s) => s.entities)
  const backlinks = backlinksTo(town.id, collections)
  const people = backlinks.filter((b) => b.source.type === 'character')
  const places = backlinks.filter((b) => b.source.type === 'town')
  const enemies = collections.enemy.filter((e) => (e.foundIn ?? []).includes(town.id)).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <DetailFrame type="town" entity={town} actions={actions} ctx={ctx} text={TEXT} onOpenWiki={() => openWiki('town', town.id)}>
      <Section label="People" icon={<Users size={13} aria-hidden />}>
        <EntityRefList
          refs={people.map((b) => ({ key: `${b.source.id}:${b.link.id}`, type: 'character', id: b.source.id, name: b.source.name, after: b.link.label }))}
          empty={'No characters yet. Link a character to this town, e.g. "Lives in".'}
          onNavigate={goTo}
        />
      </Section>
      <Section label="Links" icon={<Link2 size={13} aria-hidden />}>
        <LinksEditor
          selfId={town.id}
          links={town.links ?? []}
          onChange={(links, group) => actions.update(town.id, { links }, group ?? null)}
          targetTypes={['town', 'character']}
          suggestions={LINK_SUGGESTIONS.town}
          onNavigate={goTo}
        />
        {places.length > 0 && (
          <>
            <div className="elist-subhead">Linked from other towns</div>
            <EntityRefList
              refs={places.map((b) => ({ key: `${b.source.id}:${b.link.id}`, type: 'town', id: b.source.id, name: b.source.name, after: b.link.label }))}
              empty=""
              onNavigate={goTo}
            />
          </>
        )}
      </Section>
      <Section label="Enemies found here" icon={<Skull size={13} aria-hidden />}>
        <EntityRefList
          refs={enemies.map((e) => ({ key: e.id, type: 'enemy', id: e.id, name: e.name, after: levelText(e.levelMin, e.levelMax) }))}
          empty={'No enemies yet. Add this town to an enemy\'s "Found in" in the Enemy List.'}
          onNavigate={goTo}
        />
      </Section>
    </DetailFrame>
  )
}
