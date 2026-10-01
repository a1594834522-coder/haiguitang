import { useEffect, useState } from 'react'
import { api, savedSession } from '../api'
import { navigate } from '../router'
import { sceneFor } from '../scenes'
import { Scene as GenericScene } from '../scenes/generic/Scene'
import type { CatalogItem } from '../types'

export function Lobby() {
  const [stories, setStories] = useState<CatalogItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = '夜半汤馆 · 海龟汤'
    api
      .stories()
      .then(r => setStories(r.stories))
      .catch(e => setError(e.message))
  }, [])

  return (
    <div className="relative min-h-full overflow-x-hidden">
      <div className="fixed inset-0">
        <GenericScene milestones={[]} questionCount={0} thinking={false} idle={false} paused cue={null} />
      </div>
      <div className="grain" />

      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
        <header className="mb-14 text-center sm:mb-20">
          <p className="mb-5 text-xs tracking-[.6em] text-ash/70">TURTLE · SOUP</p>
          <h1 className="flicker-text font-hand text-6xl text-blood drop-shadow-[0_0_24px_rgba(140,20,10,.45)] sm:text-8xl">夜半汤馆</h1>
          <p className="mt-6 text-sm leading-7 text-ash sm:text-base">每一碗汤，都藏着一个不该被知道的真相。</p>
          <p className="mx-auto mt-8 max-w-lg text-xs leading-6 text-ash/60 sm:text-sm">
            你会看到故事的一角——汤面。向主持人提问，他只会回答
            <span className="mx-1 text-bone/80">是</span>/<span className="mx-1 text-bone/80">不是</span>/
            <span className="mx-1 text-bone/80">是也不是</span>/<span className="mx-1 text-bone/80">无关</span>/<span className="mx-1 text-bone/80">不知道</span>
            。拼出全部真相，就算喝完这碗汤。
          </p>
        </header>

        {error && <p className="text-center text-blood">{error}</p>}
        {!stories && !error && <p className="text-center text-ash/60">掌灯中……</p>}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stories?.map((s, i) => <StoryCard key={s.id} story={s} index={i} />)}
          {stories && (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-sm border border-dashed border-white/10 p-6 text-center text-ash/50">
              <span className="font-hand text-2xl text-ash/60">更多汤，正在熬……</span>
              <span className="mt-3 text-xs">灶上的火，还没灭。</span>
            </div>
          )}
        </div>

        <footer className="mt-20 text-center text-xs tracking-widest text-ash/40">建议在夜里、戴上耳机、关掉灯游玩</footer>
      </main>
    </div>
  )
}

function StoryCard({ story, index }: { story: CatalogItem; index: number }) {
  const def = sceneFor(story.id)
  const resume = !!savedSession.get(story.id)
  const Art = def.CardArt
  return (
    <button
      onClick={() => navigate(`/soup/${story.id}`)}
      className="rise-in group relative flex flex-col overflow-hidden rounded-sm border border-white/8 bg-[#0c0a09]/85 text-left shadow-[0_20px_60px_rgba(0,0,0,.6)] transition duration-500 hover:-translate-y-1 hover:border-white/15 focus-visible:outline-2 focus-visible:outline-blood"
      style={{ animationDelay: `${index * 120}ms` }}
    >
      <div className="relative h-44 overflow-hidden">
        {Art ? <Art /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0a09] via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-0 transition duration-700 group-hover:opacity-100" style={{ boxShadow: `inset 0 0 80px ${def.accent}55` }} />
      </div>
      <div className="flex flex-1 flex-col p-6 pt-3">
        <h2 className="font-hand text-4xl text-bone transition group-hover:text-[#e8dccb]" style={{ textShadow: `0 0 18px ${def.accent}66` }}>
          {story.title}
        </h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {story.tags.map(t => (
            <span key={t} className="rounded-sm border border-white/10 px-1.5 py-0.5 text-[11px] text-ash">
              {t}
            </span>
          ))}
        </div>
        <p className="mt-4 flex-1 text-sm leading-7 text-ash">{story.teaser}</p>
        <div className="mt-5 flex items-center justify-between text-xs">
          <span className="text-ash/60">{story.difficulty}</span>
          <span className="tracking-[.3em] transition group-hover:tracking-[.45em]" style={{ color: def.accent }}>
            {resume ? '继续 →' : '开汤 →'}
          </span>
        </div>
      </div>
    </button>
  )
}
