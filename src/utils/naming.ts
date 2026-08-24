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
  const ext = opts.ext.replace(/^\./, '').toLowerCase()
  let suffix = ''
  if (opts.suffixKind === 'compressed') suffix = '_compressed'
  if (opts.suffixKind === 'dimensions' && opts.width && opts.height)
    suffix = `_${opts.width}x${opts.height}`
  return `${base}${suffix}.${ext}`
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
