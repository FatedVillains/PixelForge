<script setup lang="ts">
import { computed } from 'vue'
import BaseCard from '../ui/BaseCard.vue'
import RangeSlider from '../ui/RangeSlider.vue'
import SelectBox from '../ui/SelectBox.vue'
import ToggleSwitch from '../ui/ToggleSwitch.vue'
import NumberField from '../ui/NumberField.vue'
import {
  ID_PHOTO_PRESETS,
  QUICK_SIZES,
  TARGET_PRESETS,
  useSettingsStore,
} from '../../stores/settings'
import { useImagesStore } from '../../stores/images'
import { computeTargetDimensions } from '../../core/processors/resize'
import { checkOutputGuard } from '../../core/guard'

const settings = useSettingsStore()
const images = useImagesStore()

const formatOptions = [
  { value: 'jpeg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WEBP' },
]
const modeOptions = [
  { value: 'quality', label: '按质量压缩' },
  { value: 'targetSize', label: '按目标大小' },
]

/** PNG 为无损格式，不支持目标大小模式 */
const targetDisabled = computed(() => settings.outputFormat === 'png')

const selected = computed(() => images.selected)

function onWidthInput(w: number | null) {
  settings.setWidth(w)
  if (settings.keepAspectRatio && w && selected.value && selected.value.width > 0) {
    settings.setHeight(Math.max(1, Math.round((w * selected.value.height) / selected.value.width)))
  }
}

function onHeightInput(h: number | null) {
  settings.setHeight(h)
  if (settings.keepAspectRatio && h && selected.value && selected.value.height > 0) {
    settings.setWidth(Math.max(1, Math.round((h * selected.value.width) / selected.value.height)))
  }
}

function toggleKeepAspect(v: boolean) {
  settings.setKeepAspectRatio(v)
  if (v) onWidthInput(settings.width)
}

function applyPreset(preset: { width: number; height: number }) {
  settings.setResizeEnabled(true)
  settings.setKeepAspectRatio(false)
  settings.setWidth(preset.width)
  settings.setHeight(preset.height)
}

/** 实际会输出的尺寸（已按 1..20000 夹取）与超限提示，避免用户以为设的值就是最终值 */
const effectiveSize = computed(() => {
  const src = selected.value ?? { width: 4032, height: 3024 }
  return computeTargetDimensions(src, {
    width: settings.width ?? 0,
    height: settings.height ?? 0,
    keepAspectRatio: settings.keepAspectRatio,
  })
})
const sizeWarning = computed(() => {
  const { width, height } = effectiveSize.value
  const clamped =
    (settings.width !== null && settings.width > width) ||
    (settings.height !== null && settings.height > height)
  if (clamped) {
    return `目标尺寸过大，已自动收敛到 ${width}×${height}（单边上限 20000px）`
  }
  const guard = checkOutputGuard(width, height)
  return guard.oversized ? guard.reason : ''
})
</script>

<template>
  <div class="space-y-3">
    <!-- 输出格式与质量 -->
    <BaseCard class="space-y-3 p-4">
      <p class="text-xs font-semibold tracking-wide text-slate-400">输出设置</p>
      <div class="flex gap-2">
        <button
          v-for="f in formatOptions"
          :key="f.value"
          class="flex-1 rounded-lg border px-2 py-1.5 text-sm transition-colors"
          :class="
            settings.outputFormat === f.value
              ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          "
          @click="settings.setFormat(f.value as 'jpeg' | 'png' | 'webp')"
        >
          {{ f.label }}
        </button>
      </div>

      <ToggleSwitch v-model="settings.autoSuffix" label="自动添加处理后缀" />

      <p class="text-xs text-slate-400">
        后缀规则：_compressed，或开启尺寸后输出 _宽x高
      </p>
    </BaseCard>

    <!-- 压缩模式 -->
    <BaseCard class="space-y-3 p-4">
      <p class="text-xs font-semibold tracking-wide text-slate-400">压缩模式</p>
      <SelectBox v-model="settings.mode" :options="modeOptions" />

      <template v-if="settings.mode === 'quality'">
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-600">质量</span>
          <span class="font-medium text-brand-600">{{ settings.quality }}%</span>
        </div>
        <RangeSlider
          :model-value="settings.quality"
          :min="1"
          :max="100"
          @update:model-value="settings.setQuality"
        />
        <div class="flex justify-between text-[10px] text-slate-300">
          <span>极限压缩</span><span>高质量</span>
        </div>
      </template>

      <template v-else>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="p in TARGET_PRESETS"
            :key="p.kb"
            class="rounded-lg border px-2 py-1.5 text-xs transition-colors disabled:opacity-40"
            :class="
              !targetDisabled && settings.customTargetKb === null && settings.targetPresetKb === p.kb
                ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            "
            :disabled="targetDisabled"
            @click="settings.setTargetPreset(p.kb)"
          >
            {{ p.label }}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <span class="shrink-0 text-xs text-slate-500">自定义 KB</span>
          <NumberField
            :model-value="settings.customTargetKb"
            :min="1"
            placeholder="如 800"
            :disabled="targetDisabled"
            @update:model-value="settings.setCustomTarget"
          />
        </div>
        <p v-if="targetDisabled" class="text-xs text-red-500">
          PNG 为无损格式，不支持按目标大小；请选择 JPG 或 WEBP。
        </p>
      </template>
    </BaseCard>

    <!-- 尺寸 / 像素调整 -->
    <BaseCard class="space-y-3 p-4">
      <div class="flex items-center justify-between">
        <p class="text-xs font-semibold tracking-wide text-slate-400">尺寸调整</p>
        <ToggleSwitch
          :model-value="settings.resizeEnabled"
          @update:model-value="settings.setResizeEnabled"
        />
      </div>

      <template v-if="settings.resizeEnabled">
        <div class="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label class="space-y-1">
            <span class="text-xs text-slate-500">宽度 px</span>
            <NumberField v-model="settings.width" :min="1" placeholder="1920" @update:model-value="onWidthInput" />
          </label>
          <span class="pb-2 text-slate-300">×</span>
          <label class="space-y-1">
            <span class="text-xs text-slate-500">高度 px</span>
            <NumberField v-model="settings.height" :min="1" placeholder="1080" @update:model-value="onHeightInput" />
          </label>
        </div>
        <ToggleSwitch
          :model-value="settings.keepAspectRatio"
          label="保持原始比例（以宽度为准）"
          @update:model-value="toggleKeepAspect"
        />

        <p class="pt-1 text-xs text-slate-400">实际输出 {{ effectiveSize.width }} × {{ effectiveSize.height }}</p>
        <p v-if="sizeWarning" class="text-xs text-red-500">{{ sizeWarning }}</p>

        <p class="pt-1 text-xs text-slate-400">快捷尺寸</p>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="q in QUICK_SIZES"
            :key="q.label"
            class="rounded-md border border-slate-200 px-1 py-1 text-[11px] text-slate-600 hover:border-brand-400 hover:text-brand-600"
            @click="applyPreset(q)"
          >
            {{ q.label }}
          </button>
        </div>

        <p class="pt-1 text-xs text-slate-400">证件照像素（严格输出）</p>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="p in ID_PHOTO_PRESETS"
            :key="p.label"
            class="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-brand-400 hover:text-brand-600"
            @click="applyPreset(p)"
          >
            {{ p.label }}
          </button>
        </div>
      </template>
    </BaseCard>
  </div>
</template>
