import { generic } from './generic/def'
import { peiWoDaYiGe } from './pei-wo-da-yi-ge/def'
import { xiangYouKanQi } from './xiang-you-kan-qi/def'
import type { SceneDef } from './types'

/** storyId → 布景。新增专属布景时在这里注册即可。 */
const registry: Record<string, SceneDef> = {
  'pei-wo-da-yi-ge': peiWoDaYiGe,
  'xiang-you-kan-qi': xiangYouKanQi,
}

export function sceneFor(storyId: string): SceneDef {
  return registry[storyId] ?? generic
}

export type { SceneDef, SceneProps, RevealBeat } from './types'
export { copyOf } from './types'
