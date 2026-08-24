import type { ProcessOptions, ProcessResult, WorkerRequest, WorkerResponse } from '../core/types'

export interface ImageProcessor {
  process(
    blob: Blob,
    options: ProcessOptions,
    onStage?: (stage: string) => void,
  ): Promise<ProcessResult>
  dispose(): void
}

let jobSeq = 0
const nextJobId = () => `job_${Date.now().toString(36)}_${++jobSeq}`

export function defaultPoolSize(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2
  return Math.min(4, Math.max(2, cores - 1))
}

interface QueuedTask {
  blob: Blob
  options: ProcessOptions
  onStage?: (stage: string) => void
  resolve: (r: ProcessResult) => void
  reject: (e: Error) => void
}

export class WorkerPool implements ImageProcessor {
  private workers: Worker[] = []
  private idle: Worker[] = []
  private pending = new Map<Worker, QueuedTask>()
  private queue: QueuedTask[] = []
  private disposed = false

  constructor(size: number = defaultPoolSize()) {
    for (let i = 0; i < size; i++) this.workers.push(this.spawn())
  }

  private spawn(): Worker {
    const worker = new Worker(new URL('./process.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.handle(worker, e.data)
    worker.onerror = () => this.failWorker(worker, new Error('处理线程异常'))
    worker.onmessageerror = () => this.failWorker(worker, new Error('线程通信失败'))
    this.idle.push(worker)
    return worker
  }

  private settle(worker: Worker): QueuedTask | undefined {
    const task = this.pending.get(worker)
    this.pending.delete(worker)
    this.idle.push(worker)
    this.drain()
    return task
  }

  private handle(worker: Worker, msg: WorkerResponse): void {
    const task = this.pending.get(worker)
    if (!task || !msg) return
    if (msg.type === 'progress') {
      task.onStage?.(msg.stage)
      return
    }
    const settled = this.settle(worker)
    if (!settled) return
    if (msg.type === 'done') settled.resolve(msg.result)
    else settled.reject(new Error(`${msg.message}（${msg.code}）`))
  }

  private failWorker(worker: Worker, error: Error): void {
    const task = this.pending.get(worker)
    this.pending.delete(worker)
    if (task) task.reject(error)
    worker.terminate()
    this.workers = this.workers.filter((w) => w !== worker)
    this.idle = this.idle.filter((w) => w !== worker)
    try {
      this.workers.push(this.spawn())
    } catch {
      /* 环境不支持时忽略重建 */
    }
    this.drain()
  }

  process(blob: Blob, options: ProcessOptions, onStage?: (s: string) => void): Promise<ProcessResult> {
    if (this.disposed) return Promise.reject(new Error('处理器已释放'))
    return new Promise((resolve, reject) => {
      this.queue.push({ blob, options, onStage, resolve, reject })
      this.drain()
    })
  }

  private drain(): void {
    while (this.queue.length > 0 && this.idle.length > 0) {
      const worker = this.idle.pop()
      const task = this.queue.shift()
      if (!worker || !task) break
      this.pending.set(worker, task)
      const req: WorkerRequest = {
        type: 'process',
        job: { jobId: nextJobId(), blob: task.blob, options: task.options },
      }
      worker.postMessage(req)
    }
  }

  dispose(): void {
    this.disposed = true
    for (const w of this.workers) w.terminate()
    this.workers = []
    this.idle = []
    const err = new Error('处理器已释放')
    for (const [, task] of this.pending) task.reject(err)
    this.pending.clear()
    for (const t of this.queue) t.reject(err)
    this.queue = []
  }
}

class MainThreadProcessor implements ImageProcessor {
  async process(
    blob: Blob,
    options: ProcessOptions,
    onStage?: (s: string) => void,
  ): Promise<ProcessResult> {
    const { runPipeline } = await import('../core/pipeline')
    return runPipeline(blob, options, onStage)
  }
  dispose(): void {}
}

export function createProcessor(): ImageProcessor {
  if (typeof Worker === 'undefined') return new MainThreadProcessor()
  try {
    return new WorkerPool()
  } catch {
    return new MainThreadProcessor()
  }
}
