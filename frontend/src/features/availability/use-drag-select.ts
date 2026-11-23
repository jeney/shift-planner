import { useEffect, useState } from 'react'

export interface DragState {
  employeeId: string
  from: string
  to: string
}

/**
 * Pointer drag across day cells. `onCommit` runs on release with the dragged range
 * (from === to for a simple click). Keyboard users activate cells with Enter/Space instead.
 */
export function useDragSelect(onCommit: (drag: DragState) => void) {
  const [drag, setDrag] = useState<DragState | null>(null)

  useEffect(() => {
    if (!drag) return
    const finish = () => {
      onCommit(drag)
      setDrag(null)
    }
    const cancel = () => setDrag(null)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [drag, onCommit])

  const cellProps = (employeeId: string, date: string) => ({
    onPointerDown: (event: React.PointerEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      setDrag({ employeeId, from: date, to: date })
    },
    onPointerEnter: () => {
      setDrag((d) => (d && d.employeeId === employeeId ? { ...d, to: date } : d))
    },
  })

  const isSelected = (employeeId: string, date: string) => {
    if (!drag || drag.employeeId !== employeeId) return false
    const [a, b] = drag.from <= drag.to ? [drag.from, drag.to] : [drag.to, drag.from]
    return a <= date && date <= b
  }

  return { cellProps, isSelected, dragging: drag !== null }
}
