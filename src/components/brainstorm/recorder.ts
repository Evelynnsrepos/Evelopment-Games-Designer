import { useEffect, useRef, useState } from 'react'

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']

export const RECORDER_TEXT = {
  noMic: 'Recording needs a microphone, and permission to use it.',
  unsupported: 'Recording is not supported here.',
}

/**
 * Voice clips from the microphone (BB-4, Q10). `start()` asks for the mic;
 * `stop()` hands the finished clip to `onClip`.
 */
export function useVoiceRecorder(onClip: (blob: Blob) => void, onError: (message: string) => void) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const onClipRef = useRef(onClip)
  useEffect(() => {
    onClipRef.current = onClip
  })

  // Re-render once a second for the elapsed time.
  useEffect(() => {
    if (startedAt === null) return
    const t = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [startedAt])

  // Stop the microphone when the board closes mid-recording (the clip is discarded).
  useEffect(
    () => () => {
      const r = recorder.current
      if (r && r.state !== 'inactive') {
        r.ondataavailable = null
        r.onstop = null
        r.stop()
        r.stream.getTracks().forEach((t) => t.stop())
      }
    },
    [],
  )

  const start = async () => {
    if (recorder.current) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError(RECORDER_TEXT.unsupported)
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      onError(RECORDER_TEXT.noMic)
      return
    }
    const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m))
    const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: Blob[] = []
    r.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      recorder.current = null
      setStartedAt(null)
      if (chunks.length) onClipRef.current(new Blob(chunks, { type: (r.mimeType || mimeType || 'audio/webm').split(';')[0] }))
    }
    recorder.current = r
    r.start()
    const t = Date.now()
    setStartedAt(t)
    setNow(t)
  }

  const stop = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }

  const elapsed = startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000))
  return { recording: startedAt !== null, start, stop, elapsed }
}

export function formatSeconds(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
