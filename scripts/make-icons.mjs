import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'

const svg = readFileSync('public/favicon.svg', 'utf8')
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } })
writeFileSync('app-icon.png', resvg.render().asPng())
console.log('app-icon.png written (1024x1024)')
