/** 游戏内时间：军训第三天上午 11:20 开始，每问一个问题过去 4 分钟，第 10 问正午。 */
export const START_MIN = 11 * 60 + 20
export const STEP_MIN = 4
export const NOON_Q = 10

export function clockLabel(q: number) {
  const m = START_MIN + Math.min(q, 60) * STEP_MIN
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** 0 = 上午，1 = 最毒的时候（正午之后一直维持） */
export const heatOf = (q: number) => Math.min(1, Math.max(0, q / NOON_Q))
