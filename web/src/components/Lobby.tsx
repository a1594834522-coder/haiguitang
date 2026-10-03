import { useEffect, useRef, useState } from 'react'
import { api, savedSession } from '../api'
import { navigate } from '../router'
import { copyOf, sceneFor } from '../scenes'
import { Scene as GenericScene } from '../scenes/generic/Scene'
import type { CatalogItem } from '../types'
import './lobby.css'

const NUMERALS = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾']
const ANSWERS: [string, string][] = [
  ['是', '你说中了。'],
  ['不是', '方向错了，换个问法。'],
  ['是也不是', '说对了一半；或者字面上对，实情不是这样。'],
  ['无关', '故事里确有答案，但它帮不了你。'],
  ['不知道', '故事里没有交代这件事。'],
]
const INTRO = '你只看得到故事的一角。向主持人提问，他只会这样回答。拼出全部真相，就算喝完这碗汤。'

/** 按访客本地时间说一句话：汤馆只在夜里开门 */
function hourLine(h: number) {
  if (h >= 23 || h < 1) return '子时了。汤刚好熬好。'
  if (h < 4) return '这么晚还没睡？那就进来坐坐。'
  if (h < 6) return '天快亮了。最后一碗汤，还温着。'
  if (h < 18) return '天还亮着。汤馆在夜里才开门，不过门没锁。'
  return '天黑了。灶上的火，已经点起来了。'
}

export function Lobby() {
  const [stories, setStories] = useState<CatalogItem[] | null>(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [answer, setAnswer] = useState<number | null>(null)
  const [jolt, setJolt] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = '夜半汤馆 · 海龟汤'
    api
      .stories()
      .then(r => setStories(r.stories))
      .catch(e => setError(e.message))
    const t = setInterval(() => setNow(new Date()), 20_000)
    return () => clearInterval(t)
  }, [])

  // 手电筒：只有鼠标周围是亮的。触屏没有悬停，就不跟手，留一束固定的光
  useEffect(() => {
    const el = rootRef.current
    if (!el || !matchMedia('(hover: hover) and (pointer: fine)').matches) return
    el.classList.add('lb-torch-on')
    let raf = 0
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--mx', `${e.clientX}px`)
        el.style.setProperty('--my', `${e.clientY}px`)
      })
    }
    addEventListener('pointermove', move, { passive: true })
    return () => (removeEventListener('pointermove', move), cancelAnimationFrame(raf))
  }, [])

  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div ref={rootRef} className="lb-root relative min-h-full overflow-x-hidden">
      <div className="fixed inset-0">
        <GenericScene milestones={[]} questionCount={0} thinking={false} idle={false} paused cue={null} />
      </div>
      <div className="lb-torch" />
      <div className="grain" />

      <main className="relative z-10 mx-auto max-w-6xl px-5 sm:px-10">
        {/* ---------- 首屏 ---------- */}
        <header className="flex min-h-[92svh] flex-col items-center justify-center pb-16 pt-20 text-center">
          <p className="rise-in text-[11px] tracking-[.8em] text-ash/80">子 时 开 门 · 天 亮 打 烊</p>

          {/* 鼠标碰到标题就闪一下；抖动放在外层，免得重放标题的渗出动画 */}
          <div
            className={`relative mt-10 sm:mt-12 ${jolt ? 'lb-jolt' : ''}`}
            onPointerEnter={() => {
              if (jolt) return
              setJolt(true)
              setTimeout(() => setJolt(false), 450)
            }}
          >
            <h1 className="lb-title whitespace-nowrap font-hand text-[19vw] leading-none text-blood sm:text-[9.5rem]" data-text="夜半汤馆">
              夜半汤馆
            </h1>
            <img src="/favicon.svg" alt="" className="lb-seal absolute cursor-pointer -right-5 -top-4 w-8 sm:-right-10 sm:-top-6 sm:w-14" />
          </div>

          <p className="rise-in mt-10 font-serif text-[15px] tracking-[.12em] text-bone/80 sm:text-lg sm:tracking-[.25em]" style={{ animationDelay: '.5s' }}>
            每一碗汤，都藏着一个不该被知道的真相。
          </p>

          <div className="rise-in mt-14 flex flex-col items-center gap-5" style={{ animationDelay: '1s' }}>
            <div className="flex flex-wrap justify-center gap-2.5">
              {ANSWERS.map(([a], i) => (
                <button
                  key={a}
                  type="button"
                  className={`lb-answer ${answer === i ? 'lb-answer-on' : ''}`}
                  style={{ ['--r' as string]: `${[-3, 2, -1.5, 3, -2][i]}deg` }}
                  onPointerEnter={() => setAnswer(i)}
                  onPointerLeave={() => setAnswer(null)}
                  onFocus={() => setAnswer(i)}
                  onBlur={() => setAnswer(null)}
                  onClick={() => setAnswer(i)}
                >
                  {a}
                </button>
              ))}
            </div>
            <p key={answer ?? -1} className="lb-answer-note min-h-12 max-w-md text-xs leading-6 text-ash/80 sm:text-[13px]">
              {answer === null ? INTRO : <><span className="text-bone/90">“{ANSWERS[answer][0]}”</span>：{ANSWERS[answer][1]}</>}
            </p>
          </div>

          <p className="rise-in mt-14 text-xs leading-6 tracking-[.08em] text-ash/75 sm:tracking-[.2em]" style={{ animationDelay: '1.5s' }}>
            此刻 <span className="font-serif tabular-nums text-bone/70">{clock}</span> · {hourLine(now.getHours())}
          </p>

          <a
            href="#menu"
            onClick={e => (e.preventDefault(), document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' }))}
            className="lb-cue mt-12 flex flex-col items-center gap-3 text-[11px] tracking-[.6em] text-ash/70 transition hover:text-bone/80" aria-label="看今夜的汤">
            今 夜 的 汤
            <span className="lb-cue-line" />
          </a>
        </header>

        {/* ---------- 汤单 ---------- */}
        <section id="menu" className="scroll-mt-10 pb-10">
          {error && <p className="text-center text-blood">{error}</p>}
          {!stories && !error && <p className="text-center text-ash/60">掌灯中……</p>}
          <div className="lb-menu flex flex-col gap-20 sm:gap-28">
            {stories?.map((s, i) => <MenuItem key={s.id} story={s} index={i} />)}
          </div>
          {stories && (
            <p className="lb-brewing mt-24 text-center font-hand text-2xl text-ash/60">
              {NUMERALS[stories.length] ?? ''} · 还在熬<span className="lb-flame" />
              <span className="mt-2 block font-serif text-xs tracking-[.3em] text-ash/50">灶上的火，还没灭。</span>
            </p>
          )}
        </section>

        <footer className="flex flex-col items-center gap-4 border-t border-white/5 py-14 text-center text-xs tracking-widest text-ash/60">
          <p>建议在夜里、戴上耳机、关掉灯游玩</p>
          <p className="flex gap-5 tracking-[.2em]">
            <a href="https://github.com/a1594834522-coder/haiguitang" target="_blank" rel="noreferrer" className="lb-link">
              GitHub
            </a>
            {/* 只展示，不跳邮件客户端；点一下整段选中，方便复制 */}
            <span className="cursor-text select-all transition hover:text-bone/80">1@bu2z.de</span>
          </p>
        </footer>
      </main>
    </div>
  )
}

function MenuItem({ story, index }: { story: CatalogItem; index: number }) {
  const def = sceneFor(story.id)
  const resume = !!savedSession.get(story.id)
  const Art = def.CardArt
  const flip = index % 2 === 1
  return (
    <button
      onClick={() => navigate(`/soup/${story.id}`)}
      className={`lb-item rise-in group grid items-center gap-7 text-left sm:gap-12 md:grid-cols-[1.35fr_1fr] ${flip ? 'md:grid-cols-[1fr_1.35fr]' : ''}`}
      style={{ animationDelay: `${index * 150}ms`, ['--accent' as string]: def.accent }}
    >
      <div className={`lb-cover relative aspect-[16/9] overflow-hidden ${flip ? 'md:order-2' : ''}`}>
        {def.cover ? <img src={def.cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : Art ? <Art /> : null}
        <div className="lb-cover-glow pointer-events-none absolute inset-0" />
      </div>

      <div className={`${flip ? 'md:order-1 md:text-right' : ''}`}>
        <p className={`flex items-baseline gap-4 text-ash/75 ${flip ? 'md:justify-end' : ''}`}>
          <span className="font-hand text-3xl" style={{ color: def.accent }}>
            {NUMERALS[index] ?? index + 1}
          </span>
          <span className="text-[11px] tracking-[.4em]">{story.tags.join(' · ')}</span>
        </p>
        <h2 className="lb-name mt-3 font-hand text-5xl text-bone sm:text-6xl" data-text={story.title}>
          {story.title}
        </h2>
        <p className="mt-5 text-[15px] leading-8 text-bone/70">{story.teaser}</p>
        <p className={`mt-7 flex items-center gap-5 text-xs ${flip ? 'md:justify-end' : ''}`}>
          <span className="text-ash/70">{story.difficulty}</span>
          <span className="lb-enter tracking-[.35em]" style={{ color: def.accent }}>
            {resume ? copyOf(def).resume : '推门进去'} <span className="lb-arrow">→</span>
          </span>
        </p>
      </div>
    </button>
  )
}
