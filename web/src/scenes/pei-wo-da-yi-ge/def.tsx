import { audio } from '../../audio/engine'
import type { RevealBeat, SceneDef } from '../types'
import { Scene } from './Scene'
import { DAWN_Q, FATHER_Q, clockLabel } from './time'

const after = (ms: number, fn: () => void) => setTimeout(fn, ms)

function revealBeats(bottom: string[]): RevealBeat[] {
  const beats: RevealBeat[] = []
  for (const line of bottom) {
    if (line.includes('乒，乒，乒。')) {
      // “乒，乒，乒。这一次，里面没有回球。”单独停顿
      const [before, rest] = line.split('乒，乒，乒。')
      if (before) beats.push({ text: before })
      beats.push({
        text: '乒，乒，乒。',
        style: 'isolated',
        hold: 4200,
        cue: () => [0, 1100, 2200].forEach(t => after(t, () => audio.hammer())),
      })
      if (rest) beats.push({ text: rest, style: 'isolated', hold: 5200 })
    } else if (line.includes('“乖，别停。”') && line.indexOf('“乖，别停。”') > 0) {
      const i = line.indexOf('“乖，别停。”')
      beats.push({ text: line.slice(0, i) })
      beats.push({
        text: '“乖，别停。”',
        style: 'final',
        hold: 7000,
        // 最后：远处又敲了一下。然后，里面回了一下。
        cue: () => {
          after(2600, () => audio.ping({ vol: 0.7 }))
          after(3700, () => audio.thump({ vol: 0.5 }))
        },
      })
    } else if (line.includes('传来“咚”')) {
      beats.push({ text: line, cue: () => (audio.thump({ vol: 0.9 }), after(900, () => audio.whisper({ vol: 0.6 }))) })
    } else if (line.includes('乒，咚。乒，咚。')) {
      beats.push({
        text: line,
        hold: 4200,
        cue: () => [0, 1400].forEach(t => (after(t, () => audio.ping()), after(t + 650, () => audio.thump({ vol: 0.8 })))),
      })
    } else {
      beats.push({ text: line })
    }
  }
  return beats
}

function CardArt() {
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <defs>
        <radialGradient id="ca-g" cx="0.5" cy="0.62" r="0.6">
          <stop offset="0" stopColor="#3a0d0a" />
          <stop offset="1" stopColor="#060404" />
        </radialGradient>
        <radialGradient id="ca-l" cx="0.5" cy="0.4" r="0.5">
          <stop offset="0" stopColor="#dfeee6" stopOpacity=".12" />
          <stop offset="1" stopColor="#dfeee6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#ca-g)" />
      <polygon points="40,128 280,128 300,150 20,150" fill="#0b2a24" stroke="#c9d6cf" strokeOpacity=".25" />
      <polygon points="40,128 280,128 300,150 20,150" fill="url(#ca-l)" />
      <g transform="translate(170 138) rotate(-4) scale(1 .7)">
        <rect x="16" y="-3" width="26" height="7" rx="2" fill="#6b4a2a" />
        <ellipse rx="22" ry="9" fill="#7a1612" />
      </g>
      <text x="160" y="56" textAnchor="middle" fontSize="20" fill="#7d0d0a" opacity=".7" style={{ fontFamily: 'Ma Shan Zheng, serif' }}>
        球……
      </text>
    </svg>
  )
}

export const peiWoDaYiGe: SceneDef = {
  Scene,
  accent: '#8e1b17',
  clock: q => ({
    label: clockLabel(q),
    caption: q >= DAWN_Q ? '天快亮了' : q >= FATHER_Q && q < FATHER_Q + 2 ? '半夜两点' : undefined,
  }),
  surfaceSwaps: [{ milestone: 'help', from: '球……球……', to: '救……救……' }],
  revealBeats,
  placeholder: ({ idle, milestones }) =>
    idle ? '……球……球……' : milestones.includes('help') ? '他还在里面。继续问。' : '问一个只能回答“是”或“不是”的问题',
  whisper: '“来，陪我打一个。”',
  CardArt,
}
