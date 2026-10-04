/**
 * Ask your project (v0.10): find the notes that matter for a question, so the
 * local AI helper only reads a few entries instead of the whole project.
 */

export interface Note {
  /** e.g. "Character: Lady Mira". */
  title: string
  text: string
  /** Where to open it. */
  ref: { kind: string; id: string; type?: string }
}

const STOP = new Set(
  'the and for are was were what who whom whose which when where why how does did has have had with from that this these those there their them they you your his her its our not but can could would should will into about than then also any all some one two much many very just only der die das und oder ist sind war wer wie was wann warum welche welcher mit von für nicht ein eine einen einem einer den dem des auf aus bei'.split(' '),
)

export function terms(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])].filter((t) => !STOP.has(t))
}

/** Notes ranked by how often the question's words appear (title matches count triple), up to a size budget. */
export function pick(notes: Note[], question: string, budget = 6000): Note[] {
  const qs = terms(question)
  if (!qs.length) return []
  const scored = notes
    .map((n) => {
      const title = n.title.toLowerCase()
      const body = n.text.toLowerCase()
      let score = 0
      for (const t of qs) {
        if (title.includes(t)) score += 3
        score += Math.min(5, body.split(t).length - 1)
      }
      return { n, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  const out: Note[] = []
  let used = 0
  for (const { n } of scored) {
    const size = n.title.length + Math.min(n.text.length, 1500) + 8
    if (used + size > budget) continue
    out.push(n)
    used += size
  }
  return out
}

/** The notes as the AI reads them. */
export const notesText = (notes: Note[]) => notes.map((n) => `## ${n.title}\n${n.text.slice(0, 1500)}`).join('\n\n')

/**
 * Requests to write something new (a story, a scene, dialogue, names, ideas).
 * The tool only answers about what is already written, so these are turned
 * away before the AI is asked.
 */
export function asksToWrite(question: string): boolean {
  const q = question.toLowerCase()
  return /\b(write|rewrite|generate|create|invent|make up|come up with|compose|continue|draft|brainstorm|suggest|give me (some |a |an )?(idea|name|story|plot|quest|dialogue))\b/.test(q) ||
    /\b(schreib|schreibe|erfinde|generier|erstelle|denk dir|ausdenken|fortsetz)/.test(q)
}
