/**
 * 分享卡片：npm run gen:og
 *
 * 链接贴到论坛、聊天软件、社交网站时展开的那张预览图（og:image，1200×630）。
 * 首页一张，每碗汤一张：汤的封面图（web/src/scenes/<id>/cover.jpg）打底，压暗后写上汤名、标签和简介。
 * 没有专属卡片的汤，页面会退回用首页那张。
 *
 * 标题用网站同款的马善政体，第一次运行时下载到 .art-cache/fonts/；正文用系统宋体，所以要在 macOS 上运行。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const W = 1200
const H = 630
const OUT = 'web/public/og'
const FONT_DIR = '.art-cache/fonts'
const TITLE_FONT = join(FONT_DIR, 'MaShanZheng-Regular.ttf')
const TITLE_FONT_URL = 'https://github.com/google/fonts/raw/main/ofl/mashanzheng/MaShanZheng-Regular.ttf'
const BODY_FONT = 'Songti SC'
const BONE = '#ece4d2'
const ASH = '#b3aa98'
const BLOOD = '#c0392b'

type Story = { id: string; title: string; teaser: string; tags: string[] }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function ensureFont() {
  mkdirSync(FONT_DIR, { recursive: true })
  if (!existsSync(TITLE_FONT)) {
    const res = await fetch(TITLE_FONT_URL)
    if (!res.ok) throw new Error(`下载字体失败：${res.status}`)
    writeFileSync(TITLE_FONT, Buffer.from(await res.arrayBuffer()))
  }
  // macOS 上 Pango 默认走 CoreText，不认下载的字体；改走 fontconfig，并给它一份只含这几个目录的配置
  const conf = resolve(FONT_DIR, 'fonts.conf')
  writeFileSync(
    conf,
    `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${resolve(FONT_DIR)}</dir><dir>/System/Library/Fonts</dir><dir>/Library/Fonts</dir><cachedir>${resolve(FONT_DIR, 'cache')}</cachedir></fontconfig>`,
  )
  process.env.FONTCONFIG_FILE = conf
  process.env.PANGOCAIRO_BACKEND = 'fc'
}

/** 一段文字渲染成透明 PNG，返回图和尺寸 */
async function text(markup: string, opts: { font: string; width?: number; spacing?: number }) {
  const img = sharp({ text: { text: markup, font: opts.font, width: opts.width, rgba: true, dpi: 72, spacing: opts.spacing, wrap: 'char' } })
  const buf = await img.png().toBuffer()
  const { width = 0, height = 0 } = await sharp(buf).metadata()
  return { input: buf, width, height }
}

/** 左侧压暗、底部压暗，保证字在亮的封面上也看得清 */
const shade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="l" x1="0" x2="1"><stop offset="0" stop-color="#050404" stop-opacity=".92"/><stop offset=".55" stop-color="#050404" stop-opacity=".55"/><stop offset="1" stop-color="#050404" stop-opacity=".15"/></linearGradient>
    <linearGradient id="b" y1="0" y2="1"><stop offset=".55" stop-color="#050404" stop-opacity="0"/><stop offset="1" stop-color="#050404" stop-opacity=".7"/></linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#l)"/><rect width="100%" height="100%" fill="url(#b)"/>
</svg>`)

async function brand(top: number) {
  const icon = await sharp('web/public/favicon.svg', { density: 300 }).resize(44, 44).png().toBuffer()
  const label = await text(`<span foreground="${ASH}" letter_spacing="4096">夜半汤馆 · 海龟汤</span>`, { font: `${BODY_FONT} 24` })
  return [
    { input: icon, left: 72, top },
    { input: label.input, left: 130, top: top + Math.round((44 - label.height) / 2) },
  ]
}

async function background(covers: string[]) {
  if (!covers.length) {
    const glow = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="g" cx=".72" cy=".35" r=".6"><stop offset="0" stop-color="#3a1712"/><stop offset="1" stop-color="#050404"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
    return sharp(Buffer.from(glow)).png().toBuffer()
  }
  // 第一张铺满；第二张从右边渐入，不硬拼
  const [first, second] = await Promise.all(covers.slice(0, 2).map(c => sharp(c).resize(W, H, { fit: 'cover' }).toBuffer()))
  if (!second) return first
  const fade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="f" x1="0" x2="1"><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".78" stop-color="#fff" stop-opacity="1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#f)"/></svg>`)
  const mask = await sharp(fade).extractChannel('alpha').raw().toBuffer()
  const rgb = await sharp(second).removeAlpha().raw().toBuffer()
  const right = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).joinChannel(mask, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer()
  return sharp(first).composite([{ input: right }]).png().toBuffer()
}

async function card(file: string, o: { covers: string[]; title: string; titleSize: number; tags?: string; body: string }) {
  const title = await text(`<span foreground="${BONE}">${esc(o.title)}</span>`, { font: `Ma Shan Zheng ${o.titleSize}` })
  const tags = o.tags ? await text(`<span foreground="${BLOOD}" letter_spacing="2048">${esc(o.tags)}</span>`, { font: `${BODY_FONT} 24` }) : null
  const body = await text(`<span foreground="${BONE}">${esc(o.body)}</span>`, { font: `${BODY_FONT} 30`, width: 600, spacing: 14 })

  // 自下而上排：简介贴底，标签、标题依次往上
  const bodyTop = H - 72 - body.height
  const tagsTop = tags ? bodyTop - 28 - tags.height : bodyTop
  const titleTop = tagsTop - 12 - title.height
  const layers = [
    { input: shade, left: 0, top: 0 },
    ...(await brand(56)),
    { input: title.input, left: 68, top: titleTop },
    ...(tags ? [{ input: tags.input, left: 72, top: tagsTop }] : []),
    { input: body.input, left: 72, top: bodyTop },
  ]
  await sharp(await background(o.covers)).composite(layers).jpeg({ quality: 86, mozjpeg: true }).toFile(join(OUT, file))
  console.log(`✓ ${join(OUT, file)}`)
}

function loadStories(): Story[] {
  return ['stories', 'stories-private']
    .filter(d => existsSync(d))
    .flatMap(d => readdirSync(d).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join(d, f), 'utf8')) as Story))
    .sort((a, b) => a.id.localeCompare(b.id))
}

const coverOf = (id: string) => [`web/src/scenes/${id}/cover.jpg`].filter(existsSync)

await ensureFont()
mkdirSync(OUT, { recursive: true })
const list = loadStories()
await card('home.jpg', {
  covers: list.flatMap(s => coverOf(s.id)),
  title: '夜半汤馆',
  titleSize: 132,
  body: '在线海龟汤。看汤面，向 AI 主持人提问，它只回答“是”或“不是”。',
})
for (const s of list) {
  await card(`${s.id}.jpg`, { covers: coverOf(s.id), title: s.title, titleSize: 112, tags: s.tags.join(' · '), body: s.teaser })
}
