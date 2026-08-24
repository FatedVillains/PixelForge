import { reactive } from 'vue'

export interface ToastItem {
  id: number
  kind: 'error' | 'info' | 'success'
  text: string
}

const state = reactive<{ items: ToastItem[] }>({ items: [] })
let seq = 0

export function useToast() {
  function push(kind: ToastItem['kind'], text: string, duration = 4000) {
    const id = ++seq
    state.items.push({ id, kind, text })
    setTimeout(() => dismiss(id), duration)
  }
  function dismiss(id: number) {
    const idx = state.items.findIndex((t) => t.id === id)
    if (idx !== -1) state.items.splice(idx, 1)
  }
  return { state, push, dismiss }
}
