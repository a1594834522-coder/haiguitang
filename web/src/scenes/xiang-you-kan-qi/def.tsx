import { audio } from '../../audio/engine'
import type { RevealBeat, SceneDef } from '../types'
import { CamoPattern, Elder } from './Figure'
import { Scene } from './Scene'
import { NOON_Q, clockLabel } from './time'

const after = (ms: number, fn: () => void) => setTimeout(fn, ms)

/** 汤底朗读：最后两句分开停顿（作者叮嘱） */
function revealBeats(bottom: string[]): RevealBeat[] {
  return bottom.map((text, i): RevealBeat => {
    const last = i === bottom.length - 1
    if (text.startsWith('“向右看齐”时')) {
      return { text, style: 'isolated', hold: 6500, cue: () => Array.from({ length: 10 }, (_, k) => after(400 + k * 160, () => audio.stamp())) }
    }
    if (text.includes('各连带回')) {
      return { text, style: 'isolated', hold: 5200, cue: () => after(600, () => audio.whistle({ long: true, vol: 0.3 })) }
    }
    if (last) return { text, style: 'final', hold: 7000, cue: () => after(2800, () => audio.whisper({ vol: 0.5 })) }
    return { text }
  })
}

/** 卡片：“我”眼里的操场。帽檐压在上面，主席台就在正前方，全连都在左边的树荫里 */
function CardArt() {
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <defs>
        <CamoPattern id="xc-camo" />
        <linearGradient id="xc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8d3c2" />
          <stop offset="1" stopColor="#f1ead5" />
        </linearGradient>
        <radialGradient id="xc-vig" cx="0.5" cy="0.5" r="0.7">
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#1a0a04" stopOpacity="0.85" />
        </radialGradient>
        <filter id="xc-blur">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
      <rect width="320" height="180" fill="url(#xc-sky)" />
      <rect x="0" y="80" width="320" height="100" fill="#8f9566" />
      <rect x="0" y="97" width="320" height="7" fill="#9a4a35" />
      {/* 主席台 */}
      <rect x="96" y="40" width="128" height="44" fill="#c4bfb0" />
      <rect x="112" y="46" width="96" height="9" fill="#9d2a1d" />
      <rect x="90" y="84" width="140" height="13" fill="#b5af9f" />
      <rect x="120" y="73" width="80" height="9" fill="#8a2318" />
      <Elder x={160} y={86} s={0.2} />
      {/* 左边的树荫，全连坐在底下 */}
      <ellipse cx="40" cy="62" rx="70" ry="40" fill="#3e4f27" />
      <ellipse cx="50" cy="128" rx="80" ry="18" fill="#1d2410" opacity="0.5" />
      {/* 地上，“我”的影子 */}
      <path d="M126 184 Q130 164 148 160 Q146 146 160 144 Q174 146 172 160 Q190 164 194 184 Z" fill="#1b1a10" opacity="0.4" filter="url(#xc-blur)" />
      {/* 帽檐 */}
      <path d="M-10 0 L330 0 L330 12 Q160 34 -10 12 Z" fill="#262b18" filter="url(#xc-blur)" />
      <rect width="320" height="180" fill="url(#xc-vig)" />
    </svg>
  )
}

export const xiangYouKanQi: SceneDef = {
  Scene,
  accent: '#b0471f',
  tone: 'light',
  clock: q => ({ label: clockLabel(q), caption: q >= NOON_Q ? '正午' : '军训第三天' }),
  surfaceSwaps: [{ milestone: 'chief', from: '老总教官在主席台上喊', to: '当年那个教官在主席台上喊' }],
  revealBeats,
  placeholder: ({ idle, milestones }) =>
    idle ? '……谁都不许动……' : milestones.includes('dead') ? '你还站在那里。继续问。' : '问一个只能回答“是”或“不是”的问题',
  whisper: '“谁都不许动。”',
  enterSound: () => audio.whistle({ vol: 0.3 }),
  CardArt,
  copy: { enter: '站到第三排第七个', resume: '回到那个位置', logbook: '军 训 记 录', titlePrefix: '一连 · ', solved: '你看清了右边那个人 · 查看汤底' },
}
