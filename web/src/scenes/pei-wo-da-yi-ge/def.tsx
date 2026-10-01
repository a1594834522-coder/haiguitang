import { audio } from '../../audio/engine'
import type { RevealBeat, SceneDef } from '../types'
import cover from './cover.jpg'
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
  cover,
  copy: { enter: '推开训练馆的门', resume: '回到那一夜', logbook: '训 练 记 录', titlePrefix: '一号台 · ', solved: '你看见了那一夜 · 查看汤底' },
}
