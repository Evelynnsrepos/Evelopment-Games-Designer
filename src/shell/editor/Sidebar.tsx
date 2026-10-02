import { ChevronDown, ChevronRight, CircleHelp, House, PanelLeftClose, PanelLeftOpen, Palette, Plus, Settings, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { ComponentType, Id } from '@/core/model'
import { allManifests, getManifest, type ComponentManifest } from '@/core/registry'
import { useProjectStore } from '@/core/state'
import { confirmDialog, promptDialog } from '@/shared/dialogs'
import { backToProjects, closePanel, DRAG_MIME, newDocument, openComponent, replaceWithComponent, type DragPayload } from './actions'
import { leaves } from '../workspace/layoutTree'
import { useHelp } from '../help/help'
import { openSettings } from '../settings/open'
import { usePlugins } from '../plugins/plugins'
import { ProjectThemeDialog } from './projectTheme'
import { CloseToolDialog, RestoreToolDialog, type CloseChoice, type RestoreChoice } from './ToolDialogs'
import { deleteToolContent, hideTool, toolHasContent } from './toolContent'

/** Always-visible component sidebar (SB-1..SB-7). */
export function Sidebar() {
  const meta = useProjectStore((s) => s.meta)
  const updateMeta = useProjectStore((s) => s.updateMeta)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [addOpen, setAddOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [toolMenu, setToolMenu] = useState<{ manifest: ComponentManifest; x: number; y: number } | null>(null)
  const [closing, setClosing] = useState<ComponentManifest | null>(null)
  const [restoring, setRestoring] = useState<ComponentManifest | null>(null)
  usePlugins((s) => s.installed) // re-render when plugin tools come and go
  if (!meta) return null
  const collapsed = meta.sidebarCollapsed
  const enabled = meta.enabledComponents.map(getManifest).filter((m): m is ComponentManifest => !!m)
  const available = allManifests().filter((m) => !meta.enabledComponents.includes(m.type))

  const addTool = async (m: ComponentManifest) => {
    setAddOpen(false)
    if (await toolHasContent(m.type)) setRestoring(m)
    else useProjectStore.getState().enableComponent(m.type)
  }
  const finishRestore = async (choice: RestoreChoice) => {
    const m = restoring
    setRestoring(null)
    if (!m || !choice) return
    if (choice === 'delete') await deleteToolContent(m.type)
    useProjectStore.getState().enableComponent(m.type)
  }
  const closeTool = async (m: ComponentManifest) => {
    setToolMenu(null)
    if (await toolHasContent(m.type)) setClosing(m)
    else await hideTool(m.type)
  }
  const finishClose = async (choice: CloseChoice) => {
    const m = closing
    setClosing(null)
    if (!m || !choice) return
    await hideTool(m.type)
    if (choice === 'delete') await deleteToolContent(m.type)
  }

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
                  title={`${m.name} (Shift-click to open next to the others)`}
                  onClick={(e) => (e.shiftKey ? openComponent(m.type) : void replaceWithComponent(m.type))}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setToolMenu({ manifest: m, x: e.clientX, y: e.clientY })
                  }}
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
                        onClick={(e) => (e.shiftKey ? openComponent(m.type, d.id) : void replaceWithComponent(m.type, d.id))}
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
        <div style={{ position: 'relative' }} data-tour="add-component">
          <button className="sidebar-row" title="Add tool" onClick={() => setAddOpen(!addOpen)}>
            <Plus size={16} />
            {!collapsed && <span>Add tool</span>}
          </button>
          {addOpen && (
            <div className="menu" style={{ bottom: '100%', left: 4 }} onMouseLeave={() => setAddOpen(false)}>
              {available.map((m) => (
                <button key={m.type} onClick={() => void addTool(m)}>
                  {m.name}
                </button>
              ))}
              {available.length === 0 && <div className="sidebar-menu-note">Every tool is already added.</div>}
            </div>
          )}
        </div>
        {toolMenu && (
          <div className="menu-backdrop" onMouseDown={() => setToolMenu(null)} onContextMenu={(e) => e.preventDefault()}>
            <div className="menu" style={{ position: 'fixed', left: toolMenu.x, top: toolMenu.y }} onMouseDown={(e) => e.stopPropagation()}>
              <button className="danger" onClick={() => void closeTool(toolMenu.manifest)}>
                Close tool
              </button>
            </div>
          </div>
        )}
        {closing && <CloseToolDialog manifest={closing} onDone={(c) => void finishClose(c)} />}
        {restoring && <RestoreToolDialog manifest={restoring} onDone={(c) => void finishRestore(c)} />}
        <button className="sidebar-row" title="Project look" data-tour="project-look" onClick={() => setThemeOpen(true)}>
          <Palette size={16} />
          {!collapsed && <span>Project look</span>}
        </button>
        {themeOpen && <ProjectThemeDialog onClose={() => setThemeOpen(false)} />}
        <button className="sidebar-row" title="Settings" onClick={openSettings}>
          <Settings size={16} />
          {!collapsed && <span>Settings</span>}
        </button>
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

