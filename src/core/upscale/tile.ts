/** 分块处理的区域提取：越界使用镜像填充，保证 tile 边缘的卷积滤波与整图路径一致 */

/** 把任意整数索引映射到 [0, n-1]，越界部分沿边界镜像反射 */
export function mirrorIndex(i: number, n: number): number {
  if (n <= 1) return 0
  const period = 2 * n - 2
  let m = i % period
  if (m < 0) m += period
  return m < n ? m : period - m
}

/**
 * 从 src 中取出以 (rx, ry) 为原点、rw×rh 的子区域。
 * 越界像素按镜像方式填充（与高斯模糊/锐化所期望的边界条件一致，
 * 避免使用 clamp 时 tile 边缘出现可见接缝）。
 */
export function extractRegion(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rw * rh * 4)
  if (rw <= 0 || rh <= 0) return out
  const inBounds = rx >= 0 && ry >= 0 && rx + rw <= srcW && ry + rh <= srcH

  for (let y = 0; y < rh; y++) {
    const row = out.subarray(y * rw * 4, (y + 1) * rw * 4)
    if (inBounds) {
      const base = (ry + y) * srcW * 4
      row.set(src.subarray(base + rx * 4, base + (rx + rw) * 4), 0)
      continue
    }
    const so = mirrorIndex(ry + y, srcH) * srcW * 4
    for (let x = 0; x < rw; x++) {
      const si = so + mirrorIndex(rx + x, srcW) * 4
      const di = x * 4
      row[di] = src[si]!
      row[di + 1] = src[si + 1]!
      row[di + 2] = src[si + 2]!
      row[di + 3] = src[si + 3]!
    }
  }
  return out
}
