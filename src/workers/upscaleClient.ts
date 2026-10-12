import UpscaleWorker from './upscale.worker?worker&inline'
import type {
  UpscaleOptions,
  UpscaleProgress,
  UpscaleResult,
  WorkerOut,
} from '../core/upscale/types'
import { runUpscalePipeline } from '../core/upscale/pipeline'

let jobSeq = 0
const nextJobId = () => `up_${Date.now().toString(36)}_${++jobSeq}`

export interface UpscaleJobHandle {
  promise: Promise<UpscaleResult>
  cancel: () => void
}

/**
 * `?worker&inline` 每次实例化都要重新生成并求值同一段 blob 脚本。
 * 这里缓存一个已用完的 Worker 供下次复用，避免批量处理时反复解析脚本。
 * 取消会把 Worker terminate 掉（不复用），因为只有 terminate 才能立即释放大图内存。
 */
let idleWorker: Worker | null = null

function acquireWorker(): Worker {
  if (idleWorker) {
    const w = idleWorker
    idleWorker = null
    return w
  }
  return new UpscaleWorker()
}

function releaseWorker(w: Worker): void {
  w.onmessage = null
  w.onerror = null
  idleWorker = w
}

/** 提交一个高清放大任务。单任务独占一个 Worker，取消时立即 terminate。 */
export function runUpscaleJob(
  blob: Blob,
  options: UpscaleOptions,
  onProgress?: (p: UpscaleProgress) => void,
): UpscaleJobHandle {
  if (typeof Worker === 'undefined') {
    let cancelled = false
    return {
      promise: runUpscalePipeline(blob, options, onProgress, () => cancelled),
      cancel: () => {
        cancelled = true
      },
    }
  }

  const jobId = nextJobId()
  let worker: Worker
  try {
    worker = acquireWorker()
  } catch {
    let cancelled = false
    return {
      promise: runUpscalePipeline(blob, options, onProgress, () => cancelled),
      cancel: () => {
        cancelled = true
      },
    }
  }

  let settled = false
  let rejectFn: (e: Error) => void = () => {}
  const promise = new Promise<UpscaleResult>((resolve, reject) => {
    rejectFn = reject
    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const msg = e.data
      if (!msg || msg.jobId !== jobId) return
      if (msg.type === 'progress') {
        onProgress?.({ percent: msg.percent, stage: msg.stage, detail: msg.detail })
        return
      }
      settled = true
      if (msg.type === 'done') {
        releaseWorker(worker)
        resolve(msg.result)
      } else {
        worker.terminate()
        if (msg.type === 'cancelled') reject(new Error('已取消'))
        else reject(new Error(msg.message))
      }
    }
    worker.onerror = () => {
      if (settled) return
      settled = true
      worker.terminate()
      reject(new Error('处理线程异常'))
    }
    worker.postMessage({ type: 'upscale', jobId, blob, options })
  })

  return {
    promise,
    cancel: () => {
      if (settled) return
      settled = true
      try {
        worker.postMessage({ type: 'cancel', jobId })
      } catch {
        /* 忽略 */
      }
      worker.terminate()
      rejectFn(new Error('已取消'))
    },
  }
}
