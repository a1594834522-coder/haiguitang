import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export type QAItem = { q: string; a: string; note?: string }
export type Milestone = { id: string; label: string; desc: string; keywords?: string[] }

export type Story = {
  id: string
  title: string
  tags: string[]
  difficulty: string
  teaser: string
  surface: string
  bottom: string[]
  oneLine: string
  storyline: { stage: string; text: string }[]
  clues: { surface: string; truth: string }[]
  qa: { group: string; items: QAItem[] }[]
  challenges: { q: string; a: string }[]
  hints: { level: number; text: string; when?: string }[]
  scoring: { total: number; items: { point: string; score: number }[]; pass: string }
  hostNotes: string[]
  credits?: string
  host: {
    passScore: number
    milestones: Milestone[]
    spoilerTerms: string[]
    /** 提示等级 -> 该提示所指向的里程碑；里程碑已达成则跳过该提示 */
    hintTargets: Record<string, string>
    /** 主持人可选的即时氛围反馈（白名单），前端布景负责具体表现 */
    cues?: { id: string; desc: string }[]
  }
}

/** 玩家在游戏中可以看到的部分（不含汤底、故事线、问答参考等） */
export function publicView(s: Story) {
  return {
    id: s.id,
    title: s.title,
    tags: s.tags,
    difficulty: s.difficulty,
    teaser: s.teaser,
    surface: s.surface,
    hintCount: s.hints.length,
    scoringTotal: s.scoring.total,
    passScore: s.host.passScore,
    milestones: s.host.milestones.map(m => ({ id: m.id, label: m.label })),
  }
}

/** 目录页只需要的信息 */
export function catalogView(s: Story) {
  return { id: s.id, title: s.title, tags: s.tags, difficulty: s.difficulty, teaser: s.teaser }
}

const STORIES_DIR = resolve(process.cwd(), 'stories')

function validate(s: Story, file: string) {
  const need = ['id', 'title', 'surface', 'bottom', 'storyline', 'qa', 'scoring', 'host'] as const
  for (const k of need) if (!(k in s)) throw new Error(`${file}: 缺少字段 ${k}`)
  if (!/^[a-z0-9-]+$/.test(s.id)) throw new Error(`${file}: id 只能包含小写字母、数字和连字符`)
  const ids = new Set(s.host.milestones.map(m => m.id))
  for (const [lvl, target] of Object.entries(s.host.hintTargets ?? {})) {
    if (!ids.has(target)) throw new Error(`${file}: hintTargets.${lvl} 指向不存在的里程碑 ${target}`)
  }
}

function loadAll(): Map<string, Story> {
  const map = new Map<string, Story>()
  for (const f of readdirSync(STORIES_DIR).filter(f => f.endsWith('.json')).sort()) {
    const s = JSON.parse(readFileSync(join(STORIES_DIR, f), 'utf8')) as Story
    validate(s, f)
    if (map.has(s.id)) throw new Error(`${f}: 重复的 id ${s.id}`)
    map.set(s.id, s)
  }
  return map
}

// 启动时加载一次，之后只读，多请求共享无需加锁
export const stories = loadAll()
