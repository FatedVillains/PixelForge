import { zipSync } from 'fflate'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import type { ProcessResult } from '../core/types'
import { buildOutputName, uniqueName } from './naming'

function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function saveViaDesktop(blob: Blob, filename: string): Promise<void> {
  const path = await save({ defaultPath: filename })
  if (path === null) return
  const bytes = new Uint8Array(await blob.arrayBuffer())
  await writeFile(path, bytes)
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

export async function downloadResultsZip(
  entries: ZipEntry[],
  opts: { suffixKind: 'none' | 'compressed' | 'dimensions' },
): Promise<void> {
  const files: Record<string, Uint8Array> = {}
  const taken = new Set<string>()
  for (const { assetName, result } of entries) {
    const bytes = new Uint8Array(await result.blob.arrayBuffer())
    const name = uniqueName(
      buildOutputName(assetName, {
        ext: result.format,
        suffixKind: opts.suffixKind,
        width: result.width,
        height: result.height,
      }),
      taken,
    )
    taken.add(name)
    files[name] = bytes
  }
  const zipped = zipSync(files, { level: 0 })
  await downloadBlob(
    new Blob([zipped as BlobPart], { type: 'application/zip' }),
    'pixel-forge-result.zip',
  )
}

export function resultFileName(
  originalName: string,
  result: ProcessResult,
  suffixKind: 'none' | 'compressed' | 'dimensions',
): string {
  return uniqueName(
    buildOutputName(originalName, {
      ext: result.format,
      suffixKind,
      width: result.width,
      height: result.height,
    }),
    new Set(),
  )
}