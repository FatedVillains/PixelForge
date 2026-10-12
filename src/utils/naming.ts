/** Windows / 通用文件名的非法字符与保留名清洗 */

/** 控制字符 + Windows 保留字符 */
const ILLEGAL_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g
/** 结尾的点和空格在 Windows 上会被静默裁掉 */
const TRAILING = /[. ]+$/
/** Windows 设备保留名（不区分大小写，带扩展名时也要拦住） */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i
const MAX_BASE_LENGTH = 120

/**
 * 清洗文件名主干：替换非法字符、去掉尾部点空格、避开保留名、限制长度。
 * 空结果回退为 'image'。
 */
export function sanitizeBaseName(base: string): string {
  let out = base.replace(ILLEGAL_CHARS, '_').replace(TRAILING, '').trim()
  if (!out) out = 'image'
  if (RESERVED.test(out)) out = `_${out}`
  if (out.length > MAX_BASE_LENGTH) out = out.slice(0, MAX_BASE_LENGTH).replace(TRAILING, '')
  return out || 'image'
}

export function splitFileName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, dot), ext: name.slice(dot + 1).toLowerCase() }
}

export function buildOutputName(
  originalName: string,
  opts: {
    ext: string
    suffixKind: 'none' | 'compressed' | 'dimensions'
    width?: number
    height?: number
  },
): string {
  const { base } = splitFileName(originalName)
  const safeBase = sanitizeBaseName(base)
  const ext = opts.ext.replace(/^\./, '').toLowerCase()
  let suffix = ''
  if (opts.suffixKind === 'compressed') suffix = '_compressed'
  if (opts.suffixKind === 'dimensions' && opts.width && opts.height)
    suffix = `_${opts.width}x${opts.height}`
  return `${safeBase}${suffix}.${ext}`
}

export function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name
  const { base, ext } = splitFileName(name)
  for (let i = 1; i < 10000; i++) {
    const candidate = `${base}(${i}).${ext}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base}_${Date.now()}.${ext}`
}
