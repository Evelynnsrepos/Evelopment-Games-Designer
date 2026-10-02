import { BookOpen, Compass, Palette, Rocket, Save, Link2, LayoutPanelLeft, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { allManifests } from '@/core/registry'
import { useAppStore } from '@/core/state'
import { Modal } from '@/shared/ui'
import { BASICS, TOOL_GUIDE, type GuideTopic } from './guide'
import { placeCard, TOURS, useHelp } from './help'
import './help.css'

const BASIC_ICONS = { start: Rocket, workspace: LayoutPanelLeft, saving: Save, links: Link2, look: Palette }

/** Mount once at the app root: user guide dialog, tours and the F1 shortcut. */
export function HelpHost() {
  const guide = useHelp((s) => s.guide)
  const tour = useHelp((s) => s.tour)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F1') return
      e.preventDefault()
      useHelp.getState().openGuide()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {guide && <GuideDialog topic={guide} />}
      {tour && <Tour />}
    </>
  )
}

function GuideDialog({ topic }: { topic: string }) {
  const help = useHelp.getState()
  const current: GuideTopic | undefined = BASICS[topic] ?? TOOL_GUIDE[topic as keyof typeof TOOL_GUIDE]
  const screen = useAppStore((s) => s.screen)
  const tour = screen === 'editor' ? 'editor' : 'launcher'
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0)
  }, [topic])

  return (
    <Modal onClose={help.closeGuide}>
      <div className="help-guide">
        <header className="help-guide-header">
          <h3>
            <BookOpen size={18} /> User guide
          </h3>
          <button className="btn" onClick={() => help.startTour(tour)}>
            <Compass size={15} /> Take the tour
          </button>
          <button className="icon-btn" title="Close" onClick={help.closeGuide}>
            <X size={16} />
          </button>
        </header>
        <div className="help-guide-main">
          <nav className="help-guide-nav">
            <div className="help-guide-group">Basics</div>
            {Object.entries(BASICS).map(([key, t]) => {
              const Icon = BASIC_ICONS[key as keyof typeof BASIC_ICONS]
              return (
                <button key={key} className={key === topic ? 'active' : ''} onClick={() => help.openGuide(key)}>
                  <Icon size={14} /> {t.title}
                </button>
              )
            })}
            <div className="help-guide-group">Tools</div>
            {allManifests().map((m) => (
              <button key={m.type} className={m.type === topic ? 'active' : ''} onClick={() => help.openGuide(m.type)}>
                <m.icon size={14} /> {m.name}
              </button>
            ))}
          </nav>
          <div className="help-guide-body" ref={bodyRef}>
            {current && (
              <>
                <h2>{current.title}</h2>
                {current.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {current.tips && (
                  <ul className="help-guide-tips">
                    {current.tips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Tour() {
  const { tour, step, setStep, endTour } = useHelp()
  const steps = TOURS[tour!]
  const current = steps[Math.min(step, steps.length - 1)]
  const cardRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [pos, setPos] = useState({ left: -9999, top: -9999 })

  useLayoutEffect(() => {
    const measure = () => {
      const el = current.target ? document.querySelector(`[data-tour="${current.target}"]`) : null
      const r = el?.getBoundingClientRect() ?? null
      setRect(r && r.width > 0 ? r : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [current])

  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    const place = () => setPos(placeCard(rect, { width: card.offsetWidth, height: card.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }))
    place()
    // The card's size can change after the first paint (styles or fonts arriving).
    const observer = new ResizeObserver(place)
    observer.observe(card)
    return () => observer.disconnect()
  }, [rect, current])

  const last = step >= steps.length - 1
  const next = () => (last ? endTour() : setStep(step + 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault() // keep Esc from toggling Layout Mode (ED-7)
        e.stopPropagation()
        endTour()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      else if (e.key === 'ArrowLeft' && step > 0) setStep(step - 1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const pad = 6
  return (
    <div className="help-tour" role="dialog" aria-modal="true" aria-label="App tour">
      {rect ? (
        <div className="help-tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      ) : (
        <div className="help-tour-dim" />
      )}
      <div className="help-tour-card" ref={cardRef} style={pos}>
        <div className="help-tour-count">
          {step + 1} / {steps.length}
        </div>
        <h3>{current.title}</h3>
        <p>{current.text}</p>
        <div className="help-tour-actions">
          <button className="btn btn-ghost" onClick={endTour}>
            Skip tour
          </button>
          <span style={{ flex: 1 }} />
          {step > 0 && (
            <button className="btn" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button className="btn btn-primary" autoFocus onClick={next}>
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
