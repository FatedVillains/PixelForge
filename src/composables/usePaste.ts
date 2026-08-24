import { onMounted, onUnmounted } from 'vue'

export function usePaste(onFiles: (files: File[]) => void): void {
  const handler = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      if (item.kind !== 'file') continue
      const f = item.getAsFile()
      if (f && f.type.startsWith('image/')) files.push(f)
    }
    if (files.length > 0) {
      e.preventDefault()
      onFiles(files)
    }
  }
  onMounted(() => window.addEventListener('paste', handler))
  onUnmounted(() => window.removeEventListener('paste', handler))
}
