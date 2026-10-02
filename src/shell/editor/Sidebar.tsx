import { ChevronDown, ChevronRight, CircleHelp, House, PanelLeftClose, PanelLeftOpen, Palette, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { ComponentType, Id } from '@/core/model'
import { allManifests, getManifest, type ComponentManifest } from '@/core/registry'
import { useProjectStore } from '@/core/state'
import { confirmDialog, promptDialog } from '@/shared/dialogs'
import { backToProjects, closePanel, DRAG_MIME, newDocument, openComponent, type DragPayload } from './actions'
import { leaves } from '../workspace/layoutTree'
import { useHelp } from '../help/help'
import { ProjectThemeDialog } from './projectTheme'

/** Always-visible component sidebar (SB-1..SB-7). */
export function Sidebar() {
  const meta = useProjectStore((s) => s.meta)
  const updateMeta = useProjectStore((s) => s.updateMeta)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [addOpen, setAddOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  if (!meta) return null
  const collapsed = meta.sidebarCollapsed
  const enabled = meta.enabledComponents.map(getManifest).filter((m): m is ComponentManifest => !!m)
  const available = allManifests().filter((m) => !meta.enabledComponents.includes(m.type))

  const dragProps = (type: ComponentType, documentId: Id | null) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      const payload: DragPayload = { type, documentId }
      e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
      e.dataTransfer.effectAllowed = 'copy'
    },
  })

  return (
    <nav className={`sidebar${collapsed ? ' collapsed' : ''}`} aria-label="Components">
      <div className="sidebar-top">
        <button className="sidebar-row" onClick={() => void backToProjects()} title="Back to projects">
          <House size={16} />
          {!collapsed && <span>Projects</span>}
        </button>
        {!collapsed && <div className="sidebar-project" title={meta.name}>{meta.name}</div>}
      </div>

      <div className="sidebar-list" data-tour="sidebar-list">
        {enabled.map((m) => {
          const docs = meta.documents.filter((d) => d.type === m.type)
          const isOpen = expanded[m.type] ?? true
          return (
            <div key={m.type}>
              <div className="sidebar-item">
                <button
                  className="sidebar-row"
                  title={m.name}
                  onClick={() => openComponent(m.type)}
                  {...dragProps(m.type, m.multiDocument ? (docs[0]?.id ?? null) : null)}
                >
                  <m.icon size={16} />
                  {!collapsed && <span>{m.name}</span>}
                </button>
                {!collapsed && m.multiDocument && (
                  <button className="icon-btn" title={isOpen ? 'Collapse' : 'Expand'} onClick={() => setExpanded({ ...expanded, [m.type]: !isOpen })}>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                )}
              </div>
              {!collapsed && m.multiDocument && isOpen && (
                <div className="sidebar-docs">
                  {docs.map((d) => (
                    <div key={d.id} className="sidebar-item">
                      <button
                        className="sidebar-row sidebar-doc"
                        onClick={() => openComponent(m.type, d.id)}
                        onDoubleClick={async () => {
                          const title = await promptDialog('Rename document', d.title)
                          if (title?.trim()) useProjectStore.getState().renameDocument(d.id, title.trim())
                        }}
                        title={`${d.title} (double-click to rename)`}
                        {...dragProps(m.type, d.id)}
                      >
                        <span>{d.title}</span>
                      </button>
                      <button
                        className="icon-btn sidebar-doc-delete"
                        title="Delete document"
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: 'Delete document?',
                            message: `"${d.title}" will be deleted permanently.`,
                            confirmLabel: 'Delete',
                            danger: true,
                          })
                          if (!ok) return
                          const open = leaves(useProjectStore.getState().meta?.layout ?? null).find((p) => p.documentId === d.id)
                          if (open) await closePanel(open.id)
                          await useProjectStore.getState().removeDocument(d.id)
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button className="sidebar-row sidebar-doc sidebar-new" onClick={() => newDocument(m.type)}>
                    <Plus size={13} /> <span>New</span>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="sidebar-bottom">
        {available.length > 0 && (
          <div style={{ position: 'relative' }} data-tour="add-component">
            <button className="sidebar-row" title="Add component" onClick={() => setAddOpen(!addOpen)}>
              <Plus size={16} />
              {!collapsed && <span>Add component</span>}
            </button>
            {addOpen && (
              <div className="menu" style={{ bottom: '100%', left: 4 }} onMouseLeave={() => setAddOpen(false)}>
                {available.map((m) => (
                  <button
                    key={m.type}
                    onClick={() => {
                      setAddOpen(false)
                      useProjectStore.getState().enableComponent(m.type)
                    }}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button className="sidebar-row" title="Project look" data-tour="project-look" onClick={() => setThemeOpen(true)}>
          <Palette size={16} />
          {!collapsed && <span>Project look</span>}
        </button>
        {themeOpen && <ProjectThemeDialog onClose={() => setThemeOpen(false)} />}
        <button className="sidebar-row" title="Help (F1)" data-tour="help" onClick={() => useHelp.getState().openGuide()}>
          <CircleHelp size={16} />
          {!collapsed && <span>Help</span>}
        </button>
        <button
          className="sidebar-row"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => updateMeta({ sidebarCollapsed: !collapsed })}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </nav>
  )
}

