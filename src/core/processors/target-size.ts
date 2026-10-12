export type EncodeProbe = (quality: number, scale: number) => Promise<number>

export interface TargetSolveOptions {
  minScale?: number
  maxEncodes?: number
  /** 搜索时间预算（毫秒）；超时立即停止并返回当前最佳结果 */
  maxDurationMs?: number
  /** 每次真实编码后回调，用于进度提示 */
  onProbe?: (encodes: number, maxEncodes: number) => void
}

export interface TargetSolveResult {
  quality: number
  scale: number
  fitsTarget: boolean
  encodes: number
  /** 因预算耗尽而提前收敛 */
  budgetExhausted: boolean
}

/** 内部信号：编码次数或时间预算耗尽（不向调用方抛出） */
class BudgetExhausted extends Error {
  constructor() {
    super('encode-budget-exhausted')
  }
}

export async function solveTargetSize(
  targetBytes: number,
  probe: EncodeProbe,
  opts: TargetSolveOptions = {},
): Promise<TargetSolveResult> {
  const minScale =
    opts.minScale !== undefined && opts.minScale > 0 ? opts.minScale : 0.1
  const maxEncodes = opts.maxEncodes ?? 48
  const maxDurationMs = opts.maxDurationMs ?? 0
  const started = Date.now()

  const cache = new Map<string, number>()
  let encodes = 0
  let budgetExhausted = false

  const cachedProbe = async (q: number, s: number): Promise<number> => {
    const key = `${q}@${s.toFixed(3)}`
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    if (encodes >= maxEncodes) {
      budgetExhausted = true
      throw new BudgetExhausted()
    }
    if (maxDurationMs > 0 && encodes > 0 && Date.now() - started > maxDurationMs) {
      budgetExhausted = true
      throw new BudgetExhausted()
    }
    encodes += 1
    const size = await probe(q, s)
    cache.set(key, size)
    opts.onProbe?.(encodes, maxEncodes)
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
        return { quality: q, scale, fitsTarget: true, encodes, budgetExhausted }
      }
      bestEffort = {
        quality: 1,
        scale,
        fitsTarget: false,
        encodes,
        budgetExhausted,
      }
    } catch (err) {
      if (!(err instanceof BudgetExhausted)) throw err
      break // 预算耗尽：用已探到的最佳结果收敛
    }
    scale = Number((scale * 0.85).toFixed(3))
    if (scale < minScale) break
  }

  if (!bestEffort) throw new Error('encode-budget-exhausted')
  /* 预算在最后一轮搜索中途耗尽时，把已发生的收敛状态带出去 */
  return { ...bestEffort, budgetExhausted }
}
