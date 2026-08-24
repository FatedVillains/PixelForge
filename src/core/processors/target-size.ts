export type EncodeProbe = (quality: number, scale: number) => Promise<number>

export interface TargetSolveOptions {
  minScale?: number
  maxEncodes?: number
}

export interface TargetSolveResult {
  quality: number
  scale: number
  fitsTarget: boolean
  encodes: number
}

export async function solveTargetSize(
  targetBytes: number,
  probe: EncodeProbe,
  opts: TargetSolveOptions = {},
): Promise<TargetSolveResult> {
  const minScale =
    opts.minScale !== undefined && opts.minScale > 0 ? opts.minScale : 0.1
  const maxEncodes = opts.maxEncodes ?? 48

  const cache = new Map<string, number>()
  let encodes = 0

  const cachedProbe = async (q: number, s: number): Promise<number> => {
    const key = `${q}@${s.toFixed(3)}`
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    if (encodes >= maxEncodes) throw new Error('encode-budget-exhausted')
    encodes += 1
    const size = await probe(q, s)
    cache.set(key, size)
    return size
  }

  /** 当前 scale 下最大满足 size<=target 的质量；无则 null */
  const searchQuality = async (scale: number): Promise<number | null> => {
    const smallest = await cachedProbe(1, scale)
    if (smallest > targetBytes) return null
    let lo = 1
    let hi = 100
    while (lo < hi) {
      const mid = Math.ceil((lo + hi + 1) / 2)
      const size = await cachedProbe(mid, scale)
      if (size <= targetBytes) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  let scale = 1
  let bestEffort: TargetSolveResult | null = null

  for (;;) {
    try {
      const q = await searchQuality(scale)
      if (q !== null) {
        return { quality: q, scale, fitsTarget: true, encodes }
      }
      bestEffort = { quality: 1, scale, fitsTarget: false, encodes }
    } catch (err) {
      if (!(err instanceof Error && err.message === 'encode-budget-exhausted')) {
        throw err
      }
      break // 编码预算耗尽
    }
    scale = Number((scale * 0.85).toFixed(3))
    if (scale < minScale) break
  }

  if (!bestEffort) throw new Error('encode-budget-exhausted')
  return bestEffort
}
