import { readFileSync, existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { getConnInfo } from '@hono/node-server/conninfo'
import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { APIError } from 'openai'
import { config, mockMode } from './config.ts'
import { askHost, judgeGuess } from './host.ts'
import { llmGate } from './llm.ts'
import { RateLimiter } from './rateLimit.ts'
import { QueueFullError, QueueTimeoutError } from './semaphore.ts'
import { sessions, type Session } from './sessions.ts'
import { catalogView, publicView, stories } from './stories.ts'

const MAX_QUESTION = 200
const MAX_GUESS = 1000
/** 两次氛围反馈之间至少间隔几问 */
const CUE_COOLDOWN = 4

const llmLimiter = RateLimiter.perMinute(config.rateLimit.perIpPerMin)
const sessionLimiter = RateLimiter.perMinute(config.rateLimit.sessionsPerIpPerMin)

const app = new Hono()

function clientIp(c: Context): string {
  if (config.trustProxy) {
    const xff = c.req.header('x-forwarded-for')
    if (xff) return xff.split(',')[0].trim()
  }
  return getConnInfo(c).remote.address ?? 'unknown'
}

function fail(status: 400 | 404 | 409 | 429 | 502 | 503, message: string): never {
  throw new HTTPException(status, { message })
}

function scoreOf(s: Session) {
  const story = stories.get(s.storyId)!
  return s.scoreHits.reduce((sum, i) => sum + (story.scoring.items[i]?.score ?? 0), 0)
}

function sessionView(s: Session) {
  return {
    id: s.id,
    storyId: s.storyId,
    entries: s.entries,
    milestones: s.milestones,
    hintsUsed: s.hintsUsed,
    scoreHits: s.scoreHits,
    score: scoreOf(s),
    questionCount: s.questionCount,
    status: s.status,
  }
}

function loadSession(c: Context) {
  const s = sessions.get(c.req.param('id') ?? '')
  if (!s) fail(404, '这一局已经过期了，请重新开始。')
  const story = stories.get(s.storyId)
  if (!story) fail(404, '这碗汤已经下架了。')
  return { s, story }
}

/** 需要调用 LLM 的接口：限流 + 会话独占 */
async function guarded<T>(c: Context, s: Session, fn: () => Promise<T>): Promise<T> {
  if (!llmLimiter.take(clientIp(c))) fail(429, '问得太快了，歇一口气再问。')
  const r = await sessions.exclusive(s.id, fn)
  if (r === null) fail(409, '主持人还在想上一个问题。')
  return r
}

async function readJSON<T>(c: Context): Promise<Partial<T>> {
  try {
    return (await c.req.json()) as Partial<T>
  } catch {
    return {}
  }
}

app.use('/api/*', bodyLimit({ maxSize: 8 * 1024, onError: c => c.json({ error: '内容太长了。' }, 413) }))

app.get('/api/health', c => c.json({ ok: true, mock: mockMode, sessions: sessions.size, llm: llmGate.stats }))

app.get('/api/stories', c => c.json({ stories: [...stories.values()].map(catalogView) }))

app.post('/api/sessions', async c => {
  const { storyId } = await readJSON<{ storyId: string }>(c)
  const story = stories.get(String(storyId ?? ''))
  if (!story) fail(404, '没有这碗汤。')
  if (!sessionLimiter.take(clientIp(c))) fail(429, '开局太频繁了，稍后再试。')
  const s = sessions.create(story.id)
  return c.json({ session: sessionView(s), story: publicView(story), mock: mockMode })
})

app.get('/api/sessions/:id', c => {
  const { s, story } = loadSession(c)
  return c.json({ session: sessionView(s), story: publicView(story), mock: mockMode })
})

app.post('/api/sessions/:id/ask', async c => {
  const { s, story } = loadSession(c)
  const { question } = await readJSON<{ question: string }>(c)
  const q = String(question ?? '').trim()
  if (!q) fail(400, '你想问什么？')
  if (q.length > MAX_QUESTION) fail(400, `问题请控制在 ${MAX_QUESTION} 字以内。`)
  if (s.status !== 'playing') fail(409, '这一局已经结束了。')
  if (s.questionCount >= config.session.maxQuestions) fail(409, '已经问得够多了，试着还原真相吧。')

  return guarded(c, s, async () => {
    const r = await askHost(story, s, q)
    // 写回发生在 LLM 返回之后、仍持有会话独占期间，不会与同会话的其他请求交错
    const entry =
      r.type === 'answer'
        ? ({ kind: 'ask', q, type: 'answer', answer: r.answer, note: r.note, at: Date.now() } as const)
        : ({ kind: 'ask', q, type: 'invalid', note: r.note, at: Date.now() } as const)
    s.entries.push(entry)
    if (r.type === 'answer') s.questionCount++
    const newMilestones = r.milestones.filter(m => !s.milestones.includes(m))
    s.milestones = r.milestones
    // cue 是一次性的氛围指令，不写入会话（刷新后不重放）。模型不擅长控制频率，这里强制冷却。
    let cue = r.type === 'answer' ? r.cue : null
    if (cue && s.questionCount - s.lastCueAt < CUE_COOLDOWN) cue = null
    if (cue) s.lastCueAt = s.questionCount
    return c.json({ entry, newMilestones, cue, session: sessionView(s) })
  })
})

app.post('/api/sessions/:id/guess', async c => {
  const { s, story } = loadSession(c)
  const { text } = await readJSON<{ text: string }>(c)
  const t = String(text ?? '').trim()
  if (t.length < 10) fail(400, '把你想到的真相完整地说出来。')
  if (t.length > MAX_GUESS) fail(400, `请控制在 ${MAX_GUESS} 字以内。`)
  if (s.status !== 'playing') fail(409, '这一局已经结束了。')
  if (s.guessCount >= config.session.maxGuesses) fail(409, '还原次数用完了。')

  return guarded(c, s, async () => {
    const r = await judgeGuess(story, s, t)
    s.guessCount++
    s.scoreHits = [...new Set([...s.scoreHits, ...r.hits])].sort()
    const score = scoreOf(s)
    const entry = { kind: 'guess', text: t, score, hits: r.hits, feedback: r.feedback, at: Date.now() } as const
    s.entries.push(entry)
    const solved = score >= story.host.passScore
    if (solved) s.status = 'solved'
    return c.json({ entry, solved, session: sessionView(s) })
  })
})

app.post('/api/sessions/:id/hint', async c => {
  const { s, story } = loadSession(c)
  if (s.status !== 'playing') fail(409, '这一局已经结束了。')
  const r = await sessions.exclusive(s.id, async () => {
    const remaining = story.hints.filter(h => !s.hintsUsed.includes(h.level)).sort((a, b) => a.level - b.level)
    // 跳过所指向里程碑已经达成的提示
    const hint = remaining.find(h => {
      const target = story.host.hintTargets[String(h.level)]
      return !target || !s.milestones.includes(target)
    })
    if (!hint) return { entry: null, session: sessionView(s) }
    s.hintsUsed.push(hint.level)
    const entry = { kind: 'hint', level: hint.level, text: hint.text, at: Date.now() } as const
    s.entries.push(entry)
    return { entry, session: sessionView(s) }
  })
  if (!r) fail(409, '主持人还在想上一个问题。')
  return c.json(r)
})

app.post('/api/sessions/:id/reveal', async c => {
  const { s, story } = loadSession(c)
  if (s.status === 'playing') {
    s.status = 'revealed'
    sessions.touch()
  }
  return c.json({
    session: sessionView(s),
    reveal: {
      bottom: story.bottom,
      oneLine: story.oneLine,
      storyline: story.storyline,
      scoring: story.scoring,
      credits: story.credits ?? '',
    },
  })
})

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  if (err instanceof QueueFullError || err instanceof QueueTimeoutError) {
    return c.json({ error: '来的人太多，主持人忙不过来，请稍后再问。' }, 503)
  }
  if (err instanceof APIError) {
    console.error('[llm]', err.status, err.message)
    return c.json({ error: '主持人一时没有回应，请再问一次。' }, 502)
  }
  console.error(err)
  return c.json({ error: '出了点问题，请再试一次。' }, 500)
})

// 生产环境由同一进程托管前端构建产物
if (config.isProd && existsSync('dist/index.html')) {
  const indexHtml = readFileSync('dist/index.html', 'utf8')
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', c => c.html(indexHtml))
}

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, info => {
  console.log(`[haiguitang] http://localhost:${info.port}  stories=${stories.size}  ${mockMode ? 'MOCK 主持人（未配置 LLM_API_KEY）' : `model=${config.llm.model}`}`)
})

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    // 先停止接新连接，等在途请求（可能正在等 LLM）结束后再落盘退出
    const exit = () => {
      sessions.save()
      process.exit(0)
    }
    server.close(exit)
    setTimeout(exit, 8000).unref()
  })
}
