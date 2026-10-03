import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { RichTextEditor } from '@/shared/richtext/RichTextEditor'
import { ProofTextarea } from '@/shared/spell'

function Test() {
  const [v, setV] = useState('Their is to many goblin in the castel. The hero walk into the tavern and order a ale.\nDer Ritter gehen in die Burg und sieht einen Drache.')
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'She went to there house yesterday and buyed a sword.' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Ich habe keine Zeit gehabt weil der Boss zu schwer war.' }] }] }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'var(--bg)', padding: 30, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <label style={{ display: 'flex', flexDirection: 'column' }}>
        Text box
        <ProofTextarea id="pt" className="input" rows={5} value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      <div id="rt"><RichTextEditor value={doc as never} toolbar={false} /></div>
    </div>
  )
}
const host = document.createElement('div')
document.body.append(host)
createRoot(host).render(<Test />)
