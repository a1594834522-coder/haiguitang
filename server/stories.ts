import { existsSync, readdirSync, readFileSync } from 'node:fs'
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
  scoring: {
    total: number
    items: {
      point: string
      score: number
      /** 给玩家看的模糊标题（如“关于那个声音”），不能剧透 */
      title?: string
      /** 这些里程碑在提问中全部达成，就自动拿到这一分，不用再在还原里复述 */
      milestones?: string[]
    }[]
    pass: string
  }
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
    /** 锁住答案：只有还原通关后才能看汤底，不能中途“揭晓” */
    lockReveal?: boolean
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
    // 只给总数：里程碑的名字本身就是剧透，达成之后才随会话下发
    milestoneCount: s.host.milestones.length,
    revealLocked: !!s.host.lockReveal,
    // 还原面板上的“拼图”：只有模糊标题和分值
    pieces: s.scoring.items.every(it => it.title) ? s.scoring.items.map(it => ({ title: it.title!, score: it.score })) : null,
  }
}

/** 提问中已经问出来的计分点（对应的里程碑全部达成） */
export function piecesFromMilestones(s: Story, milestones: string[]): number[] {
  return s.scoring.items.flatMap((it, i) => (it.milestones?.length && it.milestones.every(m => milestones.includes(m)) ? [i] : []))
}

/** 目录页只需要的信息 */
export function catalogView(s: Story) {
  return { id: s.id, title: s.title, tags: s.tags, difficulty: s.difficulty, teaser: s.teaser }
}

const STORIES_DIR = resolve(process.cwd(), 'stories')
/**
 * 不进 git 仓库的剧本（仓库是公开的，放进 stories/ 等于公开答案）。
 * 本地默认读 stories-private/，线上通过 STORIES_PRIVATE_DIR 指到服务器上的目录。
 */
const PRIVATE_DIR = resolve(process.cwd(), process.env.STORIES_PRIVATE_DIR || 'stories-private')

function validate(s: Story, file: string) {
  const need = ['id', 'title', 'surface', 'bottom', 'storyline', 'qa', 'scoring', 'host'] as const
  for (const k of need) if (!(k in s)) throw new Error(`${file}: 缺少字段 ${k}`)
  if (!/^[a-z0-9-]+$/.test(s.id)) throw new Error(`${file}: id 只能包含小写字母、数字和连字符`)
  const ids = new Set(s.host.milestones.map(m => m.id))
  for (const [lvl, target] of Object.entries(s.host.hintTargets ?? {})) {
    if (!ids.has(target)) throw new Error(`${file}: hintTargets.${lvl} 指向不存在的里程碑 ${target}`)
  }
  s.scoring.items.forEach((it, i) => {
    for (const m of it.milestones ?? []) if (!ids.has(m)) throw new Error(`${file}: scoring.items[${i}].milestones 指向不存在的里程碑 ${m}`)
  })
}

function loadAll(): Map<string, Story> {
  const map = new Map<string, Story>()
  for (const dir of [STORIES_DIR, PRIVATE_DIR]) {
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
      const s = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Story
      validate(s, f)
      if (map.has(s.id)) throw new Error(`${f}: 重复的 id ${s.id}`)
      map.set(s.id, s)
    }
  }
  return map
}

// 启动时加载一次，之后只读，多请求共享无需加锁
export const stories = loadAll()
