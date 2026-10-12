// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import WorkspaceView from '../../src/views/WorkspaceView.vue'
import SettingsPanel from '../../src/components/settings/SettingsPanel.vue'
import { useImagesStore } from '../../src/stores/images'
import { useSettingsStore } from '../../src/stores/settings'
import type { ProcessResult } from '../../src/core/types'

function pngResult(): ProcessResult {
  return {
    blob: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
    width: 100,
    height: 80,
    bytes: 4,
    format: 'png',
    iterations: 1,
    fitsTarget: true,
  }
}

function jpegResult(): ProcessResult {
  return {
    ...pngResult(),
    blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
    format: 'jpeg',
  }
}

function seedAsset(images: ReturnType<typeof useImagesStore>, result: ProcessResult) {
  images.addAsset({
    name: 'a.jpg',
    bytes: 100,
    format: 'jpeg',
    width: 100,
    height: 80,
    file: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
  })
  images.setResult(images.assets[0]!.id, result)
  return images.assets[0]!
}

/* happy-dom has no createObjectURL; stub just enough of it */
beforeEach(() => {
  let n = 0
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => `blob:test/${++n}`,
    revokeObjectURL: () => {},
  })
})

/* 组件与断言必须共用同一个 pinia，否则改的是另一份 store */
function mountWorkspace() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(WorkspaceView, { global: { plugins: [pinia] } })
}

function mountSettingsPanel() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(SettingsPanel, { global: { plugins: [pinia] } })
}

describe('stale results are invalidated when settings change', () => {
  it('clears finished results when the output format changes', async () => {
    mountWorkspace()
    await flushPromises()
    const images = useImagesStore()
    const settings = useSettingsStore()

    const asset = seedAsset(images, jpegResult())
    expect(asset.status).toBe('done')
    expect(asset.result?.format).toBe('jpeg')

    /* exactly the step that caused the bug: pick PNG after a jpeg run */
    settings.setFormat('png')
    await flushPromises()

    expect(asset.status).toBe('pending')
    expect(asset.result).toBeUndefined()
    expect(asset.resultUrl).toBeUndefined()
  })

  it('clears results when quality changes', async () => {
    mountWorkspace()
    await flushPromises()
    const images = useImagesStore()
    const settings = useSettingsStore()

    const asset = seedAsset(images, pngResult())
    settings.setQuality(50)
    await flushPromises()
    expect(asset.status).toBe('pending')
  })

  it('clears results when dimensions change', async () => {
    mountWorkspace()
    await flushPromises()
    const images = useImagesStore()
    const settings = useSettingsStore()

    const asset = seedAsset(images, pngResult())
    settings.setResizeEnabled(true)
    settings.setWidth(295)
    settings.setHeight(413)
    await flushPromises()
    expect(asset.status).toBe('pending')
  })

  it('keeps results when settings change mid-batch', async () => {
    mountWorkspace()
    await flushPromises()
    const images = useImagesStore()
    const settings = useSettingsStore()

    const asset = seedAsset(images, jpegResult())
    /* pretend a new batch is running */
    images.beginBatch(1)

    settings.setFormat('png')
    await flushPromises()

    expect(asset.result?.format).toBe('jpeg')
  })

  it('routes the panel PNG button through the same invalidation', async () => {
    const wrapper = mountSettingsPanel()
    await flushPromises()
    const settings = useSettingsStore()

    const pngButton = wrapper.findAll('button').find((b) => b.text() === 'PNG')
    expect(pngButton).toBeDefined()
    await pngButton!.trigger('click')

    expect(settings.outputFormat).toBe('png')
    expect(settings.revision).toBeGreaterThan(0)
  })
})