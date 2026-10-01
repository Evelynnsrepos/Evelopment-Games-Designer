/** Is the event target a text field, so list shortcuts (Delete, Ctrl+A) should not apply? */
export const isTyping = (target: EventTarget) =>
  target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable="true"]')
