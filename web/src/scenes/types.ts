import type { ComponentType } from 'react'

export type SceneProps = {
  milestones: string[]
  questionCount: number
  /** 主持人正在思考 */
  thinking: boolean
  /** 玩家长时间没有动作 */
  idle: boolean
  /** 揭晓汤底或离开时暂停环境声 */
  paused: boolean
  /** 主持人发出的一次性氛围指令；n 每次递增，用于区分连续两次相同的 cue */
  cue: { id: string; n: number } | null
}

export type RevealBeat = {
  text: string
  /** normal：逐行累积；isolated：清屏单独停顿；final：最后一句，单独、加重 */
  style?: 'normal' | 'isolated' | 'final'
  /** 这一拍出现时播放的声音 */
  cue?: () => void
  /** 自动播放时这一拍停留多久（毫秒） */
  hold?: number
}

/**
 * 每碗汤的前端“布景”。只有 Scene 是必需的，其余都有通用默认值。
 * 新增一碗汤时：没有专属布景就会自动使用 GenericScene。
 */
export type SceneDef = {
  Scene: ComponentType<SceneProps>
  /** 主色调（CSS 颜色），用于目录卡片、印章、强调文字 */
  accent: string
  /** 游戏时间：随提问推进的时钟，没有则不显示 */
  clock?: (questionCount: number) => { label: string; caption?: string }
  /** 达成某个里程碑后，汤面里的某段文字会“变”成另一段 */
  surfaceSwaps?: { milestone: string; from: string; to: string }[]
  /** 汤底的朗读节奏 */
  revealBeats?: (bottom: string[]) => RevealBeat[]
  /** 输入框占位文字，可随状态变化 */
  placeholder?: (s: { idle: boolean; milestones: string[] }) => string
  /** 开场前的一句耳语 */
  whisper?: string
  /** 目录页卡片上的小插画 */
  CardArt?: ComponentType
  /** 场景整体是亮色（白天）时设为 light，界面文字改用深色 */
  tone?: 'dark' | 'light'
  /** 点开场按钮时的声音，默认是推开一扇老木门 */
  enterSound?: () => void
  /** 界面上和这碗汤有关的文案，没有则用通用文案 */
  copy?: Partial<SceneCopy>
}

export type SceneCopy = {
  /** 开场按钮 */
  enter: string
  /** 继续上次的对局 */
  resume: string
  /** 记录本页眉的小字 */
  logbook: string
  /** 记录本标题前缀（窄屏隐藏） */
  titlePrefix: string
  /** 通关后查看汤底的按钮 */
  solved: string
}

export const DEFAULT_COPY: SceneCopy = {
  enter: '开 始',
  resume: '继 续',
  logbook: '推 理 记 录',
  titlePrefix: '',
  solved: '你想通了 · 查看汤底',
}

export const copyOf = (def: SceneDef): SceneCopy => ({ ...DEFAULT_COPY, ...def.copy })
