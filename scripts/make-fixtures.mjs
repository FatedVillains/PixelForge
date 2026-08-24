import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'fixtures')
mkdirSync(outDir, { recursive: true })

/** 渐变 + 色块图案，便于肉眼确认缩放/压缩效果 */
function makeBmp(width, height, file) {
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const pixelBytes = rowSize * height
  const fileSize = 54 + pixelBytes
  const buf = Buffer.alloc(fileSize)

  buf.write('BM', 0)
  buf.writeUInt32LE(fileSize, 2)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(width, 18)
  buf.writeInt32LE(height, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(pixelBytes, 34)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = 54 + y * rowSize + x * 3
      buf[i] = (x * 255) / width       // B
      buf[i + 1] = (y * 255) / height  // G
      buf[i + 2] = ((x ^ y) % 64) * 4  // R
    }
  }
  writeFileSync(join(outDir, file), buf)
  console.log(`written ${file} (${width}x${height}, ${(fileSize / 1048576).toFixed(1)}MB)`)
}

makeBmp(1600, 1200, 'sample-1600x1200.bmp')
makeBmp(295, 413, 'sample-idphoto-size.bmp')
