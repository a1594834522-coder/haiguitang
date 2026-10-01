export type Answer = '是' | '不是' | '是也不是' | '无关' | '不知道'

export type Entry =
  | { kind: 'ask'; q: string; type: 'answer'; answer: Answer; note: string; at: number }
  | { kind: 'ask'; q: string; type: 'invalid'; note: string; at: number }
  | { kind: 'guess'; text: string; score: number; hits: number[]; feedback: string; at: number }
  | { kind: 'hint'; level: number; text: string; at: number }

export type CatalogItem = { id: string; title: string; tags: string[]; difficulty: string; teaser: string }

export type PublicStory = CatalogItem & {
  surface: string
  hintCount: number
  scoringTotal: number
  passScore: number
  milestoneCount: number
  /** 答案锁住：只有还原通关后才能看汤底 */
  revealLocked: boolean
}

export type SessionView = {
  id: string
  storyId: string
  entries: Entry[]
  milestones: string[]
  /** 已达成的里程碑（只有达成的才有名字） */
  found: { id: string; label: string }[]
  hintsUsed: number[]
  scoreHits: number[]
  score: number
  questionCount: number
  status: 'playing' | 'solved' | 'revealed'
}

export type Reveal = {
  bottom: string[]
  oneLine: string
  storyline: { stage: string; text: string }[]
  scoring: { total: number; items: { point: string; score: number }[]; pass: string }
  credits: string
}
