/// <reference lib="webworker" />
import { runUpscalePipeline } from '../core/upscale/pipeline'
import { UpscaleCancelled } from '../core/upscale/types'
import type { WorkerIn, WorkerOut } from '../core/upscale/types'

const post = (msg: WorkerOut) => {
  ;(self as unknown as Worker).postMessage(msg)
}

const cancelledJobs = new Set<string>()

self.onmessage = async (event: MessageEvent<WorkerIn>) => {
  const data = event.data
  if (!data) return
  if (data.type === 'cancel') {
    cancelledJobs.add(data.jobId)
    return
  }
  if (data.type !== 'upscale') return
  const { jobId, blob, options } = data
  try {
    const result = await runUpscalePipeline(
      blob,
      options,
      (p) => post({ type: 'progress', jobId, ...p }),
      () => cancelledJobs.has(jobId),
    )
    post({ type: 'done', jobId, result })
  } catch (err) {
    if (err instanceof UpscaleCancelled || cancelledJobs.has(jobId)) {
      post({ type: 'cancelled', jobId })
    } else {
      post({
        type: 'error',
        jobId,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  } finally {
    cancelledJobs.delete(jobId)
  }
}
