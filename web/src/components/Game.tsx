import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ApiError, api, savedSession } from '../api'
import { audio } from '../audio/engine'
import { navigate } from '../router'
import { sceneFor } from '../scenes'
import type { PublicStory, Reveal as RevealData, SessionView } from '../types'
import { Intro } from './Intro'
import { Logbook } from './Logbook'
import { Reveal } from './Reveal'

const IDLE_MS = 45_000

export function Game({ storyId }: { storyId: string }) {
  const def = sceneFor(storyId)
  const Scene = def.Scene
  const [story, setStory] = useState<PublicStory | null>(null)
  const [session, setSession] = useState<SessionView | null>(null)
  const [mock, setMock] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [phase, setPhase] = useState<'intro' | 'play'>(() => (import.meta.env.DEV && new URLSearchParams(location.search).has('skip') ? 'play' : 'intro'))
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const [cue, setCue] = useState<{ id: string; n: number } | null>(null)
  const [toast, setToast] = useState<{ text: string; kicker: string; n: number } | null>(null)
  const [reveal, setReveal] = useState<RevealData | null>(null)
  const [revealOpen, setRevealOpen] = useState(false)
  const [revealSeen, setRevealSeen] = useState(false)
  // giveup：没通关就揭晓；finish：通关后、还有真相没拼完时去看汤底
  const [confirmReveal, setConfirmReveal] = useState<null | 'giveup' | 'finish'>(null)
  const [idle, setIdle] = useState(false)
  const lastActive = useRef(Date.now())
  const muted = useSyncExternalStore(
    f => audio.subscribe(f),
    () => audio.muted,
  )

  // ---------- 开局 / 恢复 ----------
  const start = useCallback(
    async (fresh: boolean) => {
      setLoadError('')
      try {
        const saved = fresh ? null : savedSession.get(storyId)
        let r = saved ? await api.getSession(saved).catch(e => (e instanceof ApiError && e.status === 404 ? null : Promise.reject(e))) : null
        if (!r) {
          r = await api.createSession(storyId)
          savedSession.set(storyId, r.session.id)
        }
        setStory(r.story)
        setSession(r.session)
        setMock(r.mock)
        document.title = `${r.story.title} · 夜半汤馆`
      } catch (e) {
        setLoadError((e as Error).message)
      }
    },
    [storyId],
  )
  useEffect(() => {
    start(false)
  }, [start])

  // ---------- 发呆检测 ----------
  const activity = useCallback(() => {
    lastActive.current = Date.now()
    setIdle(false)
  }, [])
  useEffect(() => {
    if (phase !== 'play') return
    const t = setInterval(() => {
      if (!thinking && !revealOpen && Date.now() - lastActive.current > IDLE_MS) setIdle(true)
    }, 3000)
    return () => clearInterval(t)
  }, [phase, thinking, revealOpen])

  const showToast = (text: string, kicker = '你 察 觉 到') => setToast(t => ({ text, kicker, n: (t?.n ?? 0) + 1 }))
  // 到了通关线不强制揭晓，让玩家自己决定什么时候看汤底
  const announceSolved = (delay: number) => setTimeout(() => showToast('汤底可以看了', '通 关'), delay)

  // ---------- 动作 ----------
  const fail = (e: unknown) => {
    const err = e as ApiError
    if (err.status === 404) {
      savedSession.clear(storyId)
      setError('这一局已经过期了。刷新页面重新开始。')
    } else setError(err.message)
  }

  const ask = async (q: string) => {
    if (!session) return false
    activity()
    setThinking(true)
    setError('')
    try {
      const r = await api.ask(session.id, q)
      setSession(r.session)
      if (r.entry.kind === 'ask' && r.entry.type === 'answer') audio.stamp()
      if (r.newMilestones.length) {
        const labels = r.session.found.filter(m => r.newMilestones.includes(m.id)).map(m => m.label)
        setTimeout(() => showToast(labels.join(' · ')), 500)
      }
      // 问出来的就算数：对应的里程碑齐了，这一块真相自动拼上
      const pieces = (r.newPieces ?? []).map(i => story?.pieces?.[i]?.title).filter(Boolean)
      if (pieces.length) setTimeout(() => showToast(`拼出了一块真相：${pieces.join('、')}`), r.newMilestones.length ? 3200 : 500)
      if (r.solved) announceSolved(pieces.length ? 6000 : 3000)
      if (r.cue) setCue(c => ({ id: r.cue!, n: (c?.n ?? 0) + 1 }))
      return true
    } catch (e) {
      fail(e)
      return false
    } finally {
      setThinking(false)
    }
  }

  const openReveal = async () => {
    if (!session) return
    setConfirmReveal(null)
    try {
      const r = await api.reveal(session.id)
      setSession(r.session)
      setReveal(r.reveal)
      setRevealOpen(true)
    } catch (e) {
      fail(e)
    }
  }

  const guess = async (t: string) => {
    if (!session) return false
    activity()
    setThinking(true)
    setError('')
    try {
      const r = await api.guess(session.id, t)
      setSession(r.session)
      audio.stamp()
      if (r.solved) announceSolved(1200)
      return true
    } catch (e) {
      fail(e)
      return false
    } finally {
      setThinking(false)
    }
  }

  const hint = async () => {
    if (!session) return
    activity()
    try {
      const r = await api.hint(session.id)
      setSession(r.session)
      if (!r.entry) showToast('没有更多提示了。你已经离真相很近。')
    } catch (e) {
      fail(e)
    }
  }

  const showReveal = () => {
    if (reveal) return setRevealOpen(true)
    const left = (story?.pieces?.length ?? 0) - (session?.scoreHits.length ?? 0)
    if (session?.status === 'solved' && !session.over && left > 0) setConfirmReveal('finish')
    else openReveal()
  }

  const restart = async () => {
    savedSession.clear(storyId)
    setReveal(null)
    setRevealOpen(false)
    setRevealSeen(false)
    setSession(null)
    await start(true)
  }

  // ---------- 渲染 ----------
  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-black text-center">
        <p className="font-hand text-3xl text-blood">{loadError}</p>
        <button onClick={() => navigate('/')} className="text-sm tracking-widest text-ash hover:text-bone">
          ← 回到汤馆
        </button>
      </div>
    )
  }
  if (!story || !session) return <div className="flex h-full items-center justify-center bg-black text-ash/50">掌灯中……</div>

  const clock = def.clock?.(session.questionCount)
  const paused = phase !== 'play' || revealOpen
  // 仅开发环境：?ms=dead,voice&q=12 直接查看某个阶段的布景（生产构建里这段会被整个去掉）
  const dbg = import.meta.env.DEV ? new URLSearchParams(location.search) : null
  const debugMilestones = dbg?.get('ms')?.split(',').filter(Boolean)
  const debugQ = dbg?.get('q') ? Number(dbg.get('q')) : undefined
  // 白天的场景上，浅色字看不清
  const light = def.tone === 'light'

  return (
    <div className="fixed inset-0 overflow-hidden bg-black" onPointerDown={activity}>
      {/* 场景：桌面在记录本左侧，手机在记录本上方 */}
      <div className="absolute inset-x-0 top-0 bottom-[56dvh] lg:bottom-0 lg:right-[440px]">
        <Scene milestones={debugMilestones ?? session.milestones} questionCount={debugQ ?? session.questionCount} thinking={thinking} idle={idle} paused={paused} cue={cue} />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-6">
          <div className="pointer-events-auto">
            <button onClick={() => navigate('/')} className={`text-[11px] tracking-[.3em] transition ${light ? 'text-[#3b2a1a]/70 hover:text-[#1d130b]' : 'text-ash/60 hover:text-bone'}`}>
              ← 汤馆
            </button>
            <h1 className={`mt-1 font-hand text-3xl sm:text-4xl ${light ? 'text-[#2a1a0e] drop-shadow-[0_1px_6px_rgba(255,250,235,.8)]' : 'text-bone/90 drop-shadow-[0_2px_8px_#000]'}`}>{story.title}</h1>
            <p className={`mt-1 hidden text-[11px] tracking-wider sm:block ${light ? 'text-[#3b2a1a]/70' : 'text-ash/60'}`}>{story.tags.join(' · ')}</p>
            {mock && <p className="mt-2 inline-block border border-amber-700/50 px-1.5 text-[10px] text-amber-600/80">模拟主持人</p>}
          </div>
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              {clock && (
                <span
                  className={`font-serif text-2xl tabular-nums tracking-wider ${light ? 'text-[#2a1a0e]/85 drop-shadow-[0_1px_6px_rgba(255,250,235,.9)]' : 'text-bone/80 drop-shadow-[0_2px_6px_#000]'}`}
                  title="每问一个问题，时间就过去一些"
                >
                  {clock.label}
                </span>
              )}
              <button
                onClick={() => audio.setMuted(!muted)}
                className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${light ? 'border-[#3b2a1a]/25 text-[#3b2a1a]/80 hover:border-[#3b2a1a]/60' : 'border-white/15 text-ash hover:border-white/40 hover:text-bone'}`}
                aria-label={muted ? '打开声音' : '关闭声音'}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 9h4l5-4v14l-5-4H4z" />
                  {muted ? <path d="M17 9l5 5M22 9l-5 5" /> : <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />}
                </svg>
              </button>
            </div>
            {clock?.caption && <span className="font-hand text-lg text-blood/80">{clock.caption}</span>}
          </div>
        </div>

        {toast && (
          <div key={toast.n} className="clue-toast pointer-events-none absolute inset-x-0 top-[22%] text-center">
            <p className="text-[11px] tracking-[.6em] text-ash/70">{toast.kicker}</p>
            <p className="mt-2 font-hand text-4xl text-bone drop-shadow-[0_0_20px_rgba(160,20,10,.8)] sm:text-5xl">{toast.text}</p>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-[56dvh] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-[440px]">
        <Logbook
          story={story}
          session={session}
          def={def}
          thinking={thinking}
          idle={idle}
          error={error}
          onAsk={ask}
          onGuess={guess}
          onHint={hint}
          onReveal={() => setConfirmReveal('giveup')}
          onShowReveal={showReveal}
          onActivity={activity}
        />
      </div>

      <div className="grain" />
      <div className="scanlines" />

      {confirmReveal && (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/80 p-6" onClick={() => setConfirmReveal(null)}>
          <div className="fade-in max-w-sm border border-white/10 bg-[#0d0b0a] p-7 text-center" onClick={e => e.stopPropagation()}>
            <p className="font-hand text-3xl text-bone">{confirmReveal === 'finish' ? '现在就看汤底吗？' : '真的不再想想吗？'}</p>
            <p className="mt-4 text-sm leading-7 text-ash">
              {confirmReveal === 'finish'
                ? `还有 ${(story.pieces?.length ?? 0) - session.scoreHits.length} 块真相没拼出来。看过汤底，这一局就结束了。`
                : '揭晓之后，这一局就结束了。'}
            </p>
            <div className="mt-7 flex justify-center gap-3 text-sm">
              <button onClick={() => setConfirmReveal(null)} className="border border-white/15 px-5 py-2 text-bone/80 hover:border-white/40">
                {confirmReveal === 'finish' ? '继续问' : '再想想'}
              </button>
              <button onClick={openReveal} className="border border-blood/60 px-5 py-2 text-blood hover:bg-blood/10">
                {confirmReveal === 'finish' ? '看汤底' : '揭晓汤底'}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'intro' && <Intro story={story} def={def} resuming={session.entries.length > 0} onDone={() => setPhase('play')} />}

      {revealOpen && reveal && (
        <Reveal
          story={story}
          session={session}
          data={reveal}
          def={def}
          skipBeats={revealSeen}
          onClose={() => {
            setRevealSeen(true)
            setRevealOpen(false)
          }}
          onRestart={restart}
          onLobby={() => navigate('/')}
        />
      )}
    </div>
  )
}
