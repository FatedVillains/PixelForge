import type { ResizeOptions } from '../types'

export interface Dimensions {
  width: number
  height: number
}

export function computeTargetDimensions(
  original: Dimensions,
  target: ResizeOptions | undefined,
): Dimensions {
  if (!target || (!target.width && !target.height)) return { ...original }
  let width = Math.round(target.width ?? 0)
  let height = Math.round(target.height ?? 0)
  if (target.keepAspectRatio) {
    const ratio = original.height / original.width
    if (width > 0) {
      height = Math.round(width * ratio)
    } else if (height > 0) {
      width = Math.round(height / ratio)
    }
  }
  width = Math.min(Math.max(width || original.width, 1), 20000)
  height = Math.min(Math.max(height || original.height, 1), 20000)
  return { width, height }
}

export function stepDownPlan(fromW: number, fromH: number, toW: number, toH: number): Dimensions[] {
  const plan: Dimensions[] = []
  let w = fromW
  let h = fromH
  while (w > toW * 2 && h > toH * 2) {
    w = Math.max(toW, Math.round(w / 2))
    h = Math.max(toH, Math.round(h / 2))
    plan.push({ width: w, height: h })
  }
  const last = plan[plan.length - 1]
  if (!last || last.width !== toW || last.height !== toH) {
    plan.push({ width: toW, height: toH })
  }
  return plan
}
