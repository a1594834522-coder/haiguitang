import { useEffect, useState } from 'react'
import { audio } from '../../audio/engine'
import doorAjarPhoto from './photos/door-ajar.webp'
import doorClosedPhoto from './photos/door-closed.webp'
import paddleStainedPhoto from './photos/paddle-stained.webp'
import paddlePhoto from './photos/paddle.webp'
import portraitClosedPhoto from './photos/portrait-closed.webp'
import portraitDoorPhoto from './photos/portrait-door.webp'
import portraitPhoto from './photos/portrait.webp'
import scoreboardPhoto from './photos/scoreboard.webp'

export type InspectTarget = 'portrait' | 'paddle' | 'scoreboard' | 'door'

export type InspectState = {
  milestones: string[]
  isDawn: boolean
  score: { me: number; ye: number }
}

/** “我”凑近看时的旁白。只会说出玩家已经确认过的事，绝不超前。 */
function caption(t: InspectTarget, s: InspectState): string {
  const has = (m: string) => s.milestones.includes(m)
  switch (t) {
    case 'portrait':
      if (has('father')) return '照片里的爷爷，好像一直在看着休息室那扇门。'
      if (has('help')) return '相框的玻璃裂了一道。我不记得它是什么时候裂的。'
      return '照片是去年在镇上照相馆照的。爷爷不爱照相，嘴角绷得紧紧的。'
    case 'paddle':
      if (has('knock')) return '拍子的边上，沾了一点一点的红漆。'
      if (has('coffin')) return '球拍原来一直放在那上面。拍柄还是温的。'
      return '爷爷的球拍。胶皮磨得发白，拍柄上缠了一圈又一圈胶布。他说这块拍子跟了他四十年。'
    case 'scoreboard':
      if (s.isDawn) return '右边的数字，很久没有翻过了。'
      return '爷爷自己钉的记分牌。左边是我，右边是爷爷。'
    case 'door':
      if (has('father')) return '门开着一条缝。里面有人站着，一直没出声。'
      return '休息室的门关着。门口歪歪扭扭地摆着好几双大人的鞋。'
  }
}

const photoClass = 'absolute inset-0 h-full w-full object-cover'

export function Inspect({ target, state, onClose }: { target: InspectTarget; state: InspectState; onClose: () => void }) {
  const [blink, setBlink] = useState(false)
  const has = (m: string) => state.milestones.includes(m)

  // 盯着遗像看久了……
  useEffect(() => {
    if (target !== 'portrait' || !has('alive')) return
    const a = setTimeout(() => {
      setBlink(true)
      audio.thump({ vol: 0.35 })
    }, 6500)
    const b = setTimeout(() => setBlink(false), 6500 + 320)
    return () => (clearTimeout(a), clearTimeout(b))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', f)
    return () => removeEventListener('keydown', f)
  }, [onClose])

  return (
    <div className="pw-inspect fixed inset-0 z-[58] flex cursor-zoom-out flex-col items-center justify-center bg-black/88 px-6" onClick={onClose}>
      <div className="pw-inspect-glow pointer-events-none absolute inset-0" />
      <div className="pw-inspect-item relative flex w-full items-center justify-center">
        {target === 'portrait' && <PortraitCloseup door={has('father')} cracked={has('help')} blink={blink} />}
        {target === 'paddle' && (
          <Frame square>
            <img src={paddlePhoto} alt="" className={photoClass} />
            <img src={paddleStainedPhoto} alt="" className={`${photoClass} pw-xfade`} style={{ opacity: has('knock') ? 1 : 0 }} />
          </Frame>
        )}
        {target === 'scoreboard' && <ScoreboardCloseup me={state.score.me} ye={state.score.ye} />}
        {target === 'door' && (
          <Frame square>
            <img src={doorClosedPhoto} alt="" className={photoClass} />
            <img src={doorAjarPhoto} alt="" className={`${photoClass} pw-xfade`} style={{ opacity: has('father') ? 1 : 0 }} />
          </Frame>
        )}
      </div>
      <p className="rise-in relative mt-8 max-w-md text-center font-hand text-2xl leading-relaxed text-bone/85" style={{ animationDelay: '.4s' }}>
        {caption(target, state)}
      </p>
      <p className="relative mt-6 text-[11px] tracking-[.3em] text-ash/40">点击任意处返回</p>
    </div>
  )
}

/** 特写的取景框：四周压暗，像凑近了只看得清这一块 */
function Frame({ children, square = false }: { children: React.ReactNode; square?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-sm shadow-[0_30px_60px_rgba(0,0,0,.9)] ${square ? 'aspect-square w-[min(80vw,58vh,520px)]' : 'aspect-[2/3] h-[min(62vh,600px)] max-w-[80vw]'}`}
    >
      {children}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_80px_40px_rgba(0,0,0,.75)]" />
    </div>
  )
}

function PortraitCloseup({ door, cracked, blink }: { door: boolean; cracked: boolean; blink: boolean }) {
  return (
    <Frame>
      <img src={portraitPhoto} alt="" className={photoClass} />
      <img src={portraitDoorPhoto} alt="" className={`${photoClass} pw-xfade`} style={{ opacity: door ? 1 : 0 }} />
      <img src={portraitClosedPhoto} alt="" className={`${photoClass} pw-blink`} style={{ opacity: blink ? 1 : 0 }} />
      {cracked && (
        <svg viewBox="0 0 640 960" className="pt-crack absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
          {/* 相框玻璃在这张照片里大约是 x 160–480、y 200–660 */}
          <path d="M452 215 L420 300 L440 335 L388 450 L410 488 L352 640 M420 300 L476 352 M388 450 L300 492 L262 548 M410 488 L455 560" stroke="#f1ead8" strokeOpacity="0.55" strokeWidth="1.6" fill="none" />
          <path d="M452 215 L420 300 L440 335 L388 450 L410 488 L352 640" stroke="#000" strokeOpacity="0.35" strokeWidth="1" fill="none" transform="translate(1.5 1)" />
        </svg>
      )}
    </Frame>
  )
}

/** 记分牌：照片上的两张空白翻牌，数字叠上去 */
const SCORE_CARDS = [
  { left: '29%', top: '46%' },
  { left: '71%', top: '46%' },
]

function ScoreboardCloseup({ me, ye }: { me: number; ye: number }) {
  return (
    <Frame square>
      <img src={scoreboardPhoto} alt="" className={photoClass} />
      {[me, ye].map((n, i) => (
        <span
          key={`${i}:${n}`}
          className="pw-flip pw-serif absolute -translate-x-1/2 -translate-y-1/2 font-black leading-none text-[#1a1712]/85 mix-blend-multiply"
          style={{ ...SCORE_CARDS[i], fontSize: n % 100 >= 10 ? 'min(15vw, 11vh, 100px)' : 'min(20vw, 15vh, 136px)' }}
        >
          {n % 100}
        </span>
      ))}
    </Frame>
  )
}
