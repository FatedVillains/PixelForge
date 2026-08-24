export type OutputFormat = 'jpeg' | 'png' | 'webp'
export type InputFormat = OutputFormat | 'bmp' | 'unknown'
export type CompressMode = 'quality' | 'targetSize'

export interface ResizeOptions {
  width: number
  height: number
  keepAspectRatio: boolean
}

export interface ProcessOptions {
  outputFormat: OutputFormat
  mode: CompressMode
  quality?: number
  targetSizeBytes?: number
  resize?: ResizeOptions
}

export interface ProcessResult {
  blob: Blob
  width: number
  height: number
  bytes: number
  format: OutputFormat
  iterations: number
  fitsTarget: boolean
}

export type AssetStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface ImageAsset {
  id: string
  name: string
  bytes: number
  format: InputFormat
  width: number
  height: number
  file: Blob
  thumbUrl?: string
  status: AssetStatus
  error?: string
  result?: ProcessResult
  resultUrl?: string
}

export type ProcessErrorCode =
  | 'decode'
  | 'encode'
  | 'memory'
  | 'target-unreachable'
  | 'unknown'

export interface ProcessJobInput {
  jobId: string
  blob: Blob
  options: ProcessOptions
}

export type WorkerRequest = { type: 'process'; job: ProcessJobInput }

export type WorkerResponse =
  | { type: 'progress'; jobId: string; stage: string }
  | { type: 'done'; jobId: string; result: ProcessResult }
  | { type: 'error'; jobId: string; code: ProcessErrorCode; message: string }
