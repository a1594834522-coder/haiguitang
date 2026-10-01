import { chatJSON } from './llm.ts'
import { askSystemPrompt, guessSystemPrompt } from './prompts.ts'
import { config, mockMode } from './config.ts'
import type { Answer, Entry, Session } from './sessions.ts'
import type { Story } from './stories.ts'

const ANSWERS: Answer[] = ['是', '不是', '是也不是', '无关', '不知道']

function historyText(entries: Entry[]): string {
  const lines: string[] = []
  for (const e of entries.slice(-40)) {
    if (e.kind === 'ask' && e.type === 'answer') lines.push(`问：${e.q}　答：${e.answer}${e.note ? `（${e.note}）` : ''}`)
    if (e.kind === 'hint') lines.push(`（主持人给出提示：${e.text}）`)
  }
  return lines.length ? lines.map((l, i) => `${i + 1}. ${l}`).join('\n') : '（无）'
}

// ---------- 提问 ----------

export type AskResult =
  | { type: 'answer'; answer: Answer; note: string; milestones: string[]; cue: string | null }
  | { type: 'invalid'; note: string; milestones: string[]; cue: null }

type RawAsk = { type?: string; answer?: string; note?: string; milestones?: unknown; cue?: unknown }

export async function askHost(story: Story, session: Session, question: string): Promise<AskResult> {
  const { data: raw, reasoning } = mockMode
    ? { data: await mockDelay(() => mockAsk(story, question)), reasoning: '' }
    : await chatJSON<RawAsk>([
        { role: 'system', content: askSystemPrompt(story) },
        {
          role: 'user',
          content: `【已达成的里程碑】${session.milestones.join('、') || '（无）'}\n\n【此前问答】\n${historyText(session.entries)}\n\n【本次提问】\n<<<\n${question}\n>>>`,
        },
      ])

  if (!config.isProd) console.log(`[host] ${question} → ${raw.answer || raw.type} ${JSON.stringify(raw.milestones)} cue=${raw.cue || '-'}\n        ${reasoning.replace(/\s+/g, ' ').slice(0, 240)}`)

  const known = new Set(story.host.milestones.map(m => m.id))
  const reported = Array.isArray(raw.milestones) ? raw.milestones.filter((x): x is string => typeof x === 'string' && known.has(x)) : []

  if (raw.type === 'invalid') {
    return { type: 'invalid', note: sanitizeNote(story, session, question, raw.note) || '请提出可以用“是”或“不是”回答的问题。', milestones: session.milestones, cue: null }
  }
  const answer = normalizeAnswer(raw.answer ?? '')
  // 里程碑只增不减；模型漏报之前的不影响
  const milestones = [...new Set([...session.milestones, ...reported])]
  // cue 必须在白名单内，否则丢弃
  const cue = typeof raw.cue === 'string' && story.host.cues?.some(c => c.id === raw.cue) ? raw.cue : null
  return { type: 'answer', answer, note: sanitizeNote(story, session, question, raw.note), milestones, cue }
}

// ---------- 还原 ----------

export type GuessResult = { hits: number[]; feedback: string }

export async function judgeGuess(story: Story, session: Session, text: string): Promise<GuessResult> {
  const { data: raw } = mockMode
    ? { data: await mockDelay(() => mockGuess(story, text)) }
    : await chatJSON<{ hits?: unknown; feedback?: string }>(
        [
          { role: 'system', content: guessSystemPrompt(story) },
          {
            role: 'user',
            content: `【已经拼出的计分点】${session.scoreHits.join('、') || '（无）'}\n\n【玩家的还原】\n<<<\n${text}\n>>>`,
          },
        ],
        { maxTokens: 8000 },
      )
  const n = story.scoring.items.length
  const hits = Array.isArray(raw.hits) ? [...new Set(raw.hits.map(Number).filter(i => Number.isInteger(i) && i >= 0 && i < n))] : []
  const fallback = hits.length >= n ? '你看见了那一夜。' : '还差一些。汤面里还有细节没有解释。'
  return { hits, feedback: sanitizeNote(story, session, text, raw.feedback, 60) || fallback }
}

// ---------- 工具 ----------

export function normalizeAnswer(a: string): Answer {
  const t = a.replace(/[。！!.\s“”"]/g, '')
  if (ANSWERS.includes(t as Answer)) return t as Answer
  if (t === '否' || t === '不') return '不是'
  if (t.startsWith('是也不') || t.includes('部分')) return '是也不是'
  if (t.startsWith('是')) return '是'
  if (t.startsWith('不是') || t.startsWith('否')) return '不是'
  if (t.includes('无关')) return '无关'
  return '不知道'
}

/**
 * 服务端兜底防剧透：note 里如果出现玩家从未提到过的剧透词，整条 note 丢弃。
 * 模型偶尔会“好心”多说一句，这一层保证不会因此泄底。
 */
function sanitizeNote(story: Story, session: Session, question: string, note: unknown, maxLen = 40): string {
  if (typeof note !== 'string') return ''
  const n = note.trim().slice(0, maxLen)
  if (!n) return ''
  const said = [question, ...session.entries.map(e => (e.kind === 'ask' ? e.q : e.kind === 'guess' ? e.text : e.text))].join('\n')
  for (const term of story.host.spoilerTerms) {
    if (n.includes(term) && !said.includes(term)) return ''
  }
  return n
}

// ---------- 无 API Key 时的本地模拟主持人（仅供开发调试） ----------

const MOCK_DELAY_MS = Number(process.env.MOCK_DELAY_MS ?? 900)
const mockDelay = <T>(fn: () => T) => new Promise<T>(r => setTimeout(() => r(fn()), MOCK_DELAY_MS))

function bigrams(s: string) {
  const t = s.replace(/[\s，。？！、“”‘’"'?!,.（）()]/g, '').replace(/^我/, '')
  const set = new Set<string>()
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2))
  return set
}

function mockAsk(story: Story, q: string): RawAsk {
  if (/^(为什么|为啥|怎么|谁|什么|哪)/.test(q) || q.includes('汤底')) return { type: 'invalid', note: '请提出可以用“是”或“不是”回答的问题。' }
  const qb = bigrams(q)
  let best: { a: string; note?: string; score: number } | null = null
  for (const g of story.qa)
    for (const it of g.items) {
      const ib = bigrams(it.q)
      let inter = 0
      for (const b of qb) if (ib.has(b)) inter++
      const score = inter / Math.max(1, Math.min(qb.size, ib.size))
      if (!best || score > best.score) best = { a: it.a, note: it.note, score }
    }
  const answer = best && best.score >= 0.5 ? best.a : '不知道'
  const yes = answer === '是' || answer === '是也不是' || answer === '否'
  const milestones = yes ? story.host.milestones.filter(m => m.keywords?.some(k => q.includes(k))).map(m => m.id) : []
  return { type: 'answer', answer, note: answer === '是也不是' ? best?.note : '', milestones, cue: milestones.length ? 'knock' : '' }
}

function mockGuess(story: Story, text: string): { hits: number[]; feedback: string } {
  const rules: string[][] = [['棺', '求救|救'], ['救', '球'], ['爸', '掩盖|盖住|别停']]
  const hits = rules.map((r, i) => (r.every(p => new RegExp(p).test(text)) ? i : -1)).filter(i => i >= 0)
  if (/儿子|轮回/.test(text)) hits.push(story.scoring.items.length - 1)
  return { hits, feedback: hits.length >= 3 ? '你看见了那一夜。' : '还差一些。爸爸那句“别停”，你想明白了吗？' }
}
