/**
 * 场景生图：按场景目录里的 art.json 调用图像接口，生成底图和各个状态层。
 *
 *   npm run gen -- web/src/scenes/xiang-you-kan-qi            生成还没有的层
 *   npm run gen -- web/src/scenes/xiang-you-kan-qi girl line  只（重新）生成这几层
 *   npm run gen -- <场景目录> girl --dry                       不调接口，只画出蒙版预览
 *   npm run gen -- <场景目录> girl --n 3                       出 3 个候选放进缓存目录，不覆盖正式文件
 *   npm run gen -- <场景目录> line --reuse                     不调接口，用上次的原始输出重新贴回、裁切（调参数用）
 *
 * 接口地址和密钥从 .env 读取：IMAGE_API_BASE、IMAGE_API_KEY。
 *
 * 模型只把蒙版当参考，蒙版外的像素也会被轻微重画。所以局部重绘之后，
 * 只把区域里那一块羽化贴回底图，其余像素保持原样，各状态图之间严格对齐。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join, relative, resolve } from 'node:path'
import sharp from 'sharp'

type Rect = [x: number, y: number, w: number, h: number]
type Region = { rect: Rect } | { poly: [number, number][] }

type Layer = {
  prompt: string
  /** 在这张图上改：层名，或相对场景目录的图片路径。不填就是从零生成 */
  base?: string
  /** 额外参考图（层名或路径），用来保持人物、物件一致 */
  refs?: string[]
  /** 只改这一块；改完贴回 base，区域外一个像素都不动 */
  region?: Region
  /** 发给模型的蒙版比区域大多少像素，给模型留出余地（默认 32） */
  pad?: number
  /** 贴回时的羽化宽度（默认 16） */
  feather?: number
  /** full：整张图；overlay：只有区域里有内容、其余透明，用作叠加层 */
  output?: 'full' | 'overlay'
  /** 导出时裁出这一块（常和 overlay 一起用） */
  crop?: Rect
  /** 直接生成透明背景 */
  transparent?: boolean
  model?: string
  quality?: string
  /** 从零生成时的尺寸，例如 1536x1024 */
  size?: string
  /** 输出文件名，默认 <层名>.webp，放在 out 目录 */
  file?: string
  /** webp 质量（默认 82） */
  webp?: number
  /** 导出前缩放（裁切铺满）到这个尺寸，例如特写用 [800, 800] */
  fit?: [w: number, h: number]
  /** 备注，脚本不读 */
  note?: string
}

type Config = {
  /** 输出目录，相对场景目录（默认 photos） */
  out?: string
  model?: string
  quality?: string
  /** 附加在每条提示词后面的统一画风说明 */
  style?: string
  layers: Record<string, Layer>
}

// ---------- 参数 ----------

const argv = process.argv.slice(2)
const flag = (name: string) => argv.includes(`--${name}`)
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--n')
const [sceneArg, ...only] = positional
if (!sceneArg) {
  console.error('用法：npm run gen -- <场景目录> [层名...] [--dry] [--n 3]')
  process.exit(1)
}
const dry = flag('dry')
const reuse = flag('reuse')
const variants = Number(opt('n') ?? 1)

if (existsSync('.env')) process.loadEnvFile('.env')
const API = process.env.IMAGE_API_BASE?.replace(/\/$/, '')
const KEY = process.env.IMAGE_API_KEY
if (!dry && (!API || !KEY)) {
  console.error('缺少 IMAGE_API_BASE / IMAGE_API_KEY（写在 .env 里）')
  process.exit(1)
}

const sceneDir = resolve(sceneArg)
const cfgPath = join(sceneDir, 'art.json')
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as Config
const outDir = join(sceneDir, cfg.out ?? 'photos')
const cacheDir = resolve('.art-cache', basename(sceneDir))
mkdirSync(outDir, { recursive: true })
mkdirSync(cacheDir, { recursive: true })

for (const name of only) if (!cfg.layers[name]) fail(`art.json 里没有层 “${name}”`)

function fail(msg: string): never {
  console.error(msg)
  process.exit(1)
}

// ---------- 文件 ----------

const outFile = (name: string) => join(outDir, cfg.layers[name].file ?? `${name}.webp`)
/** 无损母版：后续层在它上面改，避免 webp 反复压缩 */
const masterFile = (name: string) => join(cacheDir, `${name}.png`)
const isPath = (ref: string) => /\.(png|jpe?g|webp)$/i.test(ref)

function sourceOf(ref: string): string {
  if (isPath(ref)) return join(sceneDir, ref)
  if (!cfg.layers[ref]) fail(`找不到层 “${ref}”`)
  return existsSync(masterFile(ref)) ? masterFile(ref) : outFile(ref)
}

// ---------- 蒙版 ----------

const polyOf = (r: Region): [number, number][] => {
  if ('poly' in r) return r.poly
  const [x, y, w, h] = r.rect
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
}

/** 区域画成白色、其余黑色的灰度图；grow 让区域向外扩，blur 做羽化 */
async function regionAlpha(r: Region, W: number, H: number, grow: number, blur: number) {
  const pts = polyOf(r)
    .map(p => p.join(','))
    .join(' ')
  const stroke = grow > 0 ? `stroke="#fff" stroke-width="${grow * 2}" stroke-linejoin="round"` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#000"/><polygon points="${pts}" fill="#fff" ${stroke}/></svg>`
  let img = sharp(Buffer.from(svg)).greyscale()
  if (blur > 0) img = img.blur(Math.max(0.3, blur / 2))
  return img.extractChannel(0).raw().toBuffer()
}

/** 接口要的蒙版：和原图一样大，要改的地方透明，其余不透明 */
async function apiMask(r: Region, W: number, H: number, pad: number) {
  const a = await regionAlpha(r, W, H, pad, 0)
  for (let i = 0; i < a.length; i++) a[i] = 255 - a[i]
  return sharp({ create: { width: W, height: H, channels: 3, background: '#000' } })
    .joinChannel(a, { raw: { width: W, height: H, channels: 1 } })
    .png()
    .toBuffer()
}

// ---------- 接口 ----------

class RetryableError extends Error {}

/** 代理偶尔会返回上游错误，重试两次 */
async function callApi(name: string, layer: Layer, prompt: string, images: Buffer[], mask?: Buffer): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await callApiOnce(name, layer, prompt, images, mask)
    } catch (e) {
      const retryable = e instanceof RetryableError || (e as Error).name === 'TimeoutError'
      if (!retryable || attempt >= 3) throw e
      console.warn(`${(e as Error).message}\n[${name}] 第 ${attempt} 次失败，${attempt * 10} 秒后重试…`)
      await new Promise(r => setTimeout(r, attempt * 10_000))
    }
  }
}

async function callApiOnce(name: string, layer: Layer, prompt: string, images: Buffer[], mask?: Buffer): Promise<Buffer> {
  const model = layer.model ?? cfg.model ?? 'gpt-image-2.5-sunburst'
  const quality = layer.quality ?? cfg.quality ?? 'high'
  const common: Record<string, string> = { model, prompt, quality, moderation: 'low', output_format: 'png' }
  if (layer.transparent) common.background = 'transparent'
  if (layer.size) common.size = layer.size

  let res: Response
  if (images.length) {
    const form = new FormData()
    for (const [k, v] of Object.entries(common)) form.append(k, v)
    const field = images.length > 1 ? 'image[]' : 'image'
    images.forEach((b, i) => form.append(field, new Blob([new Uint8Array(b)], { type: 'image/png' }), `in${i}.png`))
    if (mask) form.append('mask', new Blob([new Uint8Array(mask)], { type: 'image/png' }), 'mask.png')
    res = await fetch(`${API}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: form, signal: AbortSignal.timeout(10 * 60_000) })
  } else {
    res = await fetch(`${API}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ...common, n: 1 }),
      signal: AbortSignal.timeout(10 * 60_000),
    })
  }
  const text = await res.text()
  let data: { data?: { b64_json?: string; url?: string }[]; error?: { message?: string; code?: string } }
  try {
    data = JSON.parse(text)
  } catch {
    throw new RetryableError(`[${name}] 接口返回的不是 JSON（HTTP ${res.status}）：${text.slice(0, 200)}`)
  }
  const transient = res.status >= 500 || res.status === 429 || /^upstream/.test(data.error?.code ?? '')
  if (!res.ok || !data.data?.[0]) throw new (transient ? RetryableError : Error)(`[${name}] HTTP ${res.status} ${data.error?.code ?? ''} ${data.error?.message ?? text.slice(0, 200)}`)
  const item = data.data[0]
  if (item.b64_json) return Buffer.from(item.b64_json, 'base64')
  if (item.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer())
  throw new Error(`[${name}] 接口没有返回图片`)
}

// ---------- 生成一层 ----------

async function render(name: string, variant?: number) {
  const layer = cfg.layers[name]
  const tag = variant ? `${name}#${variant}` : name
  const started = Date.now()
  let prompt = layer.prompt.trim()
  if (cfg.style) prompt += `\n\n${cfg.style.trim()}`

  const base = layer.base ? await sharp(sourceOf(layer.base)).removeAlpha().png().toBuffer() : null
  const meta = base ? await sharp(base).metadata() : null
  const W = meta?.width ?? 0
  const H = meta?.height ?? 0
  if (layer.region && !base) fail(`[${name}] 有 region 就必须有 base`)

  if (layer.region) prompt += '\n\nOnly change the transparent masked area. Keep everything outside it exactly as in the input photo: same framing, perspective, lighting and grain.'
  const refs = await Promise.all((layer.refs ?? []).map(r => sharp(sourceOf(r)).png().toBuffer()))
  const mode = layer.region ? '局部重绘' : base ? '整张编辑' : refs.length ? `照参考图生成（${refs.length} 张）` : '从零生成'
  const mask = layer.region ? await apiMask(layer.region, W, H, layer.pad ?? 32) : undefined

  if (dry) {
    if (base && layer.region) {
      const a = await regionAlpha(layer.region, W, H, 0, 0)
      const tint = await sharp({ create: { width: W, height: H, channels: 3, background: '#ff2a00' } })
        .joinChannel(Buffer.from(a.map(v => v * 0.45)), { raw: { width: W, height: H, channels: 1 } })
        .png()
        .toBuffer()
      const p = join(cacheDir, `${name}.preview.png`)
      await sharp(base).composite([{ input: tint }]).toFile(p)
      console.log(`[${tag}] 蒙版预览 → ${relative('.', p)}`)
    } else console.log(`[${tag}] ${mode}`)
    return
  }

  const suffix = variant ? `.v${variant}` : ''
  const rawFile = join(cacheDir, `${name}${suffix}.raw.png`)
  let raw: Buffer
  if (reuse && existsSync(rawFile)) {
    console.log(`[${tag}] 复用上次的原始输出`)
    raw = readFileSync(rawFile)
  } else {
    console.log(`[${tag}] ${mode}…`)
    raw = await callApi(name, layer, prompt, base ? [base, ...refs] : refs, mask)
    writeFileSync(rawFile, raw)
  }

  // 接口有时按自己的尺寸出图：拉回底图大小，保证坐标一致
  let img = sharp(raw)
  if (base) img = img.resize(W, H, { fit: 'fill' })
  let result = await img.ensureAlpha().png().toBuffer()

  if (base && layer.region) {
    const a = await regionAlpha(layer.region, W, H, 0, layer.feather ?? 16)
    // 先单独去掉透明通道再接上羽化蒙版：sharp 按固定顺序执行，写在一条链里 removeAlpha 会把刚接上的通道删掉
    const rgb = await sharp(result).removeAlpha().raw().toBuffer()
    const patch = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
      .joinChannel(a, { raw: { width: W, height: H, channels: 1 } })
      .png()
      .toBuffer()
    result = layer.output === 'overlay' ? patch : await sharp(base).composite([{ input: patch }]).png().toBuffer()
  }
  if (layer.fit) result = await sharp(result).resize(layer.fit[0], layer.fit[1], { fit: 'cover' }).png().toBuffer()
  if (layer.crop) {
    const [left, top, width, height] = layer.crop
    result = await sharp(result).extract({ left, top, width, height }).png().toBuffer()
  }

  const secs = ((Date.now() - started) / 1000).toFixed(0)
  if (variant) {
    const p = join(cacheDir, `${name}.v${variant}.png`)
    writeFileSync(p, result)
    console.log(`[${tag}] 候选 → ${relative('.', p)}（${secs}s）`)
    return
  }
  writeFileSync(masterFile(name), result)
  const file = outFile(name)
  const q = layer.webp ?? 82
  if (extname(file) === '.webp') await sharp(result).webp({ quality: q, alphaQuality: 90 }).toFile(file)
  else await sharp(result).toFile(file)
  console.log(`[${tag}] → ${relative('.', file)}（${secs}s）`)
}

// ---------- 调度：先生成被依赖的层，互不依赖的并行跑 ----------

const deps = (name: string) => [cfg.layers[name].base, ...(cfg.layers[name].refs ?? [])].filter((r): r is string => !!r && !isPath(r))

const wanted = new Set<string>()
const want = (name: string, explicit: boolean) => {
  if (wanted.has(name)) return
  for (const d of deps(name)) if (!existsSync(sourceOf(d))) want(d, false)
  if (explicit || !existsSync(outFile(name))) wanted.add(name)
}
for (const name of only.length ? only : Object.keys(cfg.layers)) want(name, only.length > 0)

if (!wanted.size) {
  console.log('都已经生成过了。要重新生成某一层，把层名写在后面。')
  process.exit(0)
}
console.log(`要生成：${[...wanted].join('、')}`)

const done = new Set<string>()
const running = new Map<string, Promise<void>>()
const LIMIT = 3
let failed = false

while (done.size < wanted.size && !failed) {
  for (const name of wanted) {
    if (done.has(name) || running.has(name) || running.size >= LIMIT) continue
    if (deps(name).some(d => wanted.has(d) && !done.has(d))) continue
    const job = (async () => {
      if (variants > 1 && only.includes(name)) await Promise.all(Array.from({ length: variants }, (_, i) => render(name, i + 1)))
      else await render(name)
    })()
      .catch(e => {
        failed = true
        console.error((e as Error).message)
      })
      .finally(() => {
        running.delete(name)
        done.add(name)
      })
    running.set(name, job)
  }
  if (!running.size) break
  await Promise.race(running.values())
}
await Promise.all(running.values())
if (failed) process.exit(1)
console.log(`完成。原始输出和母版在 ${relative('.', cacheDir)}/`)
