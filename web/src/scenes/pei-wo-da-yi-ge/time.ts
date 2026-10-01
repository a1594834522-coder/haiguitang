/** 游戏内时间：从 23:50 开始，每问一个问题过去 18 分钟，第 20 问时天亮（05:50）。 */
export const START_MIN = 23 * 60 + 50
export const STEP_MIN = 18
export const DAWN_Q = 20
/** 半夜两点多，休息室的门会开一次 */
export const FATHER_Q = 8

export const gameMinutes = (q: number) => (START_MIN + q * STEP_MIN) % 1440

export function clockLabel(q: number) {
  const m = gameMinutes(Math.min(q, DAWN_Q + 4))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** 0 = 深夜，1 = 天亮 */
export const dawnProgress = (q: number) => Math.min(1, Math.max(0, (q - 9) / (DAWN_Q - 9)))
