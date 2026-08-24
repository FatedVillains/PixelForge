// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useImagesStore } from '../../src/stores/images'

function makeAssetInput() {
  return {
    name: 'a.jpg',
    bytes: 123,
    format: 'jpeg' as const,
    width: 100,
    height: 50,
    file: new Blob(['x'], { type: 'image/jpeg' }),
  }
}

describe('useImagesStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('adds asset and selects first', () => {
    const store = useImagesStore()
    const a = store.addAsset(makeAssetInput())
    expect(store.assets).toHaveLength(1)
    expect(store.selectedId).toBe(a.id)
    expect(store.selected?.name).toBe('a.jpg')
  })

  it('remove clears selection to next asset', () => {
    const store = useImagesStore()
    const a = store.addAsset(makeAssetInput())
    const b = store.addAsset({ ...makeAssetInput(), name: 'b.jpg' })
    store.remove(a.id)
    expect(store.assets).toHaveLength(1)
    expect(store.selectedId).toBe(b.id)
  })

  it('setStatus marks failure with reason', () => {
    const store = useImagesStore()
    const a = store.addAsset(makeAssetInput())
    store.setStatus(a.id, 'failed', '图片无法解码')
    expect(store.assets[0]!.status).toBe('failed')
    expect(store.assets[0]!.error).toBe('图片无法解码')
  })

  it('batch counters track progress', () => {
    const store = useImagesStore()
    store.beginBatch(3)
    store.advanceBatch('x.jpg')
    store.completeItem(true)
    store.completeItem(false)
    expect(store.batch.done).toBe(2)
    expect(store.batch.successCount).toBe(1)
    expect(store.batch.failedCount).toBe(1)
    store.finishBatch()
    expect(store.batch.active).toBe(false)
    expect(store.batch.finished).toBe(true)
  })

  it('clearAll empties everything', () => {
    const store = useImagesStore()
    store.addAsset(makeAssetInput())
    store.clearAll()
    expect(store.assets).toHaveLength(0)
    expect(store.selectedId).toBeNull()
  })
})
