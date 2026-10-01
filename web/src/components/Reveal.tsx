import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RevealBeat, SceneDef } from '../scenes'
import type { PublicStory, Reveal as RevealData, SessionView } from '../types'

type Props = {
  story: PublicStory
  session: SessionView
  data: RevealData
  def: SceneDef
  /** 已经看过一遍的，直接显示总结 */
  skipBeats: boolean
  onClose: () => void
  onRestart: () => void
  onLobby: () => void
}

const holdOf = (b: RevealBeat) => b.hold ?? 2200 + b.text.length * 85

/** 汤底：一句一句念出来，关键句清屏单独停顿。 */
export function Reveal({ story, session, data, def, skipBeats, onClose, onRestart, onLobby }: Props) {
  const beats = useMemo<RevealBeat[]>(() => def.revealBeats?.(data.bottom) ?? data.bottom.map(text => ({ text })), [def, data.bottom])
  const [i, setI] = useState(skipBeats ? beats.length : 0)
  const done = i >= beats.length

  // 当前屏幕上显示的拍：从最近一次 isolated/final 之后开始累积
  const screen = useMemo(() => {
    if (done) return []
    const cur = beats[i]
    if (cur.style === 'isolated' || cur.style === 'final') return [cur]
    let start = i
    while (start > 0 && !beats[start - 1].style && i - start < 5) start--
    return beats.slice(start, i + 1)
  }, [beats, i, done])

  useEffect(() => {
    if (done) return
    beats[i].cue?.()
    const t = setTimeout(() => setI(n => n + 1), holdOf(beats[i]))
    return () => clearTimeout(t)
  }, [i, done, beats])

  const next = useCallback(() => setI(n => Math.min(n + 1, beats.length)), [beats.length])

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      }
      if (e.key === 'Escape' && done) onClose()
    }
    addEventListener('keydown', f)
    return () => removeEventListener('keydown', f)
  }, [next, done, onClose])

  if (!done) {
    const cur = beats[i]
    const single = cur.style === 'isolated' || cur.style === 'final'
    return (
      <div className="fixed inset-0 z-[75] flex cursor-pointer items-center justify-center bg-black px-6" onClick={next}>
        <div className={`max-w-2xl ${single ? 'text-center' : ''}`}>
          {screen.map((b, k) => (
            <p
              key={`${i}-${k}-${b.text}`}
              className={
                b.style === 'final'
                  ? 'rise-in font-hand text-5xl leading-snug text-blood drop-shadow-[0_0_30px_rgba(160,20,10,.6)] sm:text-7xl'
                  : b.style === 'isolated'
                    ? 'rise-in font-hand text-3xl leading-relaxed text-bone sm:text-5xl'
                    : `mb-5 text-lg leading-9 transition-opacity duration-1000 sm:text-xl ${k === screen.length - 1 ? 'rise-in text-bone' : 'text-bone/45'}`
              }
              style={b.style === 'final' ? { animationDuration: '3s' } : undefined}
            >
              {b.text}
            </p>
          ))}
        </div>
        <button
          onClick={e => {
            e.stopPropagation()
            setI(beats.length)
          }}
          className="absolute bottom-6 right-6 text-xs tracking-widest text-ash/40 hover:text-ash"
        >
          跳过 ›
        </button>
        <div className="absolute bottom-0 left-0 h-px bg-blood/60 transition-all duration-700" style={{ width: `${(i / beats.length) * 100}%` }} />
      </div>
    )
  }

  const solved = session.status === 'solved'
  return (
    <div className="fixed inset-0 z-[75] overflow-y-auto bg-[#050404]/96">
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-16">
        <p className="fade-in text-center text-xs tracking-[.6em] text-ash/60">汤 底</p>
        <h2 className="fade-in mt-3 text-center font-hand text-5xl text-bone" style={{ textShadow: `0 0 24px ${def.accent}88` }}>
          {story.title}
        </h2>

        <div className="rise-in mt-10 border-y border-blood/30 py-6 text-center text-[17px] leading-9 text-bone/90">{data.oneLine}</div>

        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h3 className="font-hand text-2xl" style={{ color: def.accent }}>
              {solved ? '你还原了真相' : '你没能还原真相'}
            </h3>
            <span className="text-sm text-ash">
              {session.score} / {data.scoring.total} 分 · 问了 {session.questionCount} 个问题
            </span>
          </div>
          <ul className="mt-4 space-y-2 text-[15px]">
            {data.scoring.items.map((it, k) => {
              const hit = session.scoreHits.includes(k)
              return (
                <li key={k} className={`flex gap-3 ${hit ? 'text-bone' : 'text-ash/55'}`}>
                  <span className="w-5 shrink-0 text-center" style={{ color: hit ? def.accent : undefined }}>
                    {hit ? '●' : '○'}
                  </span>
                  <span className="flex-1">{it.point}</span>
                  <span className="text-xs text-ash/60">{it.score} 分</span>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-ash/50">{data.scoring.pass}</p>
        </section>

        <section className="mt-12">
          <h3 className="mb-4 text-xs tracking-[.4em] text-ash/60">完 整 汤 底</h3>
          <div className="space-y-3 text-[15px] leading-8 text-bone/80">
            {data.bottom.map((l, k) => (
              <p key={k}>{l}</p>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h3 className="mb-5 text-xs tracking-[.4em] text-ash/60">故 事 线</h3>
          <ol className="relative space-y-6 border-l border-white/10 pl-6">
            {data.storyline.map((s, k) => (
              <li key={k} className="relative">
                <span className="absolute -left-[29px] top-2 h-2 w-2 rounded-full" style={{ background: def.accent }} />
                <p className="text-sm font-semibold text-bone/90">{s.stage}</p>
                <p className="mt-1 text-[14px] leading-7 text-ash">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {data.credits && <p className="mt-12 text-center text-xs leading-6 text-ash/40">{data.credits}</p>}

        <div className="mt-12 flex flex-wrap justify-center gap-3 text-sm">
          <button onClick={() => setI(0)} className="border border-white/15 px-5 py-2.5 tracking-widest text-bone/80 hover:border-white/40">
            再听一遍
          </button>
          <button onClick={onClose} className="border border-white/15 px-5 py-2.5 tracking-widest text-bone/80 hover:border-white/40">
            回到记录本
          </button>
          <button onClick={onRestart} className="border border-white/15 px-5 py-2.5 tracking-widest text-bone/80 hover:border-white/40">
            重新开一局
          </button>
          <button onClick={onLobby} className="border px-5 py-2.5 tracking-widest hover:bg-white/5" style={{ borderColor: def.accent, color: def.accent }}>
            回到汤馆
          </button>
        </div>
      </div>
    </div>
  )
}
