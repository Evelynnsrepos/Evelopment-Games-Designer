import { isTauri } from '@/core/fs'

/** Adds `https://` when the user typed a bare address like `example.com`. Null for empty or unsafe input. */
export function normalizeUrl(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (/^(https?:|mailto:)/i.test(s)) return s
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null // other schemes (javascript:, file:, ...) are not opened
  return `https://${s}`
}

/** Open a web address in the system browser (desktop) or a new tab (browser dev build). */
export async function openExternalUrl(input: string): Promise<void> {
  const url = normalizeUrl(input)
  if (!url) return
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
