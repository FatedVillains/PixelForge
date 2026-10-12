// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  ID_PHOTO_PRESETS,
  QUICK_SIZES,
  TARGET_PRESETS,
  buildProcessOptions,
  useSettingsStore,
} from '../../src/stores/settings'

describe('useSettingsStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('defaults to jpeg quality 80', () => {
    const s = useSettingsStore()
    expect(s.outputFormat).toBe('jpeg')
    expect(s.mode).toBe('quality')
    expect(s.quality).toBe(80)
  })

  it('switching to png downgrades targetSize mode', () => {
    const s = useSettingsStore()
    s.setMode('targetSize')
    s.setFormat('png')
    expect(s.mode).toBe('quality')
  })

  it('bumps revision when format changes', () => {
    const s = useSettingsStore()
    const before = s.revision
    s.setFormat('png')
    expect(s.revision).toBeGreaterThan(before)
  })

  it('bumps revision when mode changes', () => {
    const s = useSettingsStore()
    const before = s.revision
    s.setMode('targetSize')
    expect(s.revision).toBeGreaterThan(before)
  })

  it('bumps revision once per setFormat call', () => {
    const s = useSettingsStore()
    const before = s.revision
    s.setFormat('png')
    s.setFormat('webp')
    expect(s.revision).toBe(before + 2)
  })

  it('touch() bumps revision without changing settings', () => {
    const s = useSettingsStore()
    const before = s.revision
    const format = s.outputFormat
    s.touch()
    expect(s.revision).toBe(before + 1)
    expect(s.outputFormat).toBe(format)
  })

  it('does not bump revision on read-only preset lookups', () => {
    const s = useSettingsStore()
    const before = s.revision
    void TARGET_PRESETS
    void QUICK_SIZES
    void ID_PHOTO_PRESETS
    expect(s.revision).toBe(before)
  })
})

describe('buildProcessOptions', () => {
  const base = {
    outputFormat: 'jpeg' as const,
    mode: 'quality' as const,
    quality: 80,
    targetPresetKb: 500,
    customTargetKb: null,
    resizeEnabled: false,
    width: null,
    height: null,
    keepAspectRatio: true,
    autoSuffix: true,
    revision: 0,
  }

  it('quality mode maps quality', () => {
    const o = buildProcessOptions(base, { width: 4000, height: 3000 })
    expect(o).toEqual({
      outputFormat: 'jpeg',
      mode: 'quality',
      quality: 80,
    })
  })

  it('targetSize uses preset kb converted to bytes', () => {
    const o = buildProcessOptions(
      { ...base, mode: 'targetSize', customTargetKb: null },
      { width: 100, height: 100 },
    )
    expect(o?.targetSizeBytes).toBe(500 * 1024)
  })

  it('custom target overrides preset', () => {
    const o = buildProcessOptions(
      { ...base, mode: 'targetSize', customTargetKb: 250 },
      { width: 100, height: 100 },
    )
    expect(o?.targetSizeBytes).toBe(250 * 1024)
  })

  it('returns null when target missing', () => {
    const o = buildProcessOptions(
      { ...base, mode: 'targetSize', targetPresetKb: null, customTargetKb: null },
      { width: 100, height: 100 },
    )
    expect(o).toBeNull()
  })

  it('returns null for png + targetSize', () => {
    const o = buildProcessOptions(
      { ...base, mode: 'targetSize', outputFormat: 'png' },
      { width: 100, height: 100 },
    )
    expect(o).toBeNull()
  })

  it('adds exact resize when enabled', () => {
    const o = buildProcessOptions(
      { ...base, resizeEnabled: true, width: 295, height: 413, keepAspectRatio: false },
      { width: 4032, height: 3024 },
    )
    expect(o?.resize).toEqual({ width: 295, height: 413, keepAspectRatio: false })
  })

  it('exposes presets data used by UI', () => {
    expect(TARGET_PRESETS.some((p) => p.kb === 500)).toBe(true)
    expect(QUICK_SIZES.length).toBeGreaterThanOrEqual(9)
    expect(ID_PHOTO_PRESETS.map((p) => `${p.width}x${p.height}`)).toContain('295x413')
  })
})
