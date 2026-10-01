import { useEffect, useState } from 'react'
import { audio } from '../../audio/engine'
import { Portrait } from './Portrait'

export type InspectTarget = 'portrait' | 'paddle' | 'scoreboard' | 'door' | 'board'

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
    case 'board':
      return '训练安排是爷爷写的。旁边那两个小人，是我画的。'
  }
}

export function Inspect({ target, state, onClose }: { target: InspectTarget; state: InspectState; onClose: () => void }) {
  const [blink, setBlink] = useState(false)
  const has = (m: string) => state.milestones.includes(m)

  // 盯着遗像看久了……
  useEffect(() => {
    if (target !== 'portrait' || !has('alive')) return
    const t = setTimeout(() => {
      setBlink(true)
      audio.thump({ vol: 0.35 })
    }, 6500)
    return () => clearTimeout(t)
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
      <div className="pw-inspect-item relative flex max-h-[68vh] w-full max-w-[min(88vw,560px)] items-center justify-center">
        {target === 'portrait' && (
          <Portrait className="h-[64vh] max-h-[560px] w-auto max-w-full drop-shadow-[0_30px_40px_rgba(0,0,0,.9)]" gaze={has('father') ? 'door' : 'front'} cracked={has('help')} blink={blink} candleGlare />
        )}
        {target === 'paddle' && <PaddleCloseup stained={has('knock')} />}
        {target === 'scoreboard' && <ScoreboardCloseup me={state.score.me} ye={state.score.ye} />}
        {target === 'door' && <DoorCloseup ajar={has('father')} />}
        {target === 'board' && <BoardCloseup />}
      </div>
      <p className="rise-in relative mt-8 max-w-md text-center font-hand text-2xl leading-relaxed text-bone/85" style={{ animationDelay: '.4s' }}>
        {caption(target, state)}
      </p>
      <p className="relative mt-6 text-[11px] tracking-[.3em] text-ash/40">点击任意处返回</p>
    </div>
  )
}

function PaddleCloseup({ stained }: { stained: boolean }) {
  return (
    <svg viewBox="0 0 640 320" className="w-full drop-shadow-[0_30px_40px_rgba(0,0,0,.9)]">
      <defs>
        <radialGradient id="pc-rubber" cx="0.42" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#9a2219" />
          <stop offset="0.5" stopColor="#7a1712" />
          <stop offset="1" stopColor="#3f0907" />
        </radialGradient>
        <radialGradient id="pc-worn" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#c46a5b" stopOpacity="0.45" />
          <stop offset="1" stopColor="#c46a5b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pc-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a6238" />
          <stop offset="0.5" stopColor="#6a4626" />
          <stop offset="1" stopColor="#3e2814" />
        </linearGradient>
        <filter id="pc-tex" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" seed="9" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id="pc-grain" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.5" numOctaves="2" seed="3" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.15  0 0 0 0 0.08  0 0 0 0 0.03  0 0 0 0.5 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <g transform="translate(220 170) rotate(-14)">
        {/* 拍柄 */}
        <path d="M120 -20 L250 -16 Q262 0 250 16 L120 20 Q108 0 120 -20 Z" fill="url(#pc-wood)" />
        <path d="M120 -20 L250 -16 Q262 0 250 16 L120 20 Q108 0 120 -20 Z" fill="#fff" filter="url(#pc-grain)" />
        {/* 一圈圈缠上去的胶布 */}
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M${142 + i * 11} -19 l8 38`} stroke="#d8d2c2" strokeOpacity={0.55 - i * 0.03} strokeWidth="6" />
        ))}
        <path d="M140 -19 L238 -17 L238 17 L140 19" stroke="#000" strokeOpacity="0.25" strokeWidth="1" fill="none" />
        {/* 拍面：底板的木层边、背面的黑胶皮 */}
        <ellipse cx="4" cy="9" rx="132" ry="118" fill="#060606" />
        <ellipse cx="2" cy="5" rx="132" ry="118" fill="#8a6a44" />
        <ellipse cx="1" cy="3" rx="132" ry="118" fill="#5d4428" />
        <ellipse cx="0" cy="0" rx="132" ry="118" fill="#111" />
        <ellipse cx="0" cy="0" rx="126" ry="112" fill="url(#pc-rubber)" />
        <ellipse cx="0" cy="0" rx="126" ry="112" fill="#fff" filter="url(#pc-tex)" />
        <ellipse cx="-14" cy="-6" rx="62" ry="54" fill="url(#pc-worn)" />
        <path d="M-90 -60 Q-40 -98 30 -96" stroke="#fff" strokeOpacity="0.12" strokeWidth="8" fill="none" strokeLinecap="round" />
        {/* 边上的磕痕 */}
        <path d="M110 -54 l8 4 M118 40 l8 -2 M-120 30 l-8 2" stroke="#2a1a10" strokeWidth="3" />
        {stained &&
          [
            [96, -70],
            [112, -40],
            [120, -8],
            [108, 52],
            [86, 78],
            [-60, 100],
          ].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={3 + (i % 3)} ry={2 + (i % 2)} fill="#3a0b07" opacity="0.9" />)}
        <ellipse cx="0" cy="0" rx="132" ry="118" fill="none" stroke="#000" strokeWidth="4" opacity="0.6" />
      </g>
    </svg>
  )
}

function ScoreboardCloseup({ me, ye }: { me: number; ye: number }) {
  const Card = ({ x, n, label }: { x: number; n: number; label: string }) => (
    <g transform={`translate(${x} 60)`}>
      <rect width="150" height="190" rx="4" fill="#a19b8c" />
      <rect width="150" height="94" rx="4" fill="#b0aa9a" />
      <line x1="0" y1="95" x2="150" y2="95" stroke="#2a2824" strokeWidth="3" />
      <text x="75" y={n % 100 >= 10 ? 148 : 160} textAnchor="middle" fontSize={n % 100 >= 10 ? 96 : 140} fontWeight="900" fill="#151412" className="pw-serif">
        {n % 100}
      </text>
      <rect width="150" height="190" rx="4" fill="#3a2a14" opacity="0.12" filter="url(#sc-grime)" />
      <rect x="20" y="-14" width="10" height="26" rx="5" fill="none" stroke="#4a4740" strokeWidth="4" />
      <rect x="120" y="-14" width="10" height="26" rx="5" fill="none" stroke="#4a4740" strokeWidth="4" />
      <rect x="35" y="208" width="80" height="28" fill="#cfc8b2" opacity="0.85" transform="rotate(-2 75 222)" />
      <text x="75" y="230" textAnchor="middle" fontSize="20" fill="#2a2620" className="pw-hand">
        {label}
      </text>
    </g>
  )
  return (
    <svg viewBox="0 0 440 300" className="w-full drop-shadow-[0_30px_40px_rgba(0,0,0,.9)]">
      <defs>
        <filter id="sc-grime" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="7" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.14  0 0 0 0 0.06  0 0 0 -2 1.2" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <rect x="10" y="40" width="420" height="230" rx="8" fill="#1a1b19" stroke="#050505" strokeWidth="6" />
      <Card x={40} n={me} label="我" />
      <Card x={250} n={ye} label="爷爷" />
    </svg>
  )
}

/** 门口的鞋：侧面看，门缝底下的光给鞋面勾一道边 */
function Shoe({ x, y, flip = false, s = 1, rot = 0, kind = 'leather' }: { x: number; y: number; flip?: boolean; s?: number; rot?: number; kind?: 'leather' | 'cloth' }) {
  const cloth = kind === 'cloth'
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx="2" cy="1.5" rx="30" ry="3.5" fill="#000" opacity="0.7" />
      {cloth ? (
        <>
          {/* 千层底布鞋：白鞋底，黑布面，鞋口很浅 */}
          <path d="M-26 0 L24 0 Q31 0 31 -3 L31 -6 L-26 -6 Z" fill="#5a554b" />
          <path d="M-26 -3 L31 -3" stroke="#5f5a50" strokeWidth="0.6" strokeDasharray="1 1.5" />
          <path d="M-26 -6 L-26 -13 Q-24 -16 -16 -15 Q-6 -13 6 -13 Q22 -13 30 -8 L31 -6 Z" fill="#100e0c" />
          <path d="M-22 -14 Q-6 -10.5 8 -12.5" stroke="#000" strokeWidth="2.5" fill="none" />
          <path d="M-26 -13 Q-24 -16 -16 -15 Q-6 -13 6 -13 Q22 -13 30 -8" stroke="#c48a48" strokeOpacity="0.35" strokeWidth="1" fill="none" />
        </>
      ) : (
        <>
          {/* 旧皮鞋：鞋跟、鞋带、磨亮的鞋头 */}
          <path d="M-26 0 L24 0 Q30 0 30 -3 L-26 -3 Z" fill="#26211c" />
          <rect x="-26" y="-6" width="11" height="6" fill="#1c1814" />
          <path d="M-26 -5 L-26 -16 Q-24 -22 -13 -22 L-5 -21 Q3 -14 15 -13 Q29 -12 30 -5 L30 -3 L-26 -3 Z" fill="#120f0d" />
          <path d="M-22 -20 Q-13 -23 -5 -20.5 Q-13 -18 -22 -20 Z" fill="#000" />
          <path d="M-4 -19 L8 -14" stroke="#2c2722" strokeWidth="3" />
          <path d="M-2 -18.5 l3 -1.5 M2 -17 l3 -1.5 M6 -15.5 l3 -1.5" stroke="#4a443a" strokeWidth="0.8" />
          <path d="M-26 -16 Q-24 -22 -13 -22 L-5 -21 Q3 -14 15 -13 Q29 -12 30 -5" stroke="#c48a48" strokeOpacity="0.4" strokeWidth="1" fill="none" />
          <ellipse cx="22" cy="-9" rx="5" ry="1.6" fill="#c9a77a" opacity="0.25" />
          <path d="M8 -12 Q12 -9 10 -5" stroke="#000" strokeOpacity="0.6" strokeWidth="0.8" fill="none" />
        </>
      )}
    </g>
  )
}

function DoorCloseup({ ajar }: { ajar: boolean }) {
  return (
    <svg viewBox="0 0 360 440" className="h-[60vh] max-h-[540px] w-auto drop-shadow-[0_30px_40px_rgba(0,0,0,.9)]">
      <defs>
        <linearGradient id="dc-door" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#231e19" />
          <stop offset="0.6" stopColor="#1a1612" />
          <stop offset="1" stopColor="#100d0b" />
        </linearGradient>
        <linearGradient id="dc-gap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#120d08" />
          <stop offset="1" stopColor="#040302" />
        </linearGradient>
        <linearGradient id="dc-under" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c48a48" stopOpacity="0" />
          <stop offset="0.5" stopColor="#c48a48" stopOpacity="0.55" />
          <stop offset="1" stopColor="#c48a48" stopOpacity="0" />
        </linearGradient>
        <filter id="dc-grain" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.25" numOctaves="3" seed="15" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.3" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id="dc-smear" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      {/* 门框 */}
      <rect x="26" y="0" width="308" height="414" fill="#0a0908" />
      <rect x="34" y="6" width="292" height="408" fill="#050404" />
      {ajar && <rect x="228" y="10" width="94" height="404" fill="url(#dc-gap)" />}
      {ajar && (
        <g className="pw-eyes">
          <circle cx="268" cy="124" r="2" fill="#c4bca9" />
          <circle cx="287" cy="124" r="2" fill="#c4bca9" />
        </g>
      )}
      <g style={{ transform: ajar ? 'scaleX(0.66)' : 'none', transformOrigin: '38px 0', transition: 'transform 1.4s ease' }}>
        <rect x="38" y="10" width="284" height="404" fill="url(#dc-door)" />
        <rect x="38" y="10" width="284" height="404" fill="#000" filter="url(#dc-grain)" opacity="0.55" />
        {/* 门板上的两块凹板 */}
        {[
          [64, 38, 232, 160],
          [64, 226, 232, 160],
        ].map(([x, y, w, h], i) => (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill="#14110e" />
            <path d={`M${x} ${y + h} V${y} H${x + w}`} stroke="#000" strokeOpacity="0.7" strokeWidth="3" fill="none" />
            <path d={`M${x} ${y + h} H${x + w} V${y}`} stroke="#3a3229" strokeOpacity="0.6" strokeWidth="2" fill="none" />
          </g>
        ))}
        {/* 门牌 */}
        <rect x="128" y="94" width="104" height="40" fill="#e6dfcd" opacity="0.08" />
        <rect x="132" y="98" width="96" height="32" fill="#2a251e" />
        <text x="180" y="121" textAnchor="middle" fontSize="19" fill="#8a826f" className="pw-serif">
          休息室
        </text>
        <circle cx="136" cy="102" r="1.5" fill="#5a5144" />
        <circle cx="224" cy="102" r="1.5" fill="#5a5144" />
        {/* 门把手附近被手摸出来的污渍 */}
        <ellipse cx="292" cy="222" rx="22" ry="34" fill="#000" opacity="0.35" filter="url(#dc-smear)" />
        <rect x="282" y="208" width="26" height="10" rx="4" fill="#2e2a24" />
        <rect x="286" y="210" width="18" height="3" rx="1.5" fill="#4a443a" />
        <rect x="290" y="226" width="6" height="12" rx="3" fill="#080706" />
        <path d="M70 330 l30 -6 M210 360 l40 4 M80 250 l14 30" stroke="#3a3229" strokeOpacity="0.4" strokeWidth="1" />
      </g>
      {/* 门缝底下透出的一线光：里面有人醒着？ */}
      {!ajar && <rect x="40" y="410" width="280" height="3" fill="url(#dc-under)" className="pw-ember" />}
      {/* 地面与门口的鞋 */}
      <rect x="0" y="414" width="360" height="26" fill="#140605" />
      <Shoe x={38} y={432} s={0.9} rot={-3} />
      <Shoe x={74} y={436} s={0.9} rot={5} />
      <Shoe x={142} y={430} flip s={0.82} kind="cloth" />
      <Shoe x={190} y={436} s={0.82} rot={-14} kind="cloth" />
      <Shoe x={262} y={433} flip s={0.95} rot={3} />
      <Shoe x={318} y={437} s={0.95} rot={-28} />
    </svg>
  )
}

function BoardCloseup() {
  return (
    <svg viewBox="0 0 520 340" className="w-full drop-shadow-[0_30px_40px_rgba(0,0,0,.9)]">
      <defs>
        <filter id="bc-chalk" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.5" />
        </filter>
        <filter id="bc-smudge" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.04" numOctaves="3" seed="6" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.8  0 0 0 0 0.8  0 0 0 0 0.78  0 0 0 0.12 0" />
        </filter>
      </defs>
      <rect x="0" y="0" width="520" height="340" fill="#2a1d10" />
      <rect x="16" y="16" width="488" height="300" fill="#0f1a15" />
      <rect x="16" y="16" width="488" height="300" filter="url(#bc-smudge)" />
      <g filter="url(#bc-chalk)" className="pw-hand" fill="#d8d6cc" opacity="0.8">
        <text x="260" y="66" textAnchor="middle" fontSize="38">
          训练安排
        </text>
        <text x="50" y="128" fontSize="26">
          一　发球 · 搓球
        </text>
        <text x="50" y="172" fontSize="26">
          三　多球
        </text>
        <text x="50" y="216" fontSize="26">
          五　对抗赛
        </text>
        <text x="50" y="290" fontSize="18" opacity="0.7">
          来，陪我打一个。
        </text>
      </g>
      <g filter="url(#bc-chalk)" stroke="#d8d6cc" strokeOpacity="0.7" strokeWidth="3" fill="none" strokeLinecap="round">
        <circle cx="330" cy="150" r="16" />
        <path d="M330 166 V214 M330 180 L306 196 M330 180 L356 168 M330 214 L316 244 M330 214 L344 244" />
        <ellipse cx="366" cy="162" rx="10" ry="7" />
        <circle cx="430" cy="176" r="11" />
        <path d="M430 187 V222 M430 198 L410 208 M430 198 L446 188 M430 222 L420 246 M430 222 L440 246" />
        <ellipse cx="452" cy="182" rx="8" ry="6" />
      </g>
      <g filter="url(#bc-chalk)" className="pw-hand" fill="#d8d6cc" opacity="0.65" fontSize="18">
        <text x="312" y="276">
          爷爷
        </text>
        <text x="420" y="276">
          我
        </text>
      </g>
      <rect x="16" y="316" width="488" height="12" fill="#3a2914" />
      <rect x="70" y="310" width="34" height="8" rx="2" fill="#e2dccb" opacity="0.7" />
    </svg>
  )
}
