import { onUnmounted, ref } from 'vue'

/**
 * 通用「确认」弹窗状态。
 * 关键点：同一时刻只允许一个待结算的 Promise；
 * 新弹窗与组件卸载都会先以 false 结算旧 Promise，避免调用方永久 await。
 */
export function useConfirmDialog() {
  const visible = ref(false)
  const reason = ref('')
  let settleFn: ((ok: boolean) => void) | null = null

  function settle(ok: boolean): void {
    visible.value = false
    const fn = settleFn
    settleFn = null
    fn?.(ok)
  }

  function ask(text: string): Promise<boolean> {
    settle(false)
    reason.value = text
    visible.value = true
    return new Promise<boolean>((resolve) => {
      settleFn = resolve
    })
  }

  onUnmounted(() => settle(false))

  return { visible, reason, ask, settle }
}
