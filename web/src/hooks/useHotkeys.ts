import { useEffect } from 'react'

type HotkeyMap = Record<string, (e: KeyboardEvent) => void>

// Lightweight global keydown dispatcher — ignores keystrokes while typing in
// an input/textarea so shortcuts don't interfere with normal text entry.
export function useHotkeys(map: HotkeyMap, deps: unknown[] = []) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const isTyping = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (isTyping && e.key !== 'Escape') return

      const handler = map[e.key]
      if (handler) handler(e)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
