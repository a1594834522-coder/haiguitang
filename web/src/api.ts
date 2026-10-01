import type { CatalogItem, Entry, PublicStory, Reveal, SessionView } from './types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, '连不上主持人，检查一下网络。')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error || '出了点问题。')
  return data as T
}

type SessionPayload = { session: SessionView; story: PublicStory; mock: boolean }

export const api = {
  stories: () => call<{ stories: CatalogItem[] }>('/stories'),
  createSession: (storyId: string) => call<SessionPayload>('/sessions', { storyId }),
  getSession: (id: string) => call<SessionPayload>(`/sessions/${id}`),
  ask: (id: string, question: string) =>
    call<{ entry: Entry; newMilestones: string[]; newPieces: number[]; solved: boolean; cue: string | null; session: SessionView }>(`/sessions/${id}/ask`, { question }),
  guess: (id: string, text: string) => call<{ entry: Entry; solved: boolean; session: SessionView }>(`/sessions/${id}/guess`, { text }),
  hint: (id: string) => call<{ entry: Entry | null; session: SessionView }>(`/sessions/${id}/hint`, {}),
  reveal: (id: string) => call<{ session: SessionView; reveal: Reveal }>(`/sessions/${id}/reveal`, {}),
}

// 每碗汤记住当前这一局，刷新页面可以继续
const key = (storyId: string) => `hgt:session:${storyId}`
export const savedSession = {
  get: (storyId: string) => {
    try {
      return localStorage.getItem(key(storyId))
    } catch {
      return null
    }
  },
  set: (storyId: string, id: string) => {
    try {
      localStorage.setItem(key(storyId), id)
    } catch {}
  },
  clear: (storyId: string) => {
    try {
      localStorage.removeItem(key(storyId))
    } catch {}
  },
}
