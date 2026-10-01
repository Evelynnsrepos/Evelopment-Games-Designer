import { FolderOpen, Image, MoreHorizontal, Moon, Plus, Sun, Type } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getFs } from '@/core/fs'
import type { RecentProject } from '@/core/model'
import { deleteProject, isProjectFolder, loadProject, readRecents, removeRecent, saveMeta, upsertRecent } from '@/core/project'
import { useAppStore, useProjectStore } from '@/core/state'
import { confirmDialog, promptDialog } from '@/shared/dialogs'
import { toggleTheme, useTheme } from '../theme'
import './launcher.css'

/** Project list shown on startup (spec 4, PM-1..PM-8). */
export function Launcher() {
  const [projects, setProjects] = useState<RecentProject[] | null>(null)
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const theme = useTheme()

  const refresh = useCallback(async () => {
    const list = await readRecents()
    const gone = new Set<string>()
    for (const p of list) if (!(await isProjectFolder(p.path))) gone.add(p.path)
    setMissing(gone)
    setProjects(list)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const open = async (path: string) => {
    try {
      setError(null)
      await useProjectStore.getState().open(path)
      useAppStore.getState().go('editor')
    } catch (e) {
      setError(`Could not open project: ${(e as Error).message}`)
    }
  }

  const openExisting = async () => {
    const path = await getFs().pickFolder('Open a project folder')
    if (!path) return
    if (!(await isProjectFolder(path))) {
      setError('That folder is not an Evelopment Games Designer project (no project.json).')
      return
    }
    await open(path)
  }

  return (
    <div className="launcher">
      <header className="launcher-header">
        <div>
          <h1>Evelopment Games Designer</h1>
          <div className="muted">Your game projects</div>
        </div>
        <div className="launcher-actions">
          <button className="icon-btn" title="Toggle light/dark theme" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="btn" onClick={() => void openExisting()}>
            <FolderOpen size={16} /> Open existing folder
          </button>
          <button className="btn btn-primary" onClick={() => useAppStore.getState().go('new-project')}>
            <Plus size={16} /> New Project
          </button>
        </div>
      </header>

      {error && <div className="launcher-error">{error}</div>}

      {projects && projects.length === 0 && (
        <div className="launcher-empty">
          <h2>No projects yet</h2>
          <p className="muted">Create your first game project to get started.</p>
          <button className="btn btn-primary" onClick={() => useAppStore.getState().go('new-project')}>
            <Plus size={16} /> New Project
          </button>
        </div>
      )}

      <div className="project-grid">
        {projects?.map((p) => (
          <ProjectCard key={p.path} project={p} missing={missing.has(p.path)} onOpen={() => void open(p.path)} onChanged={refresh} />
        ))}
      </div>
    </div>
  )
}

function ProjectCard({ project, missing, onOpen, onChanged }: { project: RecentProject; missing: boolean; onOpen: () => void; onChanged: () => void }) {
  const [menu, setMenu] = useState(false)

  const editMeta = async (field: 'name' | 'description') => {
    const value = await promptDialog(field === 'name' ? 'Rename project' : 'Edit description', project[field])
    if (value === null || (field === 'name' && !value.trim())) return
    const loaded = await loadProject(project.path)
    const meta = { ...loaded.meta, [field]: value.trim() }
    await saveMeta(project.path, meta)
    await upsertRecent({ ...project, name: meta.name, description: meta.description })
    onChanged()
  }

  const remove = async () => {
    const ok = await confirmDialog({
      title: `Delete "${project.name}"?`,
      message: `This permanently deletes the project folder and everything in it:\n${project.path}`,
      confirmLabel: 'Delete project',
      danger: true,
    })
    if (!ok) return
    await deleteProject(project.path)
    await removeRecent(project.path)
    onChanged()
  }

  return (
    <div className={`project-card${missing ? ' missing' : ''}`}>
      <button className="project-card-main" onClick={onOpen} disabled={missing}>
        <h3>{project.name}</h3>
        {project.description && <p className="muted">{project.description}</p>}
        <div className="project-stats">
          {missing ? (
            <span>Folder not found</span>
          ) : (
            <>
              <span title="Words">
                <Type size={13} /> {project.stats.words.toLocaleString()} words
              </span>
              <span title="Images">
                <Image size={13} /> {project.stats.images.toLocaleString()} images
              </span>
            </>
          )}
        </div>
      </button>
      <button className="icon-btn project-card-menu" title="Project menu" onClick={() => setMenu(!menu)}>
        <MoreHorizontal size={16} />
      </button>
      {menu && (
        <div className="menu" style={{ top: 40, right: 8 }} onMouseLeave={() => setMenu(false)}>
          {missing ? (
            <button
              onClick={async () => {
                await removeRecent(project.path)
                onChanged()
              }}
            >
              Remove from list
            </button>
          ) : (
            <>
              <button onClick={() => void editMeta('name')}>Rename</button>
              <button onClick={() => void editMeta('description')}>Edit description</button>
              <button onClick={() => void getFs().revealInFolder(project.path)}>Show in folder</button>
              <button className="danger" onClick={() => void remove()}>
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
