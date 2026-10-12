import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import type { ProcessResult, OutputFormat } from '../core/types'
import type { UpscaleResult } from '../core/upscale/types'
import { buildOutputName, sanitizeBaseName, splitFileName, uniqueName } from './naming'
import { zipBlobs, type ZipSource } from './zip'

function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** Tauri 的 fs scope 不覆盖用户选中的盘符时，给出可操作的提示 */
function describeFsError(path: string, err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  if (/denied|not allowed|scope|forbidden|permission/i.test(raw)) {
    return `没有写入权限：${path}。请改存到用户目录（桌面/文档/下载）后再试`
  }
  return raw
}

/** jpeg 用约定俗成的 .jpg，两页与 ZIP 内条目统一走这里，避免一处 .jpeg 一处 .jpg */
export function extForFormat(format: OutputFormat): string {
  return format === 'jpeg' ? 'jpg' : format
}

const FORMAT_LABELS: Record<OutputFormat, string> = {
  jpeg: 'JPEG 图片',
  png: 'PNG 图片',
  webp: 'WebP 图片',
}

async function saveViaDesktop(blob: Blob, filename: string): Promise<void> {
  /* 不传 filters 时 Windows 对话框不显示格式列表，用户可能改成别的扩展名而内容不变 */
  const isZip = filename.toLowerCase().endsWith('.zip')
  const filters = isZip
    ? [{ name: 'ZIP 压缩包', extensions: ['zip'] }]
    : [
        {
          name: FORMAT_LABELS[filenameExt(filename)],
          extensions: [filenameExt(filename)],
        },
      ]
  const path = await save({ defaultPath: filename, filters })
  if (path === null) return
  const bytes = new Uint8Array(await blob.arrayBuffer())
  try {
    await writeFile(path, bytes)
  } catch (err) {
    throw new Error(describeFsError(path, err))
  }
}

function filenameExt(filename: string): OutputFormat {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpeg'
  if (ext === 'jpg' || ext === 'jpeg') return 'jpeg'
  if (ext === 'png') return 'png'
  return 'webp'
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (isDesktop()) {
    await saveViaDesktop(blob, filename)
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface ZipEntry {
  assetName: string
  result: ProcessResult
}

export interface UpZipEntry {
  assetName: string
  result: UpscaleResult
}

export type SuffixKind = 'none' | 'compressed' | 'dimensions'

/**
 * 只有一张时直接给文件，多张才值得打包。
 * 两页共用同一判定，避免各自维护 v-if="length > 1" 而行为漂移。
 * 只看数量，不关心条目内容，所以两页都能直接传自己的资产数组。
 */
export function shouldUseZip(entries: readonly unknown[]): boolean {
  return entries.length > 1
}

export function shouldUseZipUp(entries: readonly unknown[]): boolean {
  return entries.length > 1
}

function takeUniqueNames(sources: ZipSource[]): ZipSource[] {
  const taken = new Set<string>()
  return sources.map((s) => {
    const name = uniqueName(s.name, taken)
    taken.add(name)
    return { name, blob: s.blob }
  })
}

export async function downloadResultsZip(
  entries: ZipEntry[],
  opts: { suffixKind: SuffixKind },
): Promise<void> {
  const sources = takeUniqueNames(
    entries.map(({ assetName, result }) => ({
      name: buildOutputName(assetName, {
        ext: extForFormat(result.format),
        suffixKind: opts.suffixKind,
        width: result.width,
        height: result.height,
      }),
      blob: result.blob,
    })),
  )
  const zipped = await zipBlobs(sources)
  await downloadBlob(zipped, 'pixel-forge-result.zip')
}

export function upResultFileName(originalName: string, result: UpscaleResult): string {
  const { base } = splitFileName(originalName)
  return `${sanitizeBaseName(base)}_${result.suffix}.${extForFormat(result.format)}`
}

export async function downloadUpResults(entries: UpZipEntry[]): Promise<void> {
  const sources = takeUniqueNames(
    entries.map(({ assetName, result }) => ({
      name: upResultFileName(assetName, result),
      blob: result.blob,
    })),
  )
  const zipped = await zipBlobs(sources)
  await downloadBlob(zipped, 'pixel-forge-upscale.zip')
}

export function resultFileName(
  originalName: string,
  result: ProcessResult,
  suffixKind: SuffixKind,
): string {
  return uniqueName(
    buildOutputName(originalName, {
      ext: extForFormat(result.format),
      suffixKind,
      width: result.width,
      height: result.height,
    }),
    new Set(),
  )
}
