import { audio } from '../../audio/engine'
import type { RevealBeat, SceneDef } from '../types'
import cover from './cover.jpg'
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

export const xiangYouKanQi: SceneDef = {
  Scene,
  accent: '#b0471f',
  tone: 'light',
  clock: q => ({ label: clockLabel(q), caption: q >= NOON_Q ? '正午' : '军训第三天' }),
  surfaceSwaps: [{ milestone: 'chief', from: '带了四十年军训的老总教官', to: '当年那个教官' }],
  revealBeats,
  placeholder: ({ idle, milestones }) =>
    idle ? '……谁都不许动……' : milestones.includes('dead') ? '你还站在那里。继续问。' : '问一个只能回答“是”或“不是”的问题',
  whisper: '“谁都不许动。”',
  enterSound: () => audio.whistle({ vol: 0.3 }),
  cover,
  copy: { enter: '站到第三排第七个', resume: '回到那个位置', logbook: '军 训 记 录', titlePrefix: '一连 · ', solved: '你看清了右边那个人 · 查看汤底' },
}
