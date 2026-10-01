import { useEffect } from 'react'
import { Elder } from './Figure'

export type InspectTarget = 'chief' | 'roster' | 'canteen'

/** “我”凑近看时的旁白。只说玩家已经确认过的事，绝不超前。 */
function caption(t: InspectTarget, has: (m: string) => boolean): string {
  switch (t) {
    case 'chief':
      if (has('chief')) return '他在看我。'
      if (has('line')) return '他一直看着操场的角落。'
      return '主席台上站着老总教官。头发全白了，站得比谁都直。'
    case 'roster':
      if (has('girl')) return '第七格写着一个名字，字很秀气。不是我的。'
      if (has('dead')) return '第七格是空的。我的名字，不在上面了。'
      return '教官的点名册。一连，三排。第七格被擦过，纸起了毛。'
    case 'canteen':
      if (has('voice')) return '它一直放在这里。从来没有人来拿。'
      return '地上有个旧水壶，掉了漆，晒得发烫。不知道是谁的。'
  }
}

export function Inspect({ target, milestones, onClose }: { target: InspectTarget; milestones: string[]; onClose: () => void }) {
  const has = (m: string) => milestones.includes(m)
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', f)
    return () => removeEventListener('keydown', f)
  }, [onClose])

  return (
    <div className="xy-inspect fixed inset-0 z-[58] flex cursor-zoom-out flex-col items-center justify-center bg-black/85 px-6" onClick={onClose}>
      <div className="xy-inspect-glow pointer-events-none absolute inset-0" />
      <div className="xy-inspect-item relative flex max-h-[66vh] w-full max-w-[min(88vw,560px)] items-center justify-center">
        {target === 'chief' && <ChiefCloseup gaze={has('chief') ? 0 : has('line') ? 1 : 0} stare={has('chief')} />}
        {target === 'roster' && <RosterCloseup state={has('girl') ? 'girl' : has('dead') ? 'blank' : 'erased'} />}
        {target === 'canteen' && <CanteenCloseup />}
      </div>
      <p className="xy-hand rise-in relative mt-8 max-w-md text-center text-2xl leading-relaxed text-bone/85" style={{ animationDelay: '.4s' }}>
        {caption(target, has)}
      </p>
      <p className="relative mt-6 text-[11px] tracking-[.3em] text-ash/40">点击任意处返回</p>
    </div>
  )
}

/** 隔着热浪，用望远镜看主席台 */
function ChiefCloseup({ gaze, stare }: { gaze: number; stare: boolean }) {
  return (
    <svg viewBox="0 0 400 400" className="h-[58vh] max-h-[460px] w-auto max-w-full">
      <defs>
        <clipPath id="cc-lens">
          <circle cx="200" cy="200" r="190" />
        </clipPath>
        <radialGradient id="cc-edge" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.95" />
        </radialGradient>
        <filter id="cc-heat" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.04" numOctaves="2" seed="2">
            <animate attributeName="seed" values="2;3;4;5;2" dur="2s" repeatCount="indefinite" calcMode="discrete" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="9" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g clipPath="url(#cc-lens)">
        <rect width="400" height="400" fill="#c9c4b5" />
        <rect x="0" y="40" width="400" height="70" fill="#9d2a1d" />
        <text x="200" y="92" textAnchor="middle" fontSize="44" fill="#f1e2b8" letterSpacing="20" className="xy-serif" fontWeight="900" opacity="0.9">
          军 训
        </text>
        <g filter="url(#cc-heat)">
          <g transform="translate(200 0) scale(6.2) translate(-30 8)">
            <Elder x={30} y={160} s={1} gaze={gaze} stare={stare} />
          </g>
        </g>
        <rect x="0" y="330" width="400" height="70" fill="#6f2b1e" />
        <rect width="400" height="400" fill="#fff6dc" opacity="0.12" />
      </g>
      <circle cx="200" cy="200" r="190" fill="url(#cc-edge)" />
      <circle cx="200" cy="200" r="190" fill="none" stroke="#0b0b0b" strokeWidth="8" />
    </svg>
  )
}

function RosterCloseup({ state }: { state: 'erased' | 'blank' | 'girl' }) {
  return (
    <svg viewBox="0 0 420 520" className="h-[60vh] max-h-[520px] w-auto max-w-full drop-shadow-[0_30px_40px_rgba(0,0,0,.9)]">
      <defs>
        <filter id="rc-paper" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" seed="4" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.26  0 0 0 0.18 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id="rc-fuzz" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="4" />
        </filter>
      </defs>
      {/* 夹板 */}
      <rect x="10" y="10" width="400" height="500" rx="10" fill="#5a4026" />
      <rect x="150" y="0" width="120" height="34" rx="6" fill="#8e9094" />
      <rect x="166" y="8" width="88" height="14" rx="4" fill="#5d5f62" />
      {/* 纸 */}
      <rect x="36" y="44" width="348" height="446" fill="#e6dec4" />
      <rect x="36" y="44" width="348" height="446" fill="#fff" filter="url(#rc-paper)" />
      <text x="210" y="84" textAnchor="middle" fontSize="22" fill="#3a3226" className="xy-serif" fontWeight="900">
        一连 · 三排 点名册
      </text>
      <path d="M56 98 L364 98" stroke="#3a3226" strokeWidth="1.2" />
      {Array.from({ length: 12 }, (_, i) => {
        const y = 128 + i * 29
        const seven = i === 6
        return (
          <g key={i}>
            <text x="62" y={y} fontSize="15" fill="#5a4e3c" className="xy-serif">
              {i + 1}
            </text>
            <path d={`M90 ${y + 6} L360 ${y + 6}`} stroke="#9c9177" strokeWidth="0.8" />
            {!seven && (
              <path
                d={`M104 ${y - 3} q8 -9 16 0 t16 0 q6 -6 12 1 t14 -1 ${i % 2 ? 'q8 -8 16 0' : ''}`}
                stroke="#2b3a5a"
                strokeWidth="2"
                fill="none"
                opacity="0.75"
              />
            )}
            {!seven && <path d={`M300 ${y - 4} l6 6 l12 -12`} stroke="#2b3a5a" strokeWidth="1.8" fill="none" opacity="0.6" />}
            {seven && state === 'erased' && (
              <g filter="url(#rc-fuzz)">
                <rect x="98" y={y - 16} width="120" height="22" fill="#d8cfb2" />
                <path d={`M106 ${y - 4} q8 -9 16 0 t16 0 q8 -7 14 1`} stroke="#2b3a5a" strokeWidth="2" fill="none" opacity="0.18" />
                <path d={`M110 ${y - 8} l90 4 M108 ${y - 2} l96 -3`} stroke="#b9ae90" strokeWidth="5" opacity="0.6" />
              </g>
            )}
            {seven && state === 'girl' && (
              <path d={`M106 ${y - 4} q5 -7 10 0 t10 0 q4 -5 9 1 t10 -2 q5 -4 9 2`} stroke="#6a2b3a" strokeWidth="1.6" fill="none" opacity="0.85" />
            )}
          </g>
        )
      })}
      {/* 晒出来的汗渍 */}
      <ellipse cx="320" cy="420" rx="40" ry="26" fill="#a08850" opacity="0.15" />
    </svg>
  )
}

function CanteenCloseup() {
  return (
    <svg viewBox="0 0 420 460" className="h-[58vh] max-h-[480px] w-auto max-w-full drop-shadow-[0_30px_40px_rgba(0,0,0,.9)]">
      <defs>
        <linearGradient id="cn-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3e4430" />
          <stop offset="0.35" stopColor="#6d7550" />
          <stop offset="0.6" stopColor="#5b6243" />
          <stop offset="1" stopColor="#2c3022" />
        </linearGradient>
        <filter id="cn-chip" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" seed="21" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.66  0 0 0 0 0.66  0 0 0 0 0.62  0 0 0 -22 6.9" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      {/* 地面 */}
      <ellipse cx="210" cy="420" rx="170" ry="28" fill="#000" opacity="0.5" />
      {/* 背带 */}
      <path d="M120 120 Q60 260 110 420" stroke="#4a4630" strokeWidth="14" fill="none" />
      <path d="M300 120 Q380 300 330 430" stroke="#3e3b28" strokeWidth="14" fill="none" />
      {/* 壶身：铝壶，凹了几处 */}
      <path d="M110 150 Q100 110 150 100 L270 100 Q320 110 310 150 L318 360 Q318 410 210 412 Q102 410 102 360 Z" fill="url(#cn-body)" />
      <path d="M110 150 Q100 110 150 100 L270 100 Q320 110 310 150 L318 360 Q318 410 210 412 Q102 410 102 360 Z" fill="#fff" filter="url(#cn-chip)" />
      <ellipse cx="160" cy="260" rx="26" ry="40" fill="#000" opacity="0.18" />
      <ellipse cx="268" cy="320" rx="20" ry="16" fill="#000" opacity="0.22" />
      <path d="M150 140 Q140 260 150 380" stroke="#e8e4d0" strokeOpacity="0.18" strokeWidth="12" fill="none" />
      {/* 壶嘴和盖子 */}
      <rect x="180" y="60" width="60" height="44" rx="6" fill="#2f2f28" />
      <rect x="172" y="50" width="76" height="16" rx="4" fill="#3a3a32" />
      <path d="M240 64 Q270 60 280 90" stroke="#5c5a4e" strokeWidth="4" fill="none" />
      {/* 掉漆处写过字，已经看不清了 */}
      <path d="M180 220 l14 -4 m6 2 l10 -2 m-26 14 l20 -2" stroke="#2a2a22" strokeWidth="2.5" opacity="0.35" />
    </svg>
  )
}
