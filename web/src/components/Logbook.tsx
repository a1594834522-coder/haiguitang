import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { copyOf, type SceneDef } from '../scenes'
import type { Entry, PublicStory, SessionView } from '../types'
import { SurfaceText } from './SurfaceText'

type Mode = 'ask' | 'guess'

type Props = {
  story: PublicStory
  session: SessionView
  def: SceneDef
  thinking: boolean
  idle: boolean
  error: string
  onAsk: (q: string) => Promise<boolean>
  onGuess: (t: string) => Promise<boolean>
  onHint: () => void
  onReveal: () => void
  onShowReveal: () => void
  onActivity: () => void
}

const rot = (i: number) => `${((i * 37) % 9) - 5}deg`

/** 记录本：所有提问、回答、提示都记在这里。 */
export function Logbook(p: Props) {
  const { story, session, def, thinking } = p
  const copy = copyOf(def)
  const [mode, setMode] = useState<Mode>('ask')
  const [text, setText] = useState('')
  const [showSurface, setShowSurface] = useState(true)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const solved = session.status === 'solved'
  // 通关后还能继续问、继续还原；看过汤底才算结束
  const over = session.over ?? session.status !== 'playing'
  const pieces = story.pieces
  const piecesLeft = pieces ? pieces.length - session.scoreHits.length : 0
  const hintsLeft = story.hintCount - session.hintsUsed.length
  const found = session.found ?? []

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [session.entries.length, thinking, p.error])

  const submit = async () => {
    const t = text.trim()
    if (!t || thinking) return
    const ok = mode === 'ask' ? await p.onAsk(t) : await p.onGuess(t)
    if (ok) {
      setText('')
      if (mode === 'guess') setMode('ask')
    }
    input.current?.focus()
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    p.onActivity()
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    if (mode === 'ask' && !e.shiftKey) {
      e.preventDefault()
      submit()
    } else if (mode === 'guess' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  let qNo = 0
  return (
    <aside className="paper relative flex h-full flex-col overflow-hidden">
      {/* 页眉 */}
      <header className="relative z-10 flex items-end justify-between gap-3 border-b border-ink/25 px-5 pb-2.5 pt-4 sm:px-7">
        <div>
          <p className="text-[10px] tracking-[.35em] text-ink/55">{copy.logbook}</p>
          <h2 className="font-hand text-xl leading-tight whitespace-nowrap text-ink sm:text-2xl">
            {copy.titlePrefix && <span className="hidden sm:inline">{copy.titlePrefix}</span>}
            {story.title}
          </h2>
        </div>
        <div className="flex shrink-0 gap-1 text-xs whitespace-nowrap">
          <ToolButton onClick={() => setShowSurface(v => !v)} active={showSurface}>
            汤面
          </ToolButton>
          {!over && (
            <ToolButton onClick={p.onHint} disabled={thinking || hintsLeft <= 0}>
              提示{hintsLeft > 0 ? ` ${hintsLeft}` : ''}
            </ToolButton>
          )}
          {!over && !solved ? (
            !story.revealLocked && (
              <ToolButton onClick={p.onReveal} danger>
                揭晓
              </ToolButton>
            )
          ) : (
            (solved || !story.revealLocked) && (
              <ToolButton onClick={p.onShowReveal} danger>
                汤底
              </ToolButton>
            )
          )}
        </div>
      </header>

      <div ref={scroller} className="paper-scroll ruled margin-line relative z-10 flex-1 overflow-y-auto px-5 pb-6 pt-4 sm:px-7">
        {showSurface && (
          <section className="mb-5 rounded-sm border border-ink/20 bg-[#d6c69f]/40 p-4 text-[15px] leading-8 shadow-[2px_3px_0_rgba(40,20,5,.15)]">
            <p className="mb-1 text-[10px] tracking-[.35em] text-ink/50">汤 面</p>
            <p>
              <SurfaceText text={story.surface} def={def} milestones={session.milestones} />
            </p>
            {story.revealLocked && !over && !solved && (
              <p className="mt-2 border-t border-ink/15 pt-2 text-[12px] leading-6 text-blood/80">这碗汤不公布答案。真相只能靠你自己问出来，还原通关后才能看到汤底。</p>
            )}
          </section>
        )}

        {found.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-ink/50">已察觉</span>
            {found.map(m => (
              <span key={m.id} className="ink-in rounded-sm border border-blood/40 px-1.5 py-px text-blood/90">
                {m.label}
              </span>
            ))}
            <span className="text-ink/40">
              {found.length}/{story.milestoneCount}
            </span>
          </div>
        )}

        {session.entries.length === 0 && !thinking && (
          <p className="py-6 text-center font-hand text-lg leading-8 text-ink/45">
            这一页还是空的。
            <br />
            问点什么吧。
          </p>
        )}

        <ol className="space-y-3.5">
          {session.entries.map((e, i) => {
            if (e.kind === 'ask' && e.type === 'answer') qNo++
            return <EntryRow key={e.at + ':' + i} e={e} i={i} qNo={qNo} accent={def.accent} last={i === session.entries.length - 1} />
          })}
          {thinking && (
            <li className="flex items-center gap-3 py-1 text-sm text-ink/60">
              <span className="ink-dots">
                <span />
                <span />
                <span />
              </span>
            </li>
          )}
          {p.error && <li className="ink-in text-sm text-blood">{p.error}</li>}
        </ol>
      </div>

      {/* 输入区 */}
      <footer className="relative z-10 border-t border-ink/25 bg-[#9c8a63]/40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-6">
        {!over ? (
          <>
            {solved && (
              <div className="ink-in mb-2 flex items-center gap-3 border-b border-ink/15 pb-2">
                <p className="flex-1 text-[12px] leading-5 text-ink/65">
                  {piecesLeft > 0 ? `已经通关。还有 ${piecesLeft} 块真相没拼出来，可以继续问下去。` : '真相已经全部拼出来了。'}
                </p>
                <button onClick={p.onShowReveal} className="shrink-0 font-hand text-xl text-blood hover:underline">
                  查看汤底
                </button>
              </div>
            )}
            <div className="mb-2 flex items-center gap-4 text-xs">
              {(['ask', 'guess'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`pb-0.5 tracking-widest transition ${mode === m ? 'border-b-2 border-ink text-ink' : 'text-ink/50 hover:text-ink/80'}`}
                >
                  {m === 'ask' ? '提问' : '还原真相'}
                </button>
              ))}
              <span className="ml-auto text-ink/45">
                {mode === 'ask' ? `第 ${session.questionCount + 1} 问` : `已得 ${session.score}/${story.scoringTotal} 分`}
              </span>
            </div>
            {mode === 'guess' && pieces && (
              <ul className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
                {pieces.map((pc, i) => {
                  const got = session.scoreHits.includes(i)
                  return (
                    <li key={i} className={`rounded-sm border px-1.5 py-px ${got ? 'border-blood/40 text-blood/90' : 'border-dashed border-ink/30 text-ink/55'}`}>
                      {got ? '✓ ' : ''}
                      {pc.title}
                      <span className="ml-1 text-ink/40">{pc.score}分</span>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={input}
                value={text}
                onChange={e => {
                  setText(e.target.value)
                  p.onActivity()
                }}
                onKeyDown={onKey}
                rows={mode === 'ask' ? 2 : 3}
                maxLength={mode === 'ask' ? 200 : 1000}
                placeholder={
                  mode === 'ask'
                    ? (def.placeholder?.({ idle: p.idle, milestones: session.milestones }) ?? '问一个只能回答“是”或“不是”的问题')
                    : pieces
                      ? '只说你还没问出来的那部分就行，一两句即可。（⌘/Ctrl + Enter 提交）'
                      : '把你想到的真相写下来：发生了什么，为什么。（⌘/Ctrl + Enter 提交）'
                }
                className={`min-h-0 flex-1 resize-none rounded-sm border border-ink/30 bg-[#e3d5b2]/55 px-3 py-2 text-[15px] leading-7 text-ink placeholder:text-ink/40 focus:border-ink/60 focus:outline-none ${p.idle && mode === 'ask' ? 'placeholder:text-blood/60' : ''}`}
              />
              <button
                onClick={submit}
                disabled={thinking || !text.trim()}
                className="h-11 shrink-0 rounded-sm bg-ink px-4 font-hand text-xl text-[#e3d5b2] transition hover:bg-[#3d2817] disabled:opacity-35"
              >
                {mode === 'ask' ? '问' : '说'}
              </button>
            </div>
          </>
        ) : (
          <button onClick={p.onShowReveal} className="w-full py-3 font-hand text-2xl text-blood">
            {solved ? copy.solved : '查看汤底'}
          </button>
        )}
      </footer>
    </aside>
  )
}

function ToolButton({ children, onClick, active, disabled, danger }: { children: React.ReactNode; onClick: () => void; active?: boolean; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-sm border px-2 py-1 tracking-wider transition disabled:opacity-35 ${
        danger ? 'border-blood/40 text-blood hover:bg-blood/10' : active ? 'border-ink/50 bg-ink/10 text-ink' : 'border-ink/25 text-ink/70 hover:border-ink/50'
      }`}
    >
      {children}
    </button>
  )
}

function EntryRow({ e, i, qNo, accent, last }: { e: Entry; i: number; qNo: number; accent: string; last: boolean }) {
  if (e.kind === 'hint') {
    return (
      <li className="ink-in relative my-4 -rotate-1 rounded-[2px] bg-[#d9cc8a]/80 px-4 py-3 text-[15px] leading-7 shadow-[2px_4px_8px_rgba(30,15,0,.3)]">
        <span className="absolute -top-2 left-4 h-4 w-12 rotate-2 bg-[#efe6c8]/60" />
        <span className="mr-2 text-[10px] tracking-[.3em] text-ink/55">提示 {e.level}</span>
        <span className="font-hand text-lg">{e.text}</span>
      </li>
    )
  }
  if (e.kind === 'guess') {
    return (
      <li className="ink-in my-4 border-l-2 border-ink/40 pl-3 text-[14px] leading-7">
        <p className="text-[10px] tracking-[.3em] text-ink/55">还原</p>
        <p className="whitespace-pre-wrap text-ink/85">{e.text}</p>
        <p className="mt-1.5 flex items-center gap-3">
          <span className="stamp stamp-in !text-base" style={{ ['--r' as string]: rot(i), color: accent }}>
            {e.score} 分
          </span>
          {e.feedback && <span className="font-hand text-[17px] text-ink/75">{e.feedback}</span>}
        </p>
      </li>
    )
  }
  if (e.type === 'invalid') {
    return (
      <li className="ink-in text-[15px] leading-7">
        <p className="text-ink/45 line-through decoration-ink/30">{e.q}</p>
        <p className="font-hand text-[17px] text-ink/60">{e.note}</p>
      </li>
    )
  }
  return (
    <li className={`flex items-start gap-3 text-[15px] leading-7 ${last ? 'ink-in' : ''}`}>
      <span className="mt-[3px] w-6 shrink-0 text-right text-[11px] text-ink/40">{qNo}</span>
      <div className="min-w-0 flex-1">
        <p className="break-words">{e.q}</p>
        {e.note && <p className="font-hand text-[17px] leading-6 text-ink/70">—— {e.note}</p>}
      </div>
      <span className={`stamp mt-0.5 shrink-0 ${last ? 'stamp-in' : ''}`} data-a={e.answer} style={{ ['--r' as string]: rot(i), transform: `rotate(${rot(i)})` }}>
        {e.answer}
      </span>
    </li>
  )
}
