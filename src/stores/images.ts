import { defineStore } from 'pinia'
import type { AssetStatus, ImageAsset, InputFormat, ProcessResult } from '../core/types'

let idSeq = 0

interface BatchState {
  active: boolean
  done: number
  total: number
  currentName: string
  finished: boolean
  successCount: number
  failedCount: number
}

const emptyBatch = (): BatchState => ({
  active: false,
  done: 0,
  total: 0,
  currentName: '',
  finished: false,
  successCount: 0,
  failedCount: 0,
})

export const useImagesStore = defineStore('images', {
  state: () => ({
    assets: [] as ImageAsset[],
    selectedId: null as string | null,
    batch: emptyBatch(),
  }),
  getters: {
    selected(state): ImageAsset | null {
      return state.assets.find((a) => a.id === state.selectedId) ?? null
    },
  },
  actions: {
    addAsset(input: {
      name: string
      bytes: number
      format: InputFormat
      width: number
      height: number
      file: Blob
      thumbUrl?: string
    }): ImageAsset {
      const asset: ImageAsset = {
        id: `img_${Date.now().toString(36)}_${++idSeq}`,
        status: 'pending',
        ...input,
      }
      this.assets.push(asset)
      if (!this.selectedId) this.selectedId = asset.id
      return asset
    },
    remove(id: string) {
      const idx = this.assets.findIndex((a) => a.id === id)
      if (idx === -1) return
      const [asset] = this.assets.splice(idx, 1)
      if (asset?.resultUrl) URL.revokeObjectURL(asset.resultUrl)
      if (asset?.thumbUrl?.startsWith('blob:')) URL.revokeObjectURL(asset.thumbUrl)
      if (this.selectedId === id) this.selectedId = this.assets[0]?.id ?? null
    },
    clearAll() {
      for (const a of this.assets) {
        if (a.resultUrl) URL.revokeObjectURL(a.resultUrl)
        if (a.thumbUrl?.startsWith('blob:')) URL.revokeObjectURL(a.thumbUrl)
      }
      this.assets = []
      this.selectedId = null
      this.resetBatch()
    },
    setStatus(id: string, status: AssetStatus, error?: string) {
      const asset = this.assets.find((a) => a.id === id)
      if (!asset) return
      asset.status = status
      asset.error = error
    },
    setResult(id: string, result: ProcessResult) {
      const asset = this.assets.find((a) => a.id === id)
      if (!asset) return
      if (asset.resultUrl) URL.revokeObjectURL(asset.resultUrl)
      asset.result = result
      asset.resultUrl = URL.createObjectURL(result.blob)
      asset.status = 'done'
      asset.error = undefined
    },
    resetResults() {
      for (const a of this.assets) {
        if (a.resultUrl) URL.revokeObjectURL(a.resultUrl)
        a.result = undefined
        a.resultUrl = undefined
        a.status = 'pending'
        a.error = undefined
      }
      this.resetBatch()
    },
    beginBatch(total: number) {
      this.batch = {
        active: true, done: 0, total, currentName: '',
        finished: false, successCount: 0, failedCount: 0,
      }
    },
    advanceBatch(name: string) {
      this.batch.currentName = name
    },
    completeItem(success: boolean) {
      this.batch.done += 1
      if (success) this.batch.successCount += 1
      else this.batch.failedCount += 1
    },
    finishBatch() {
      this.batch.active = false
      this.batch.finished = true
    },
    resetBatch() {
      this.batch = emptyBatch()
    },
  },
})
