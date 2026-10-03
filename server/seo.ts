/**
 * 给搜索引擎看的部分：robots.txt、sitemap.xml，以及每个页面的标题、描述和一段静态正文。
 * 静态正文放在 #root 里，React 挂载时会整个替换掉；不跑 JS 的爬虫也能读到汤名、简介和汤面。
 * 只用公开信息（汤面、简介），绝不涉及汤底。
 */
import { existsSync } from 'node:fs'
import type { Context } from 'hono'
import { stories, type Story } from './stories.ts'

const SITE_NAME = '夜半汤馆'
const SITE_DESC = '夜半汤馆是一个在线海龟汤推理游戏：看汤面，向 AI 主持人提问，主持人只回答“是”或“不是”，场景会随着你的推理一点点变化。'

/** 放进 <script> 里的 JSON，防止内容里的 </script> 提前闭合 */
const jsonLd = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 站点地址：线上用 SITE_URL，没配就按请求的 Host 推出来 */
export function siteUrl(c: Context) {
  return (process.env.SITE_URL || `https://${c.req.header('host') ?? 'localhost'}`).replace(/\/$/, '')
}

type Page = { title: string; description: string; path: string; body: string; status: 200 | 404; image: string }

/** 分享卡片（npm run gen:og 生成）；这碗汤没有专属卡片就用首页那张 */
const ogImage = (id?: string) => (id && existsSync(`dist/og/${id}.jpg`) ? `/og/${id}.jpg` : '/og/home.jpg')

function lobbyPage(): Page {
  const list = [...stories.values()]
    .map(s => `<li><a href="/soup/${s.id}">${esc(s.title)}</a>：${esc(s.teaser)}（${esc(s.difficulty)}）</li>`)
    .join('')
  return {
    title: `${SITE_NAME} · 海龟汤`,
    description: SITE_DESC,
    path: '/',
    status: 200,
    image: ogImage(),
    body: `<h1>${SITE_NAME}</h1><p>${esc(SITE_DESC)}</p><ul>${list}</ul>`,
  }
}

function storyPage(s: Story): Page {
  return {
    title: `${s.title} · ${SITE_NAME}`,
    description: `海龟汤《${s.title}》：${s.teaser}${s.tags.length ? `（${s.tags.join(' · ')}）` : ''}`,
    path: `/soup/${s.id}`,
    status: 200,
    image: ogImage(s.id),
    body: `<h1>${esc(s.title)}</h1><p>${esc(s.tags.join(' · '))}</p><p>${esc(s.teaser)}</p><h2>汤面</h2><p>${esc(s.surface)}</p><p><a href="/">回到${SITE_NAME}</a></p>`,
  }
}

function notFoundPage(path: string): Page {
  return { ...lobbyPage(), title: `找不到这一页 · ${SITE_NAME}`, path, status: 404 }
}

export function pageFor(path: string): Page {
  if (path === '/' || path === '/index.html') return lobbyPage()
  const m = path.match(/^\/soup\/([a-z0-9-]+)\/?$/)
  const s = m && stories.get(m[1])
  if (s) return storyPage(s)
  return notFoundPage(path)
}

/** 把页面信息写进构建出来的 index.html */
export function renderPage(indexHtml: string, page: Page, origin: string) {
  const url = origin + page.path
  const head = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    page.status === 404 ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta property="og:image" content="${esc(origin + page.image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    // 让搜索结果里显示站点名“夜半汤馆”，而不是域名
    page.path === '/' ? `<script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, alternateName: `${SITE_NAME} · 海龟汤`, url: `${origin}/` })}</script>` : '',
  ]
    .filter(Boolean)
    .join('\n    ')
  return indexHtml
    .replace(/<title>[^<]*<\/title>/, head)
    .replace('<div id="root"></div>', `<div id="root"><main class="seo-fallback">${page.body}</main></div>`)
}

export function robotsTxt(origin: string) {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`
}

export function sitemapXml(origin: string) {
  const urls = ['/', ...[...stories.keys()].map(id => `/soup/${id}`)]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${esc(origin + u)}</loc></url>`).join('\n')}
</urlset>
`
}
