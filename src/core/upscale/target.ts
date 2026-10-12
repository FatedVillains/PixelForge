import type { TargetPlan, UpscaleTarget } from './types'

export const MAX_SIDE = 32768
export const HARD_MAX_SIDE = 64000

export const RESOLUTION_PRESETS: Array<{ label: string; longSide: number }> = [
  { label: '2K', longSide: 2560 },
  { label: '4K', longSide: 3840 },
  { label: '8K', longSide: 7680 },
  { label: '16K', longSide: 15360 },
]

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function scaleSuffix(scale: number): string {
  return `${round1(scale)}x`
}

/**
 * 根据目标设置求解输出尺寸与采样区域。
 * 所有模式默认保持比例，绝不默认拉伸。
 */
export function solveTarget(
  srcW: number,
  srcH: number,
  target: UpscaleTarget,
): TargetPlan {
  const srcRatio = srcW / srcH

  if (target.mode === 'scale') {
    const scale = target.scale && target.scale > 0 ? target.scale : 2
    const outW = Math.round(srcW * scale)
    const outH = Math.round(srcH * scale)
    return full(outW, outH, scaleSuffix(scale), srcW, srcH)
  }

  if (target.mode === 'resolution') {
    const longSide = target.resolution ?? 3840
    const scale = longSide / Math.max(srcW, srcH)
    const outW = Math.round(srcW * scale)
    const outH = Math.round(srcH * scale)
    const preset = RESOLUTION_PRESETS.find((p) => p.longSide === longSide)
    return full(outW, outH, preset ? preset.label : `${longSide}px`, srcW, srcH)
  }

  /* custom */
  let outW = Math.round(target.width ?? 0)
  let outH = Math.round(target.height ?? 0)
  if (target.keepAspectRatio) {
    if (outW > 0) outH = Math.max(1, Math.round(outW / srcRatio))
    else if (outH > 0) outW = Math.max(1, Math.round(outH * srcRatio))
  }
  if (outW <= 0 && outH <= 0) {
    outW = srcW * 2
    outH = srcH * 2
  } else if (outW <= 0) {
    outW = Math.max(1, Math.round(outH * srcRatio))
  } else if (outH <= 0) {
    outH = Math.max(1, Math.round(outW / srcRatio))
  }

  const suffix = `${outW}x${outH}`
  const mode = target.keepAspectRatio ? 'fit' : target.aspectMode
  const outRatio = outW / outH

  if (mode === 'stretch' || Math.abs(outRatio - srcRatio) < 1e-6) {
    return full(outW, outH, suffix, srcW, srcH)
  }

  if (mode === 'fit') {
    /* 保持比例：收缩到能完整放入目标框 */
    const s = Math.min(outW / srcW, outH / srcH)
    const w = Math.max(1, Math.round(srcW * s))
    const h = Math.max(1, Math.round(srcH * s))
    return full(w, h, suffix, srcW, srcH)
  }

  if (mode === 'crop') {
    /* 裁剪：取源图居中 cover 区域，采样后填满输出 */
    let cw = srcW
    let ch = srcH
    if (srcRatio > outRatio) {
      cw = Math.round(srcH * outRatio)
    } else {
      ch = Math.round(srcW / outRatio)
    }
    return {
      outW,
      outH,
      srcX: Math.round((srcW - cw) / 2),
      srcY: Math.round((srcH - ch) / 2),
      srcW: cw,
      srcH: ch,
      dstX: 0,
      dstY: 0,
      dstW: outW,
      dstH: outH,
      suffix,
    }
  }

  /* fill：重采样到能完整放入的尺寸，居中贴到透明画布 */
  const s = Math.min(outW / srcW, outH / srcH)
  const w = Math.max(1, Math.round(srcW * s))
  const h = Math.max(1, Math.round(srcH * s))
  return {
    outW,
    outH,
    srcX: 0,
    srcY: 0,
    srcW: srcW,
    srcH: srcH,
    dstX: Math.round((outW - w) / 2),
    dstY: Math.round((outH - h) / 2),
    dstW: w,
    dstH: h,
    suffix,
  }
}

function full(outW: number, outH: number, suffix: string, srcW: number, srcH: number): TargetPlan {
  return {
    outW,
    outH,
    srcX: 0,
    srcY: 0,
    srcW,
    srcH,
    dstX: 0,
    dstY: 0,
    dstW: outW,
    dstH: outH,
    suffix,
  }
}

/** 校验输出尺寸是否在安全范围内 */
export function checkOutputLimits(
  outW: number,
  outH: number,
): { ok: boolean; warn: boolean; reason?: string } {
  if (outW > HARD_MAX_SIDE || outH > HARD_MAX_SIDE) {
    return {
      ok: false,
      warn: false,
      reason: `目标尺寸 ${outW}×${outH} 超过硬性上限 ${HARD_MAX_SIDE}×${HARD_MAX_SIDE}，无法处理`,
    }
  }
  if (outW > MAX_SIDE || outH > MAX_SIDE) {
    return {
      ok: true,
      warn: true,
      reason: `目标尺寸 ${outW}×${outH} 超过 ${MAX_SIDE}×${MAX_SIDE}，可能超出浏览器画布限制导致失败`,
    }
  }
  return { ok: true, warn: false }
}
