import { create } from 'zustand'

/** Promise-based dialogs: `await confirmDialog(...)`, `await promptDialog(...)`. Rendered by <DialogHost />. */
export type DialogRequest =
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; danger: boolean; resolve: (v: boolean) => void }
  | { kind: 'prompt'; title: string; initial: string; resolve: (v: string | null) => void }

export const useDialogs = create<{ current: DialogRequest | null; seq: number }>()(() => ({ current: null, seq: 0 }))

function show(current: DialogRequest) {
  useDialogs.setState((s) => ({ current, seq: s.seq + 1 }))
}

export function confirmDialog(opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }) {
  return new Promise<boolean>((resolve) => show({ kind: 'confirm', confirmLabel: 'OK', danger: false, ...opts, resolve }))
}

export function promptDialog(title: string, initial = '') {
  return new Promise<string | null>((resolve) => show({ kind: 'prompt', title, initial, resolve }))
}
