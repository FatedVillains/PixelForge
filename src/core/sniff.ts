import type { InputFormat } from './types'

const startsWith = (b: Uint8Array, sig: number[], offset = 0): boolean =>
  sig.every((byte, i) => b[offset + i] === byte)

export function sniffFormat(bytes: Uint8Array): InputFormat {
  if (bytes.length < 12) return 'unknown'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'png'
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return 'webp'
  if (startsWith(bytes, [0x42, 0x4d])) return 'bmp'
  return 'unknown'
}

export async function sniffFile(file: Blob): Promise<InputFormat> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  return sniffFormat(head)
}

export const ACCEPTED_INPUT_TYPES =
  '.jpg,.jpeg,.png,.webp,.bmp,image/jpeg,image/png,image/webp,image/bmp'
