import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from './config.ts'

export type Answer = '是' | '不是' | '是也不是' | '无关' | '不知道'

export type Entry =
  | { kind: 'ask'; q: string; type: 'answer'; answer: Answer; note: string; at: number }
  | { kind: 'ask'; q: string; type: 'invalid'; note: string; at: number }
  | { kind: 'guess'; text: string; score: number; hits: number[]; feedback: string; at: number }
  | { kind: 'hint'; level: number; text: string; at: number }

export type Session = {
  id: string
  storyId: string
  createdAt: number
  lastActive: number
  entries: Entry[]
  milestones: string[]
  hintsUsed: number[]
  /** 历次还原中命中过的计分点（取并集） */
  scoreHits: number[]
  questionCount: number
  guessCount: number
  /** 上一次触发氛围反馈时的提问序号，用于冷却 */
  lastCueAt: number
  status: 'playing' | 'solved' | 'revealed'
}

/**
 * 会话存储。
 *
 * 并发模型：
 * - Node 单线程事件循环，Map 的读写本身是原子的；
 * - 真正的竞态发生在「读会话 → await LLM → 写会话」之间。同一会话如果同时发来两个问题，
 *   两次 LLM 回调会交错修改 entries/milestones。所以每个会话持有一个 busy 标记，
 *   在同步代码段里检查并置位，处理完毕再释放，第二个并发请求直接返回 409。
 * - 不同会话之间完全独立，互不阻塞。
 *
 * 当前实现是单进程内存存储，定期并在退出时落盘到 SESSION_FILE，重启/发版不丢局。
 * 若要多进程/多实例部署，把这个类换成 Redis 实现（busy 锁对应 SET NX PX），接口保持不变即可。
 */
export class SessionStore {
  private sessions = new Map<string, Session>()
  private busy = new Set<string>()
  private dirty = false

  constructor(private file = config.session.file) {
    setInterval(() => this.sweep(), 5 * 60_000).unref()
    if (this.file) {
      this.load()
      setInterval(() => this.dirty && this.save(), 60_000).unref()
    }
  }

  /** 标记有改动，下一次定时落盘时写出 */
  touch() {
    this.dirty = true
  }

  /** 原子写：先写临时文件再 rename，避免写到一半崩溃留下坏文件 */
  save() {
    if (!this.file) return
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      const tmp = `${this.file}.tmp`
      writeFileSync(tmp, JSON.stringify([...this.sessions.values()]))
      renameSync(tmp, this.file)
      this.dirty = false
    } catch (e) {
      console.error('[sessions] 落盘失败', e)
    }
  }

  private load() {
    if (!this.file || !existsSync(this.file)) return
    try {
      const cutoff = Date.now() - config.session.ttlMs
      const list = JSON.parse(readFileSync(this.file, 'utf8')) as Session[]
      for (const s of list) {
        if (s.lastActive < cutoff) continue
        // JSON 里 -Infinity 会变成 null
        if (typeof s.lastCueAt !== 'number') s.lastCueAt = -Infinity
        this.sessions.set(s.id, s)
      }
      console.log(`[sessions] 恢复了 ${this.sessions.size} 局`)
    } catch (e) {
      console.error('[sessions] 读取失败，忽略旧数据', e)
    }
  }

  get size() {
    return this.sessions.size
  }

  create(storyId: string): Session {
    if (this.sessions.size >= config.session.maxSessions) this.evictOldest()
    const now = Date.now()
    const s: Session = {
      id: randomUUID(),
      storyId,
      createdAt: now,
      lastActive: now,
      entries: [],
      milestones: [],
      hintsUsed: [],
      scoreHits: [],
      questionCount: 0,
      guessCount: 0,
      lastCueAt: -Infinity,
      status: 'playing',
    }
    this.sessions.set(s.id, s)
    this.dirty = true
    return s
  }

  get(id: string): Session | undefined {
    const s = this.sessions.get(id)
    if (s) s.lastActive = Date.now()
    return s
  }

  /** 独占执行：同一会话同一时刻只允许一个修改性请求。返回 null 表示该会话正忙。 */
  async exclusive<T>(id: string, fn: () => Promise<T>): Promise<T | null> {
    if (this.busy.has(id)) return null
    this.busy.add(id)
    try {
      return await fn()
    } finally {
      this.busy.delete(id)
      this.dirty = true
    }
  }

  private sweep() {
    const cutoff = Date.now() - config.session.ttlMs
    for (const [id, s] of this.sessions) {
      if (s.lastActive < cutoff && !this.busy.has(id)) this.sessions.delete(id)
    }
  }

  private evictOldest() {
    // Map 按插入顺序迭代；先删最早创建且空闲的那批
    let n = Math.max(1, Math.floor(config.session.maxSessions * 0.05))
    for (const [id] of this.sessions) {
      if (n <= 0) break
      if (this.busy.has(id)) continue
      this.sessions.delete(id)
      n--
    }
  }
}

export const sessions = new SessionStore()
