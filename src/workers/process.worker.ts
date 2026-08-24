/// <reference lib="webworker" />
import { runPipeline } from '../core/pipeline'
import type { ProcessErrorCode, WorkerRequest, WorkerResponse } from '../core/types'

const post = (msg: WorkerResponse) => {
  ;(self as unknown as Worker).postMessage(msg)
}

function classifyError(err: unknown): ProcessErrorCode {
  const msg = err instanceof Error ? err.message : String(err)
  if (/解码/.test(msg)) return 'decode'
  if (/内存|allocation|MemoryError/i.test(msg)) return 'memory'
  if (/PNG|目标大小/.test(msg)) return 'target-unreachable'
  if (/编码/.test(msg)) return 'encode'
  return 'unknown'
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const data = event.data
  if (!data || data.type !== 'process') return
  const { job } = data
  try {
    const result = await runPipeline(job.blob, job.options, (stage) => {
      post({ type: 'progress', jobId: job.jobId, stage })
    })
    post({ type: 'done', jobId: job.jobId, result })
  } catch (err) {
    post({
      type: 'error',
      jobId: job.jobId,
      code: classifyError(err),
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
