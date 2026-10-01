import { useEffect, useMemo, useState } from 'react'
import { audio } from '../audio/engine'
import type { SceneDef } from '../scenes'
import type { PublicStory } from '../types'
import { SurfaceText } from './SurfaceText'

/** 开场：标题卡 → 推门 → 汤面一句一句浮现 */
export function Intro({
  story,
  def,
  resuming,
  onDone,
}: {
  story: PublicStory
  def: SceneDef
  resuming: boolean
  onDone: () => void
}) {
  const [stage, setStage] = useState<'title' | 'door' | 'surface'>('title')
  const sentences = useMemo(() => story.surface.match(/[^。！？]+[。！？]?”?/g) ?? [story.surface], [story.surface])
  const [shown, setShown] = useState(0)

  const enter = async () => {
    await audio.unlock().catch(() => {})
    audio.creak({ vol: 0.4 })
    if (resuming) {
      setStage('door')
      setTimeout(onDone, 2200)
      return
    }
    setStage('door')
    setTimeout(() => setStage('surface'), 2600)
  }

  useEffect(() => {
    if (stage !== 'surface') return
    if (shown >= sentences.length + 1) return
    const t = setTimeout(() => setShown(n => n + 1), shown === 0 ? 400 : 2300)
    return () => clearTimeout(t)
  }, [stage, shown, sentences.length])

  if (stage === 'title') {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black px-6 text-center">
        <p className="fade-in-slow mb-6 text-xs tracking-[.5em] text-ash/60" style={{ animationDelay: '.2s' }}>
          {story.tags.join(' · ')}
        </p>
        <h1 className="rise-in font-hand text-6xl text-bone sm:text-8xl" style={{ textShadow: `0 0 30px ${def.accent}88`, animationDelay: '.6s' }}>
          {story.title}
        </h1>
        <p className="fade-in-slow mt-8 max-w-md text-sm leading-7 text-ash" style={{ animationDelay: '1.6s' }}>
          {story.teaser}
        </p>
        <button
          onClick={enter}
          className="fade-in-slow mt-14 border border-white/15 px-8 py-3 text-sm tracking-[.4em] text-bone/90 transition hover:border-white/40 hover:bg-white/5 hover:tracking-[.55em] focus-visible:outline-2 focus-visible:outline-blood"
          style={{ animationDelay: '2.6s' }}
        >
          {resuming ? '回到那一夜' : '推开训练馆的门'}
        </button>
        <p className="fade-in-slow mt-6 text-[11px] text-ash/40" style={{ animationDelay: '3.2s' }}>
          有声音 · 建议戴耳机
        </p>
      </div>
    )
  }

  if (stage === 'door') {
    return (
      <>
        <div className="door-panel l" />
        <div className="door-panel r" />
      </>
    )
  }

  const done = shown > sentences.length
  return (
    <div
      className="fixed inset-0 z-[70] flex cursor-pointer items-center justify-center bg-black/72 px-6 backdrop-blur-[1px]"
      onClick={() => (done ? onDone() : setShown(sentences.length + 1))}
    >
      <div className="max-w-2xl">
        <p className="mb-8 text-center text-xs tracking-[.6em] text-ash/60">汤 面</p>
        <div className="space-y-4 text-lg leading-9 text-bone/90 sm:text-xl sm:leading-10">
          {sentences.slice(0, shown).map((s, i) => (
            <p key={i} className="rise-in">
              <SurfaceText text={s} def={def} milestones={[]} dark />
            </p>
          ))}
        </div>
        {done && (
          <div className="mt-12 text-center">
            {def.whisper && <p className="fade-in-slow mb-8 font-hand text-2xl text-blood/80">{def.whisper}</p>}
            <button
              onClick={onDone}
              className="fade-in border border-white/15 px-8 py-3 text-sm tracking-[.4em] text-bone/90 transition hover:border-white/40 hover:bg-white/5"
              style={{ animationDelay: '1.2s' }}
            >
              开始提问
            </button>
          </div>
        )}
        {!done && <p className="mt-12 text-center text-[11px] text-ash/40">点击任意处跳过</p>}
      </div>
    </div>
  )
}
